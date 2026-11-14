"""Executive report composition from structured findings."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evidence import EvidenceRecord
from app.models.findings import FailureFinding, OpportunityFinding, RoadmapItem
from app.models.reporting import Report
from app.models.research import Competitor, ResearchProject
from app.research.taxonomy import TOPIC_BY_KEY
from app.services.text_analysis import truncate


class ReportBuilder:
    def __init__(self, db: Session, project: ResearchProject) -> None:
        self.db = db
        self.project = project

    def generate(self, *, provider: str) -> Report:
        project = self.project
        evidence = list(
            self.db.scalars(
                select(EvidenceRecord)
                .where(EvidenceRecord.project_id == project.id)
                .order_by(EvidenceRecord.published_at.desc())
            )
        )
        failures = list(
            self.db.scalars(
                select(FailureFinding)
                .where(FailureFinding.project_id == project.id)
                .order_by(FailureFinding.evidence_count.desc())
            )
        )
        opportunities = list(
            self.db.scalars(
                select(OpportunityFinding)
                .where(OpportunityFinding.project_id == project.id)
                .order_by(OpportunityFinding.impact_score.desc())
            )
        )
        roadmap = list(
            self.db.scalars(
                select(RoadmapItem)
                .where(RoadmapItem.project_id == project.id)
                .order_by(RoadmapItem.order_index)
            )
        )
        competitors = list(
            self.db.scalars(select(Competitor).where(Competitor.project_id == project.id))
        )
        config = project.configuration

        sentiment = Counter(r.sentiment for r in evidence)
        total = max(1, len(evidence))
        negative_share = round(sentiment["negative"] / total * 100)
        positive_share = round(sentiment["positive"] / total * 100)
        countries = Counter(r.country for r in evidence if r.country)
        sources = Counter(r.source_category for r in evidence)
        critical = [f for f in failures if f.severity == "critical"]
        top_failure = failures[0] if failures else None
        top_opportunity = opportunities[0] if opportunities else None

        assumption_results = []
        if config and config.assumptions:
            from app.services.analysis_engine import AnalysisEngine

            assumption_results = AnalysisEngine(self.db, project).assess_assumptions(config.assumptions)

        company = project.company
        scope = "global market" if config and config.global_scope else ", ".join(
            config.countries if config and config.countries else []
        )
        product = project.product_name or company.name

        executive_summary = (
            f"{company.name} operates in {company.industry or 'its category'} across {scope or 'selected markets'}. "
            f"This assessment draws on {len(evidence)} evidence records collected from {len(sources)} source "
            f"categories between "
            f"{(config.research_period_start if config else '') or 'the research window'} and "
            f"{(config.research_period_end if config else '') or 'today'}. "
            f"Sentiment is {positive_share}% positive and {negative_share}% negative. "
            + (
                f"The most material weakness is {top_failure.title.lower()} ({top_failure.severity} severity, "
                f"{top_failure.evidence_count} supporting records). "
                if top_failure
                else "No weakness crossed the evidence threshold in this run. "
            )
            + (
                f"The clearest opportunity is to {top_opportunity.title[0].lower() + top_opportunity.title[1:]} "
                f"(AI-assisted impact estimate {int(top_opportunity.impact_score)}/100)."
                if top_opportunity
                else "No opportunity met the evidence threshold in this run."
            )
            + (
                " Findings are illustrative because this project runs on the demonstration dataset."
                if project.is_demo
                else ""
            )
        )

        sections = [
            {
                "key": "company",
                "title": "Company and product overview",
                "type": "narrative",
                "body": (
                    f"{company.name} ({company.website or 'website not supplied'}) provides {product}. "
                    f"{company.description or ''} Target audience: {company.target_audience or 'not specified'}."
                ).strip(),
            },
            {
                "key": "market",
                "title": "Market situation",
                "type": "narrative",
                "body": (
                    f"Scope: {scope or 'not specified'}. "
                    f"Recorded situation: {(config.situation.replace('_', ' ') if config and config.situation else 'not specified')}. "
                    f"{config.situation_description if config and config.situation_description else ''} "
                    f"Evidence is distributed across {len(countries)} countries, led by "
                    f"{', '.join(f'{c} ({n})' for c, n in countries.most_common(3)) or 'unspecified regions'}."
                ).strip(),
            },
            {
                "key": "sentiment",
                "title": "Customer sentiment",
                "type": "metrics",
                "body": (
                    f"Of {len(evidence)} records, {sentiment['positive']} are positive, "
                    f"{sentiment['negative']} negative, {sentiment['neutral']} neutral and "
                    f"{sentiment['mixed']} mixed."
                ),
                "items": [
                    {"label": "Positive", "value": f"{positive_share}%"},
                    {"label": "Negative", "value": f"{negative_share}%"},
                    {"label": "Records", "value": str(len(evidence))},
                    {"label": "Source categories", "value": str(len(sources))},
                ],
            },
            {
                "key": "complaints",
                "title": "Key customer complaints",
                "type": "list",
                "body": "Ordered by volume of corroborating negative records.",
                "items": [
                    {
                        "title": f.title,
                        "meta": f"{f.severity.upper()} · {f.evidence_count} records · confidence {int(f.confidence * 100)}%",
                        "body": f.summary,
                        "quote": truncate(f.representative_quote or "", 260),
                    }
                    for f in failures[:6]
                ],
            },
            {
                "key": "weaknesses",
                "title": "Product weaknesses",
                "type": "list",
                "body": "Observed complaints, separated from their business interpretation.",
                "items": [
                    {
                        "title": f.title,
                        "meta": f.category.replace('_', ' '),
                        "body": f.interpretation or "",
                        "quote": f.business_implications or "",
                    }
                    for f in failures[:6]
                ],
            },
            {
                "key": "competitors",
                "title": "Competitor intelligence",
                "type": "list",
                "body": "Based only on records that name each competitor.",
                "items": [
                    {
                        "title": c.name + (" (primary)" if c.is_primary else ""),
                        "meta": f"{c.mention_count} mentions · sentiment {c.sentiment_score if c.sentiment_score is not None else 'n/a'}",
                        "body": c.positioning or "No positioning evidence collected.",
                        "quote": ("Strengths: " + ", ".join(c.strengths)) if c.strengths else "",
                    }
                    for c in competitors
                    if not c.is_primary
                ]
                or [{"title": "No competitor evidence", "meta": "", "body": "No competitor was named in the collected records.", "quote": ""}],
            },
            {
                "key": "opportunities",
                "title": "Growth opportunities",
                "type": "list",
                "body": "Impact and effort are AI-assisted assessments, not measured outcomes.",
                "items": [
                    {
                        "title": o.title,
                        "meta": f"impact {int(o.impact_score)} · effort {int(o.effort_score)} · {o.quadrant.replace('_', ' ')}",
                        "body": o.description,
                        "quote": o.next_action or "",
                    }
                    for o in opportunities[:6]
                ],
            },
            {
                "key": "risks",
                "title": "Market risks",
                "type": "list",
                "body": "Risks inferred from complaint patterns. They are not proven financial outcomes.",
                "items": [
                    {
                        "title": f"Risk from {f.category.replace('_', ' ')}",
                        "meta": f"{f.severity} severity · confidence {int(f.confidence * 100)}%",
                        "body": f.business_implications or "",
                        "quote": "",
                    }
                    for f in (critical or failures[:3])
                ],
            },
            {
                "key": "recommendations",
                "title": "Strategic recommendations",
                "type": "list",
                "body": "Each recommendation traces to a finding and its evidence record ids.",
                "items": [
                    {
                        "title": f"Address {f.category.replace('_', ' ')}",
                        "meta": f"{f.evidence_count} records",
                        "body": " ".join(f.recommended_actions),
                        "quote": "",
                    }
                    for f in failures[:4]
                ],
            },
            {
                "key": "roadmap",
                "title": "Priority roadmap",
                "type": "list",
                "body": "Sequenced from severity and estimated impact.",
                "items": [
                    {
                        "title": item.title,
                        "meta": f"{item.horizon.replace('_', ' ')} · {item.priority} priority",
                        "body": item.improvement or "",
                        "quote": "; ".join(item.success_metrics or []),
                    }
                    for item in roadmap[:8]
                ],
            },
            {
                "key": "assumptions",
                "title": "Assumption validation",
                "type": "list",
                "body": "Each assumption is tested against the collected evidence.",
                "items": [
                    {
                        "title": result["text"],
                        "meta": result["status"].replace("_", " ").upper(),
                        "body": result["rationale"],
                        "quote": "",
                    }
                    for result in assumption_results
                ]
                or [],
            },
            {
                "key": "references",
                "title": "Evidence and references",
                "type": "references",
                "body": f"{len(evidence)} records; the 20 most recent are listed.",
                "items": [
                    {
                        "title": record.title or truncate(record.excerpt, 90),
                        "meta": f"{record.source_name} · {record.published_at or 'undated'} · {record.sentiment}",
                        "url": record.source_url,
                        "body": truncate(record.excerpt, 220),
                    }
                    for record in evidence[:20]
                ],
            },
        ]

        limitations = [
            "Public conversations are self-selected and are not a representative sample of the customer base.",
            "Complaint volume is not revenue impact: no financial, churn or sales data was used.",
            "Impact, effort and confidence scores are AI-assisted estimates for prioritisation only.",
            (
                "DEMO DATA — this project uses a synthetic corpus. No live web research was performed."
                if project.is_demo
                else "Research is limited to sources reachable through the configured search provider."
            ),
            "Sentiment is classified with a transparent lexicon model; sarcasm and domain jargon may be misread.",
        ]

        previous = self.db.scalars(
            select(Report).where(Report.project_id == project.id).order_by(Report.version.desc())
        ).first()
        version = (previous.version + 1) if previous else 1
        report = Report(
            project_id=project.id,
            title=f"{company.name} — Market intelligence assessment",
            version=version,
            executive_summary=executive_summary,
            sections=sections,
            limitations=limitations,
            reference_ids=[str(r.id) for r in evidence[:40]],
            generated_at=datetime.now(timezone.utc),
            provider=provider,
            is_demo=project.is_demo,
        )
        self.db.add(report)
        project.summary = executive_summary
        self.db.flush()
        return report
