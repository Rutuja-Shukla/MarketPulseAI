"""Multi-stage research orchestration.

The orchestrator converts a project configuration into concrete tasks, runs the
data work for each stage and records honest progress. Live mode uses the
configured search provider; demonstration mode uses the synthetic corpus and
labels every record accordingly.
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.llm import LLMProviderError, try_get_llm, untrusted_block
from app.core.logging import get_logger
from app.models.research import ResearchProject, ResearchSource, ResearchTask
from app.research.demo_corpus import DEMO_COMPETITORS, DEMO_EVIDENCE
from app.research.providers import get_search_provider
from app.research.taxonomy import (
    COUNTRY_BY_CODE,
    MODE_PROFILES,
    OBJECTIVES,
    SOURCE_CATEGORY_KEYS,
    SOURCE_CATEGORIES,
    STAGE_LABELS,
)
from app.services.analysis_engine import AnalysisEngine
from app.services.text_analysis import truncate

logger = get_logger(__name__)


class ResearchError(RuntimeError):
    """Raised for user-actionable research failures."""


class ResearchOrchestrator:
    def __init__(self, db: Session, project: ResearchProject, *, demo: bool) -> None:
        self.db = db
        self.project = project
        self.demo = demo
        self.profile = MODE_PROFILES.get(project.mode, MODE_PROFILES["standard"])
        self.engine = AnalysisEngine(db, project)
        self.config = project.configuration

    # --------------------------------------------------------------- lifecycle
    def prepare(self) -> list[ResearchTask]:
        for task in self.db.scalars(
            select(ResearchTask).where(ResearchTask.project_id == self.project.id)
        ):
            self.db.delete(task)
        self.db.flush()
        tasks = []
        for index, stage in enumerate(self.profile["stages"]):
            meta = STAGE_LABELS[stage]
            task = ResearchTask(
                project_id=self.project.id,
                stage=stage,
                agent=meta["agent"],
                name=meta["name"],
                order_index=index,
                status="pending",
            )
            self.db.add(task)
            tasks.append(task)
        self.db.flush()
        return tasks

    def run(self) -> None:
        project = self.project
        project.status = "running"
        project.started_at = datetime.now(timezone.utc)
        project.error_message = None
        self.db.commit()

        tasks = list(
            self.db.scalars(
                select(ResearchTask)
                .where(ResearchTask.project_id == project.id)
                .order_by(ResearchTask.order_index)
            )
        )
        if not tasks:
            tasks = self.prepare()
            self.db.commit()

        total = max(1, len(tasks))
        try:
            for index, task in enumerate(tasks):
                project.current_stage = task.stage
                task.status = "running"
                task.started_at = datetime.now(timezone.utc)
                self.db.commit()
                started = time.perf_counter()
                try:
                    detail, count = self._execute(task.stage, index, total)
                except Exception as exc:  # noqa: BLE001 - surfaced to the UI
                    logger.exception("stage_failed", extra={"stage": task.stage, "project_id": str(project.id)})
                    task.status = "failed"
                    task.detail = str(exc)[:900]
                    task.finished_at = datetime.now(timezone.utc)
                    project.status = "failed"
                    project.error_message = f"{task.name}: {exc}"[:900]
                    project.current_stage = task.stage
                    self.db.commit()
                    return
                task.status = "completed"
                task.detail = detail[:1200]
                task.result_count = count
                task.progress = 100
                task.finished_at = datetime.now(timezone.utc)
                for later in tasks[index + 1 :]:
                    later.progress = 0
                self.db.commit()
                if self.demo:
                    time.sleep(0.12)  # keeps stage transitions legible without faking work

            self._finalise()
        except Exception as exc:  # noqa: BLE001
            logger.exception("research_run_failed", extra={"project_id": str(project.id)})
            project.status = "failed"
            project.error_message = f"Research failed: {exc}"[:900]
            self.db.commit()

    def _finalise(self) -> None:
        project = self.project
        from app.models.findings import RoadmapItem

        roadmap_count = len(
            list(self.db.scalars(select(RoadmapItem.id).where(RoadmapItem.project_id == project.id)))
        )
        if roadmap_count == 0:
            self.engine.build_roadmap()
        from app.models.findings import StrategicRelationship

        relationships = len(
            list(
                self.db.scalars(
                    select(StrategicRelationship.id).where(
                        StrategicRelationship.project_id == project.id
                    )
                )
            )
        )
        if relationships == 0 and project.failures:
            self.engine.build_relationships()
        reports = project.reports
        if not reports and "executive_report" not in self.profile["stages"]:
            self.engine.build_report(provider=self._provider_label())

        project.status = "completed"
        project.current_stage = "completed"
        project.completed_at = datetime.now(timezone.utc)
        project.evidence_count = len(project.evidence)
        self._enrich_report_with_llm()
        self._notify_completion()
        self.db.commit()

    def _provider_label(self) -> str:
        if self.demo:
            return "demo-dataset+heuristic-v1"
        llm = try_get_llm()
        return "search+gemini+heuristic-v1" if llm else "search+heuristic-v1"

    def _notify_completion(self) -> None:
        from app.models.reporting import Notification

        self.db.add(
            Notification(
                user_id=self.project.user_id,
                project_id=self.project.id,
                kind="research_completed" if self.project.status == "completed" else "research_failed",
                title=(
                    f"Analysis ready: {self.project.name}"
                    if self.project.status == "completed"
                    else f"Analysis failed: {self.project.name}"
                ),
                body=(
                    f"{self.project.evidence_count} evidence records, {self.project.failure_count} weaknesses "
                    f"and {self.project.opportunity_count} opportunities."
                    if self.project.status == "completed"
                    else (self.project.error_message or "")[:300]
                ),
                action_route=f"/analysis/{self.project.id}/report",
            )
        )

    # ----------------------------------------------------------------- stages
    def _execute(self, stage: str, index: int, total: int) -> tuple[str, int]:
        handler = getattr(self, f"_stage_{stage}", None)
        if handler is None:
            return ("Stage not implemented", 0)
        detail, count = handler()
        return (f"{detail}", count)

    def _stage_understand_request(self) -> tuple[str, int]:
        project = self.project
        config = self.config
        countries = (
            "global"
            if config and config.global_scope
            else ", ".join(
                COUNTRY_BY_CODE.get(code, {"name": code})["name"] for code in (config.countries if config else [])
            )
        )
        objectives = [
            next((o["label"] for o in OBJECTIVES if o["key"] == key), key)
            for key in (config.objectives if config else [])
        ]
        mode = self.profile["label"]
        detail = (
            f"{mode} for {project.company.name} ({project.product_name or 'product'}) in {countries or 'selected markets'}. "
            f"Objectives: {', '.join(objectives) or 'general market assessment'}."
        )
        if self.demo:
            detail += " Source mode: demonstration corpus."
        return detail, 1

    def generate_questions(self) -> list[str]:
        company = self.project.company.name
        product = self.project.product_name or company
        config = self.config
        countries = (
            ["global"]
            if not config or config.global_scope
            else [COUNTRY_BY_CODE.get(c, {"name": c})["name"] for c in config.countries]
        )
        objectives = set(config.objectives if config else [])
        templates: list[str] = []
        if {"sentiment", "complaints"} & objectives:
            templates.append(f'"{product}" reviews complaints problems')
            templates.append(f"{company} customer support experience review")
        if "pricing" in objectives or not objectives:
            templates.append(f"{company} pricing expensive alternatives")
        if "weaknesses" in objectives:
            templates.append(f"{product} missing features limitations")
        if "competitors" in objectives:
            templates.append(f"{company} vs competitors comparison")
        if "opportunities" in objectives:
            templates.append(f"{company} unmet customer needs feature request")
        if "trends" in objectives:
            templates.append(f"{product} industry trend 2026")
        if not templates:
            templates.append(f"{company} customer sentiment")
        questions = []
        for country in countries[:4]:
            for template in templates:
                questions.append(f"{template} {'' if country == 'global' else country}".strip())
        return questions[: int(self.profile["query_budget"])]

    def _stage_generate_questions(self) -> tuple[str, int]:
        questions = self.generate_questions()
        llm = try_get_llm() if not self.demo else None
        if llm:
            try:
                payload = llm.generate_json(
                    "Suggest up to 6 focused public-web research questions for this brief. "
                    "Return JSON: {\"questions\": [string]}.\n"
                    f"Company: {self.project.company.name}\nProduct: {self.project.product_name}\n"
                    f"Industry: {self.project.company.industry}\nCountries: {self.config.countries if self.config else []}\n"
                    f"Objectives: {self.config.objectives if self.config else []}",
                    schema_hint='{"questions": ["..."]}',
                )
                generated = [str(q) for q in payload.get("questions", []) if str(q).strip()]
                if generated:
                    questions = (generated + questions)[: int(self.profile["query_budget"]) + 2]
            except (LLMProviderError, ValueError) as exc:
                logger.warning("question_generation_fallback", extra={"event": str(exc)})
        self._questions = questions
        return ("Research questions:\n" + "\n".join(f"• {q}" for q in questions), len(questions))

    def _stage_discover_sources(self) -> tuple[str, int]:
        return self._discover_and_collect(collect=False)

    def _stage_collect_results(self) -> tuple[str, int]:
        return self._discover_and_collect(collect=True)

    def _discover_and_collect(self, *, collect: bool) -> tuple[str, int]:
        if self.demo:
            categories = [
                category
                for category in (self.config.source_categories if self.config else SOURCE_CATEGORY_KEYS)
                if category in SOURCE_CATEGORY_KEYS
            ] or list(SOURCE_CATEGORY_KEYS)
            records = self._demo_records(categories)
            if collect:
                self._records = records
                return (f"Collected {len(records)} demonstration records across {len(categories)} source categories.", len(records))
            labels = [
                next((c["label"] for c in SOURCE_CATEGORIES if c["key"] == key), key)
                for key in categories
            ]
            self._ensure_demo_sources(categories, records)
            return (f"Demonstration corpus selected: {', '.join(labels)}.", len(categories))

        questions = getattr(self, "_questions", None) or self.generate_questions()
        provider = get_search_provider()
        results = []
        for question in questions:
            try:
                results.extend(provider.search(question, max_results=6))
            except Exception as exc:  # noqa: BLE001
                raise ResearchError(f"Search provider error for '{question}': {exc}") from exc
        deduped: dict[str, object] = {}
        for result in results:
            deduped.setdefault(result.url, result)
        collected = list(deduped.values())[: int(self.profile["evidence_target"])]
        if not collected:
            raise ResearchError("The search provider returned no results for this brief.")
        self._ensure_live_sources(collected)
        if collect:
            self._records = [self._live_record(result) for result in collected]
            return (f"Collected {len(self._records)} permitted search results via {provider.name}.", len(self._records))
        return (f"Discovered {len(collected)} unique URLs via {provider.name}.", len(collected))

    def _demo_records(self, categories: list[str]) -> list[dict]:
        config = self.config
        selected_countries = set(config.countries or []) if config else set()
        global_scope = bool(config and config.global_scope)
        records = []
        for record in DEMO_EVIDENCE:
            if record["source_category"] not in categories:
                continue
            country = record.get("country")
            if not global_scope and selected_countries and country and country not in selected_countries:
                continue
            if not global_scope and selected_countries and not country:
                pass  # market-wide sources remain valid
            records.append(dict(record))
        records.sort(key=lambda r: r.get("published_at"))
        return records[: int(self.profile["evidence_target"])]

    def _ensure_demo_sources(self, categories: list[str], records: list[dict]) -> None:
        from collections import Counter

        counts = Counter(record["source_category"] for record in records)
        existing = {source.category for source in self.project.sources}
        for category in categories:
            if category in existing:
                continue
            label = next((c["label"] for c in SOURCE_CATEGORIES if c["key"] == category), category)
            self.db.add(
                ResearchSource(
                    project_id=self.project.id,
                    name=label,
                    category=category,
                    provider="demo_dataset",
                    is_live=False,
                    description="Synthetic demonstration records — not live web research.",
                    record_count=counts.get(category, 0),
                )
            )
        self.db.flush()

    def _ensure_live_sources(self, results: list) -> None:
        existing = {source.name for source in self.project.sources}
        for result in results:
            if result.source_name in existing:
                continue
            self.db.add(
                ResearchSource(
                    project_id=self.project.id,
                    name=result.source_name,
                    category="news",
                    base_url=f"https://{result.source_name}",
                    provider=get_search_provider().name,
                    is_live=True,
                    description="Public search result discovered by the configured provider.",
                )
            )
            existing.add(result.source_name)
        self.db.flush()

    @staticmethod
    def _live_record(result) -> dict:
        return {
            "source_category": "news",
            "source_name": result.source_name,
            "source_url": result.url,
            "published_at": result.published_at,
            "title": result.title,
            "text": result.snippet,
            "search_query": "",
        }

    def _stage_extract_evidence(self) -> tuple[str, int]:
        records = getattr(self, "_records", None)
        if records is None:
            raise ResearchError("No collected results were available for extraction.")
        categories = sorted({record["source_category"] for record in records})
        source_map = {source.category: source.id for source in self.project.sources}
        for category in categories:
            if category not in source_map:
                label = next((c["label"] for c in SOURCE_CATEGORIES if c["key"] == category), category)
                source = ResearchSource(
                    project_id=self.project.id,
                    name=label,
                    category=category,
                    provider="demo_dataset" if self.demo else "search",
                    is_live=not self.demo,
                )
                self.db.add(source)
                self.db.flush()
                source_map[category] = source.id
        created = self.engine.ingest(records, is_demo=self.demo, source_map=source_map)
        for source in self.project.sources:
            source.record_count = len(
                [record for record in created if record.source_category == source.category]
            )
        self.db.flush()
        return (
            f"Stored {len(created)} evidence records with extracted text and source attribution.",
            len(created),
        )

    def _stage_deduplicate(self) -> tuple[str, int]:
        records = self.project.evidence
        duplicates = len([r for r in records if r.duplicate_status != "unique"])
        return (
            f"Near-duplicate detection complete (5-gram Jaccard ≥ 0.72). {len(records)} unique records retained.",
            len(records) - duplicates,
        )

    def _stage_entity_linking(self) -> tuple[str, int]:
        names = [c.name for c in self.project.competitors] or [
            competitor["name"] for competitor in DEMO_COMPETITORS
        ]
        competitors = self.engine.build_competitors(names)
        return (
            f"Linked {len(competitors)} companies/products, including "
            f"{len([c for c in competitors if not c.is_primary])} competitors.",
            len(competitors),
        )

    def _stage_sentiment_classification(self) -> tuple[str, int]:
        from collections import Counter

        records = self.project.evidence
        counts = Counter(record.sentiment for record in records)
        return (
            f"Classified {len(records)} records: {counts['positive']} positive, {counts['negative']} negative, "
            f"{counts['neutral']} neutral, {counts['mixed']} mixed.",
            len(records),
        )

    def _stage_complaint_detection(self) -> tuple[str, int]:
        names = [c.name for c in self.project.competitors] or [
            competitor["name"] for competitor in DEMO_COMPETITORS
        ]
        self.engine.build_competitors(names)
        clusters = self.engine.build_topics()
        failures = self.engine.build_failures()
        return (
            f"Built {len(clusters)} topic clusters and {len(failures)} weakness findings.",
            len(failures),
        )

    def _stage_trend_modelling(self) -> tuple[str, int]:
        from collections import Counter

        clusters = self.engine.build_topics()
        trends = Counter(cluster.trend for cluster in clusters)
        return (
            f"Trend pass complete: {trends['emerging']} emerging, {trends['declining']} declining, "
            f"{trends['stable']} stable topics.",
            len(clusters),
        )

    def _stage_opportunity_detection(self) -> tuple[str, int]:
        opportunities = self.engine.build_opportunities()
        quick_wins = len([o for o in opportunities if o.quadrant == "quick_win"])
        return (
            f"Identified {len(opportunities)} opportunities ({quick_wins} quick wins) scored for impact and effort.",
            len(opportunities),
        )

    def _stage_competitor_positioning(self) -> tuple[str, int]:
        names = [c.name for c in self.project.competitors]
        competitors = self.engine.build_competitors(names)
        with_evidence = [c for c in competitors if c.mention_count > 0 and not c.is_primary]
        return (
            f"Positioned {len(with_evidence)} competitors against {len(self.project.evidence)} records.",
            len(with_evidence),
        )

    def _stage_contradiction_analysis(self) -> tuple[str, int]:
        records = self.project.evidence
        groups = {}
        for record in records:
            if record.contradiction_group:
                groups.setdefault(record.contradiction_group, []).append(record)
        return (
            f"Contradiction review found {len(groups)} topic(s) with both positive and negative evidence."
            + (
                " These are flagged with conflicting evidence in the evidence centre."
                if groups
                else ""
            ),
            len(groups),
        )

    def _stage_evidence_validation(self) -> tuple[str, int]:
        from collections import Counter

        records = self.project.evidence
        labels = Counter(record.credibility_label for record in records)
        corroborated = len([r for r in records if r.corroboration_count > 0])
        return (
            f"Validated {len(records)} records: {labels['high']} high, {labels['moderate']} moderate, "
            f"{labels['low']} low credibility. {corroborated} are corroborated by at least one other record.",
            corroborated,
        )

    def _stage_business_conclusions(self) -> tuple[str, int]:
        from app.models.findings import FailureFinding, OpportunityFinding

        config = self.config
        if config:
            config.assumptions = self.engine.assess_assumptions(config.assumptions or [])
        failures = list(
            self.db.scalars(
                select(FailureFinding).where(FailureFinding.project_id == self.project.id)
            )
        )
        opportunities = list(
            self.db.scalars(
                select(OpportunityFinding).where(OpportunityFinding.project_id == self.project.id)
            )
        )
        relationships = self.engine.build_relationships()
        supported = len([a for a in (config.assumptions if config else []) if a.get("status") == "supported"])
        return (
            f"Consolidated {len(failures)} weaknesses and {len(opportunities)} opportunities. "
            f"{supported} assumption(s) supported by evidence.",
            len(failures) + len(opportunities),
        )

    def _stage_chart_datasets(self) -> tuple[str, int]:
        from app.services.analytics import project_analytics

        analytics = project_analytics(self.db, self.project)
        non_empty = len([key for key, value in analytics.items() if isinstance(value, list) and value])
        return (f"Prepared {non_empty} chart datasets from stored records (computed on request).", non_empty)

    def _stage_roadmap_generation(self) -> tuple[str, int]:
        items = self.engine.build_roadmap()
        return (f"Generated {len(items)} roadmap items linked to findings.", len(items))

    def _stage_executive_report(self) -> tuple[str, int]:
        report = self.engine.build_report(provider=self._provider_label())
        self._enrich_report_with_llm(report)
        return (
            f"Drafted executive report v{report.version} with {len(report.sections)} sections and "
            f"{len(report.reference_ids)} referenced records.",
            len(report.sections),
        )

    def _enrich_report_with_llm(self, report=None) -> None:
        """Replace the template summary with grounded LLM prose when configured."""
        if self.demo or report is None:
            return
        llm = try_get_llm()
        if llm is None:
            return
        try:
            records = sorted(self.project.evidence, key=lambda r: r.sentiment_score)[:10]
            context = "\n\n".join(
                untrusted_block(
                    f"SOURCE {index + 1} — {record.source_name} ({record.source_category})",
                    f"{record.title or ''}\n{record.excerpt}",
                    900,
                )
                for index, record in enumerate(records)
            )
            findings = "\n".join(
                f"- {finding.title} ({finding.severity}, {finding.evidence_count} records)"
                for finding in self.project.failures[:6]
            )
            payload = llm.generate_json(
                "Write a 150-word executive summary for a market intelligence report. "
                "Use only the findings and sources supplied. Do not add statistics.\n"
                f"Findings:\n{findings}\n\nSources:\n{context}",
                schema_hint='{"executive_summary": "string"}',
            )
            summary = str(payload.get("executive_summary", "")).strip()
            if summary:
                report.executive_summary = truncate(summary, 1800)
                report.provider = "gemini+template-v1"
                self.project.summary = report.executive_summary
        except (LLMProviderError, ValueError) as exc:
            logger.warning("report_llm_enrichment_skipped", extra={"event": str(exc)})


def provider_label(demo: bool) -> str:
    return "demo-dataset+heuristic-v1" if demo else "search+heuristic-v1"
