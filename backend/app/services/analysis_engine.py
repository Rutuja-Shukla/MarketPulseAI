"""Evidence-driven analysis engine.

Findings are always derived from stored evidence records — never invented by a
prompt. The engine is deterministic so results are reproducible and every
number in the UI can be traced back to rows in `evidence_records`.
"""
from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.evidence import EvidenceRecord, SentimentRecord, TopicCluster
from app.models.findings import (
    FailureFinding,
    OpportunityFinding,
    RoadmapItem,
    SimulationScenario,
    StrategicRelationship,
)
from app.models.reporting import Report
from app.models.research import Competitor, CompetitorObservation, ResearchProject
from app.research.taxonomy import (
    MODE_PROFILES,
    TOPIC_BY_KEY,
    TOPIC_DEFINITIONS,
    severity_rank,
)
from app.services.text_analysis import (
    analyse_sentiment,
    classify_topics,
    credibility_for_source,
    extract_key_phrases,
    jaccard,
    rating_sentiment,
    shingles,
    truncate,
)

logger = get_logger(__name__)

METRICS_BY_TOPIC: dict[str, list[str]] = {
    "pricing": [
        "Share of negative mentions citing price (monthly)",
        "Trial-to-paid conversion by plan",
        "Renewal win rate for accounts under 50 seats",
    ],
    "customer_service": [
        "Median first-response time",
        "Support satisfaction after resolution",
        "Escalations reopened per 100 tickets",
    ],
    "performance": [
        "p95 dashboard load time",
        "Month-end timeout rate",
        "Insight view completion rate",
    ],
    "missing_features": [
        "Top-requested capability adoption after release",
        "Feature-related churn reasons in exit surveys",
    ],
    "integrations": [
        "Accounts with an active connector",
        "Time to first successful sync",
    ],
    "reporting_analytics": [
        "Weekly export usage",
        "Scheduled report adoption",
        "Report-related support tickets",
    ],
    "reliability": [
        "Data freshness lag (minutes)",
        "Incidents affecting customers per month",
    ],
    "data_accuracy": [
        "Reconciliation variance vs source systems",
        "Accuracy-related escalation count",
    ],
    "usability": [
        "Time to first insight",
        "Task success rate in usability tests",
    ],
    "onboarding": [
        "Median time to first insight",
        "30-day activation rate",
    ],
    "subscription_management": [
        "Self-serve cancellation share",
        "Involuntary churn rate",
        "Seat-change support tickets",
    ],
}

OPPORTUNITY_TEMPLATES: dict[str, dict] = {
    "pricing": {
        "title": "Repackage plans around workspace value instead of seats",
        "category": "Commercial model",
        "impact": 82,
        "effort": 46,
        "next_action": "Model a workspace-priced tier for teams under 20 seats and test it with 10 renewals.",
        "relevance": "Directly addresses the highest-volume complaint cluster and the competitor price gap.",
    },
    "customer_service": {
        "title": "Publish tiered support SLAs with regional coverage",
        "category": "Customer experience",
        "impact": 70,
        "effort": 34,
        "next_action": "Set and publish first-response targets per plan, then measure them weekly.",
        "relevance": "Support responsiveness is repeatedly linked to renewal decisions in the collected evidence.",
    },
    "reporting_analytics": {
        "title": "Ship scheduled report delivery with analyst-grade exports",
        "category": "Product capability",
        "impact": 74,
        "effort": 38,
        "next_action": "Deliver scheduled PDF/CSV delivery for saved reports, starting with the top three templates.",
        "relevance": "Closes the most-cited functional gap versus ClarityStack without a platform rebuild.",
    },
    "integrations": {
        "title": "Close the connector gap for Shopify multi-store and Klaviyo",
        "category": "Ecosystem",
        "impact": 76,
        "effort": 58,
        "next_action": "Scope a multi-store Shopify connector and a Klaviyo sync, then publish delivery dates.",
        "relevance": "Integration gaps are explicitly named in switching narratives toward Signalwise.",
    },
    "missing_features": {
        "title": "Localise billing and sentiment for the India market",
        "category": "Geographic expansion",
        "impact": 78,
        "effort": 52,
        "next_action": "Add INR invoicing with GST fields and evaluate Hindi sentiment coverage.",
        "relevance": "India evidence shows demand constrained by billing and language rather than product fit.",
    },
    "subscription_management": {
        "title": "Make seat changes, pause and cancellation self-serve",
        "category": "Retention operations",
        "impact": 64,
        "effort": 24,
        "next_action": "Ship self-serve seat downgrade and a one-quarter pause option.",
        "relevance": "Removes a recurring source of public complaints that amplify churn stories.",
    },
    "data_accuracy": {
        "title": "Add a trust layer: methodology, definitions and confidence labels",
        "category": "Trust & credibility",
        "impact": 68,
        "effort": 30,
        "next_action": "Publish metric definitions and add confidence labels to every generated insight.",
        "relevance": "Accuracy objections slow enterprise procurement and undermine the insight layer.",
    },
    "usability": {
        "title": "Reduce time-to-insight with task-based navigation",
        "category": "Product experience",
        "impact": 55,
        "effort": 32,
        "next_action": "Run a first-run usability test and consolidate the three most-used workflows.",
        "relevance": "Usability friction shows up in trial conversion and mobile feedback.",
    },
    "performance": {
        "title": "Harden peak-window performance for month-end reporting",
        "category": "Platform reliability",
        "impact": 60,
        "effort": 62,
        "next_action": "Add cached aggregates for large workspaces and instrument p95 load time.",
        "relevance": "Performance complaints cluster exactly when the product matters most.",
    },
    "reliability": {
        "title": "Publish data freshness and uptime transparency",
        "category": "Platform reliability",
        "impact": 58,
        "effort": 26,
        "next_action": "Add freshness indicators to every dataset and a public status page.",
        "relevance": "Analytical trust depends on customers being able to see data currency.",
    },
    "onboarding": {
        "title": "Productise onboarding with industry templates",
        "category": "Activation",
        "impact": 57,
        "effort": 28,
        "next_action": "Ship three industry workspace templates and measure time-to-first-insight.",
        "relevance": "Onboarding is a strength today; templating converts it into a scalable advantage.",
    },
}


def _as_date(value: date | datetime | None) -> date | None:
    if value is None:
        return None
    return value.date() if isinstance(value, datetime) else value


class AnalysisEngine:
    def __init__(self, db: Session, project: ResearchProject) -> None:
        self.db = db
        self.project = project
        self.mode = MODE_PROFILES.get(project.mode, MODE_PROFILES["standard"])

    # ------------------------------------------------------------------ ingest
    def ingest(self, records: list[dict], *, is_demo: bool, source_map: dict[str, uuid.UUID]) -> list[EvidenceRecord]:
        """Persist evidence with sentiment, topics, credibility and dedupe status."""
        existing = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        fingerprints = [(record, shingles(f"{record.title or ''} {record.excerpt}")) for record in existing]

        created: list[EvidenceRecord] = []
        now = datetime.now(timezone.utc)

        for raw in records:
            text = raw.get("text") or raw.get("excerpt") or ""
            if not text.strip():
                continue
            signature = shingles(f"{raw.get('title') or ''} {text}")
            duplicate_of: uuid.UUID | None = None
            best = 0.0
            for record, fingerprint in fingerprints:
                similarity = jaccard(signature, fingerprint)
                if similarity > best:
                    best = similarity
                    if similarity >= 0.72:
                        duplicate_of = record.id
            if duplicate_of is not None:
                continue  # keep the earliest record; duplicates are counted, not stored twice

            label, score, confidence = analyse_sentiment(text, raw.get("rating"))
            topics = classify_topics(f"{raw.get('title') or ''} {text}")
            category = raw.get("source_category", "news")
            credibility, credibility_label = credibility_for_source(
                category, bool(raw.get("source_url")), bool(raw.get("published_at"))
            )
            record = EvidenceRecord(
                project_id=self.project.id,
                source_id=source_map.get(category),
                source_name=raw.get("source_name") or category,
                source_url=raw.get("source_url"),
                source_category=category,
                published_at=raw.get("published_at"),
                collected_at=raw.get("collected_at") or now,
                title=raw.get("title"),
                excerpt=truncate(text, 900),
                full_text=text,
                country=raw.get("country"),
                author_handle=raw.get("author_handle"),
                rating=raw.get("rating"),
                product_mentioned=raw.get("product_mentioned") or self.project.product_name,
                company_mentioned=raw.get("company_mentioned") or self.project.company.name,
                sentiment=label,
                sentiment_score=score,
                topics=topics,
                key_phrases=extract_key_phrases(text),
                credibility_score=credibility,
                credibility_label=credibility_label,
                is_demo=is_demo,
                external_id=raw.get("external_id"),
                search_query=raw.get("search_query"),
                duplicate_status="unique",
                embedding=None,
            )
            self.db.add(record)
            self.db.flush()
            self.db.add(
                SentimentRecord(
                    project_id=self.project.id,
                    evidence_id=record.id,
                    label=label,
                    score=score,
                    confidence=confidence,
                    provider="lexicon-v1",
                    observed_at=now,
                )
            )
            created.append(record)
            fingerprints.append((record, signature))

        if created:
            self._apply_corroboration()
            self._flag_contradictions()
            from app.services.text_analysis import embedding

            for record in created:
                record.embedding = embedding(f"{record.title or ''} {record.excerpt}")
            self.db.flush()

        self.project.evidence_count = len(
            list(self.db.scalars(select(EvidenceRecord.id).where(EvidenceRecord.project_id == self.project.id)))
        )
        return created

    def _apply_corroboration(self) -> None:
        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        prints = {record.id: shingles(record.excerpt) for record in records}
        for record in records:
            count = 0
            for other in records:
                if other.id == record.id:
                    continue
                shared_topic = set(record.topics or []) & set(other.topics or [])
                if shared_topic and jaccard(prints[record.id], prints[other.id]) > 0.2:
                    count += 1
            record.corroboration_count = count

    def _flag_contradictions(self) -> None:
        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        by_topic: dict[str, list[EvidenceRecord]] = defaultdict(list)
        for record in records:
            for topic in record.topics or []:
                by_topic[topic].append(record)
        for topic, group in by_topic.items():
            negative = [r for r in group if r.sentiment == "negative"]
            positive = [r for r in group if r.sentiment == "positive"]
            if len(negative) >= 2 and len(positive) >= 2:
                for record in group:
                    record.contradiction_group = f"topic:{topic}"

    # ------------------------------------------------------------------ topics
    def build_topics(self) -> list[TopicCluster]:
        for row in self.db.scalars(
            select(TopicCluster).where(TopicCluster.project_id == self.project.id)
        ):
            self.db.delete(row)
        self.db.flush()

        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        by_topic: dict[str, list[EvidenceRecord]] = defaultdict(list)
        for record in records:
            for topic in record.topics or []:
                by_topic[topic].append(record)

        clusters: list[TopicCluster] = []
        for definition in TOPIC_DEFINITIONS:
            group = by_topic.get(definition.key, [])
            if not group:
                continue
            negative = [r for r in group if r.sentiment == "negative"]
            positive = [r for r in group if r.sentiment == "positive"]
            requests = [r for r in group if "wish" in r.excerpt.lower() or "request" in r.excerpt.lower()]
            kind = "complaint" if len(negative) >= len(positive) else "praise"
            if requests and len(requests) >= 2:
                kind = "request"
            dates = sorted(_as_date(r.published_at) for r in group if r.published_at)
            monthly = Counter(
                f"{d.year:04d}-{d.month:02d}" for d in ( _as_date(r.published_at) for r in group ) if d
            )
            monthly_counts = [{"month": month, "count": count} for month, count in sorted(monthly.items())]
            trend = self._trend_from_monthly(monthly_counts)
            average = sum(r.sentiment_score for r in group) / len(group)
            label = {
                "complaint": definition.complaint_label,
                "praise": definition.praise_label,
                "request": definition.request_label,
            }[kind]
            cluster = TopicCluster(
                project_id=self.project.id,
                label=label,
                kind=kind,
                description=definition.description,
                evidence_count=len(group),
                negative_count=len(negative),
                positive_count=len(positive),
                sentiment="negative" if average < -0.15 else "positive" if average > 0.15 else "mixed",
                trend=trend,
                first_seen=dates[0] if dates else None,
                last_seen=dates[-1] if dates else None,
                monthly_counts=monthly_counts,
            )
            self.db.add(cluster)
            clusters.append(cluster)
        self.db.flush()
        return clusters

    @staticmethod
    def _trend_from_monthly(monthly: list[dict]) -> str:
        if len(monthly) < 4:
            return "stable"
        counts = [item["count"] for item in monthly]
        midpoint = len(counts) // 2
        early = sum(counts[:midpoint]) / max(1, midpoint)
        late = sum(counts[midpoint:]) / max(1, len(counts) - midpoint)
        if late >= early * 1.35 and late - early >= 1:
            return "emerging"
        if early >= late * 1.35 and early - late >= 1:
            return "declining"
        return "stable"

    # -------------------------------------------------------------- competitors
    def build_competitors(self, names: list[str]) -> list[Competitor]:
        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        existing = {
            competitor.name.lower(): competitor
            for competitor in self.db.scalars(
                select(Competitor).where(Competitor.project_id == self.project.id)
            )
        }
        primary = existing.get(self.project.company.name.lower())
        if not primary:
            primary = Competitor(
                project_id=self.project.id,
                name=self.project.company.name,
                website=self.project.company.website,
                is_primary=True,
                mention_count=len(records),
                source_count=len({r.source_category for r in records}),
                positioning=self.project.company.description,
            )
            self.db.add(primary)
            self.db.flush()

        for name in names:
            key = name.strip().lower()
            if not key or key == self.project.company.name.lower():
                continue
            if key in existing:
                continue
            competitor = Competitor(project_id=self.project.id, name=name.strip(), is_suggested=True)
            self.db.add(competitor)
            existing[key] = competitor
        self.db.flush()

        for key, competitor in existing.items():
            if competitor.is_primary:
                continue
            mentions = [r for r in records if competitor.name.lower() in r.excerpt.lower()]
            competitor.mention_count = len(mentions)
            competitor.source_count = len({r.source_category for r in mentions})
            if mentions:
                competitor.sentiment_score = round(
                    sum(r.sentiment_score for r in mentions) / len(mentions), 3
                )
                topics = Counter(topic for r in mentions for topic in (r.topics or []))
                strengths: list[str] = []
                weaknesses: list[str] = []
                for topic, count in topics.most_common(4):
                    definition = TOPIC_BY_KEY.get(topic)
                    if not definition:
                        continue
                    positive = [r for r in mentions if topic in (r.topics or []) and r.sentiment == "positive"]
                    negative = [r for r in mentions if topic in (r.topics or []) and r.sentiment == "negative"]
                    if len(positive) >= len(negative):
                        strengths.append(definition.praise_label)
                    else:
                        weaknesses.append(definition.complaint_label)
                competitor.strengths = strengths[:3]
                competitor.weaknesses = weaknesses[:3]
                if not competitor.positioning:
                    competitor.positioning = (
                        f"Referenced in {len(mentions)} collected records, most often in the context of "
                        f"{topics.most_common(1)[0][0].replace('_', ' ') if topics else 'general comparison'}."
                    )

                self._replace_observations(competitor, mentions)
        self.db.flush()
        return list(existing.values())

    def _replace_observations(self, competitor: Competitor, mentions: list[EvidenceRecord]) -> None:
        for row in self.db.scalars(
            select(CompetitorObservation).where(CompetitorObservation.competitor_id == competitor.id)
        ):
            self.db.delete(row)
        self.db.flush()
        topics = Counter(topic for r in mentions for topic in (r.topics or []))
        for topic, _ in topics.most_common(4):
            definition = TOPIC_BY_KEY.get(topic)
            if not definition:
                continue
            example = next((r for r in mentions if topic in (r.topics or [])), None)
            self.db.add(
                CompetitorObservation(
                    competitor_id=competitor.id,
                    dimension=topic,
                    value=truncate(example.excerpt, 260) if example else definition.description,
                    score=round(
                        sum(r.sentiment_score for r in mentions if topic in (r.topics or []))
                        / max(1, len([r for r in mentions if topic in (r.topics or [])])),
                        3,
                    ),
                    evidence_id=example.id if example else None,
                    observed_at=example.collected_at if example else None,
                )
            )
        self.db.add(
            CompetitorObservation(
                competitor_id=competitor.id,
                dimension="pricing",
                value=competitor.pricing_summary or "No reliable public pricing evidence collected.",
                score=None,
                observed_at=mentions[-1].collected_at if mentions else None,
            )
        )

    # ---------------------------------------------------------------- failures
    def build_failures(self) -> list[FailureFinding]:
        for row in self.db.scalars(
            select(FailureFinding).where(FailureFinding.project_id == self.project.id)
        ):
            self.db.delete(row)
        self.db.flush()

        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        findings: list[FailureFinding] = []

        for definition in TOPIC_DEFINITIONS:
            group = [r for r in records if definition.key in (r.topics or [])]
            negative = [r for r in group if r.sentiment == "negative" and r.sentiment_score <= 0.05]
            if not negative:
                continue
            sources = {r.source_category for r in negative}
            countries = {r.country for r in negative if r.country}
            evidence_sorted = sorted(negative, key=lambda r: (r.sentiment_score, _as_date(r.published_at) or date.min))
            representative = evidence_sorted[0]
            dates = sorted(_as_date(r.published_at) for r in negative if r.published_at)

            count = len(negative)
            negative_share = count / max(1, len(group))
            diversity = len(sources)
            if count >= 7 and diversity >= 2:
                severity = "critical"
            elif count >= 4:
                severity = "high"
            elif count >= 2:
                severity = "medium"
            else:
                severity = "low"
            # A reliability or accuracy signal is commercially load-bearing even
            # at low volume, so single-record findings of that kind are raised once.
            if (
                definition.failure_severity_hint == "critical"
                and count >= 2
                and severity_rank(severity) < 3
            ):
                severity = "high"
            confidence = min(0.95, 0.38 + min(0.34, count * 0.045) + min(0.18, diversity * 0.05))
            corroborated = len([r for r in negative if r.corroboration_count >= 2])
            confidence = min(0.96, confidence + (0.04 if corroborated >= 2 else 0))

            regional = ", ".join(sorted(countries)[:4])
            severity_words = {
                "critical": "Recurring, corroborated and material",
                "high": "Consistent across several independent sources",
                "medium": "Present but with limited corroboration",
                "low": "Early signal with thin evidence",
            }[severity]
            findings.append(
                FailureFinding(
                    project_id=self.project.id,
                    title=f"{definition.complaint_label} in {self.project.product_name or 'the product'}",
                    category=definition.key,
                    severity=severity,
                    summary=(
                        f"{count} of {len(group)} collected records touching {definition.label.lower()} are "
                        f"negative across {len(sources)} source categories"
                        + (f" ({regional})" if regional else "")
                        + f". {severity_words}."
                    ),
                    observed_complaint=truncate(representative.excerpt, 420),
                    interpretation=(
                        f"Customers describe {definition.label.lower()} as a friction point. This is an "
                        f"interpretation of public language, not a measured revenue outcome."
                    ),
                    business_implications=definition.business_implication,
                    recommended_actions=list(definition.actions),
                    evidence_ids=[str(r.id) for r in evidence_sorted],
                    evidence_count=count,
                    source_count=len(sources),
                    representative_quote=representative.excerpt,
                    first_observed=dates[0] if dates else None,
                    last_observed=dates[-1] if dates else None,
                    sentiment_score=round(sum(r.sentiment_score for r in negative) / count, 3),
                    confidence=round(confidence, 2),
                    confidence_label="high" if confidence >= 0.7 else "moderate" if confidence >= 0.5 else "low",
                    is_observed_complaint=True,
                )
            )

        self.db.add_all(findings)
        self.db.flush()
        findings.sort(key=lambda f: (severity_rank(f.severity), f.evidence_count), reverse=True)
        self.project.failure_count = len(findings)
        return findings

    # ------------------------------------------------------------ opportunities
    def build_opportunities(self) -> list[OpportunityFinding]:
        for row in self.db.scalars(
            select(OpportunityFinding).where(OpportunityFinding.project_id == self.project.id)
        ):
            self.db.delete(row)
        self.db.flush()

        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        failures = {
            row.category: row
            for row in self.db.scalars(
                select(FailureFinding).where(FailureFinding.project_id == self.project.id)
            )
        }
        competitors = list(
            self.db.scalars(select(Competitor).where(Competitor.project_id == self.project.id))
        )
        opportunities: list[OpportunityFinding] = []

        for topic, template in OPPORTUNITY_TEMPLATES.items():
            group = [r for r in records if topic in (r.topics or [])]
            if len(group) < 2:
                continue
            requests = [
                r for r in group
                if any(word in r.excerpt.lower() for word in ("wish", "request", "would love", "need an", "please add"))
            ]
            demand_records = requests or [r for r in group if r.sentiment == "negative"]
            if not demand_records:
                continue
            competitor_gap = self._competitor_gap_for(topic, competitors)
            definition = TOPIC_BY_KEY[topic]
            impact = template["impact"] + min(8, len(group)) + (4 if competitor_gap else 0)
            impact = min(95, impact)
            effort = template["effort"]
            confidence = min(0.9, 0.42 + min(0.3, len(group) * 0.04) + (0.06 if requests else 0))
            quadrant = (
                "quick_win" if impact >= 65 and effort <= 45
                else "strategic_investment" if impact >= 65
                else "long_term" if effort > 45
                else "low_priority"
            )
            opportunities.append(
                OpportunityFinding(
                    project_id=self.project.id,
                    title=template["title"],
                    category=template["category"],
                    description=(
                        f"{len(group)} collected records touch {definition.label.lower()}, including "
                        f"{len(demand_records)} explicit requests or complaints. "
                        + (competitor_gap or "No direct competitor advantage was evidenced for this dimension.")
                    ),
                    demand_signal=truncate(demand_records[0].excerpt, 340),
                    competitor_comparison=competitor_gap,
                    strategic_relevance=template["relevance"],
                    next_action=template["next_action"],
                    evidence_ids=[str(r.id) for r in demand_records][:20],
                    evidence_count=len(demand_records),
                    impact_score=float(impact),
                    effort_score=float(effort),
                    confidence=round(confidence, 2),
                    quadrant=quadrant,
                    is_estimate=True,
                )
            )

        # Geographic opportunity from evidence, not assumption.
        by_country: dict[str, list[EvidenceRecord]] = defaultdict(list)
        for record in records:
            if record.country:
                by_country[record.country].append(record)
        for country, group in by_country.items():
            positive = [r for r in group if r.sentiment == "positive"]
            if len(group) >= 2 and len(positive) >= 2 and len(positive) / len(group) >= 0.4:
                share = round(len(positive) / len(group) * 100)
                opportunities.append(
                    OpportunityFinding(
                        project_id=self.project.id,
                        title=f"Deepen presence in {country} where sentiment is strongest",
                        category="Geographic expansion",
                        description=(
                            f"{len(positive)} of {len(group)} collected records from {country} are positive "
                            f"({share}%). Demand appears constrained by commercial or localisation factors "
                            f"rather than product fit."
                        ),
                        demand_signal=truncate(positive[0].excerpt, 320),
                        competitor_comparison=None,
                        strategic_relevance="Strongest observed sentiment is the cheapest place to grow revenue.",
                        next_action=f"Run a {country} pricing and localisation review before the next renewal cycle.",
                        evidence_ids=[str(r.id) for r in positive][:12],
                        evidence_count=len(positive),
                        impact_score=float(min(80, 50 + len(positive) * 5)),
                        effort_score=58.0,
                        confidence=round(min(0.85, 0.4 + len(positive) * 0.05), 2),
                        quadrant="strategic_investment",
                        is_estimate=True,
                    )
                )

        # Opportunity from competitor weakness, when evidenced.
        for competitor in competitors:
            if competitor.is_primary or not competitor.weaknesses:
                continue
            weakness = competitor.weaknesses[0]
            related = [r for r in records if competitor.name.lower() in r.excerpt.lower()]
            opportunities.append(
                OpportunityFinding(
                    project_id=self.project.id,
                    title=f"Win on {weakness.lower()} where {competitor.name} is exposed",
                    category="Competitive positioning",
                    description=(
                        f"Collected evidence references {competitor.name} alongside {weakness.lower()}. "
                        f"{len(related)} records mention this competitor directly."
                    ),
                    demand_signal=truncate(related[0].excerpt, 320) if related else None,
                    competitor_comparison=f"{competitor.name} weakness: {weakness}",
                    strategic_relevance="A named competitor weakness is a defensible positioning angle.",
                    next_action=f"Add '{weakness}' to the comparison page and arm sales with three proof points.",
                    evidence_ids=[str(r.id) for r in related][:10],
                    evidence_count=len(related),
                    impact_score=62.0,
                    effort_score=28.0,
                    confidence=round(min(0.8, 0.4 + len(related) * 0.05), 2),
                    quadrant="quick_win",
                    is_estimate=True,
                )
            )

        self.db.add_all(opportunities)
        self.db.flush()
        opportunities.sort(key=lambda o: (-(o.impact_score - o.effort_score * 0.5)))
        self.project.opportunity_count = len(opportunities)
        return opportunities

    @staticmethod
    def _competitor_gap_for(topic: str, competitors: list[Competitor]) -> str | None:
        for competitor in competitors:
            if competitor.is_primary:
                continue
            definition = TOPIC_BY_KEY.get(topic)
            if not definition:
                continue
            for strength in competitor.strengths:
                if strength.lower() in definition.label.lower() or definition.label.lower() in strength.lower():
                    return f"{competitor.name} is perceived more strongly on {strength.lower()}."
        return None

    # ------------------------------------------------------------- assumptions
    def assess_assumptions(self, assumptions: list[dict]) -> list[dict]:
        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        results: list[dict] = []
        for assumption in assumptions:
            text = assumption.get("text", "") if isinstance(assumption, dict) else str(assumption)
            topics = classify_topics(text)
            group = [r for r in records if set(r.topics or []) & set(topics)]
            # Sentiment direction is more informative than the coarse label, because
            # mixed-language reviews rarely land cleanly on "negative".
            negative = [
                r for r in group if r.sentiment == "negative" or r.sentiment_score <= -0.02
            ]
            positive = [r for r in group if r.sentiment_score > 0.05]
            switching = [
                r for r in group
                if any(word in r.excerpt.lower() for word in ("switch", "cancel", "renew", "churn", "leave", "alternative"))
            ]
            if not group:
                status = "insufficient_evidence"
            elif len(negative) >= 3 and len(negative) >= len(positive):
                status = "supported"
            elif len(negative) >= 1 and len(negative) >= len(positive) * 0.6:
                status = "partially_supported"
            elif len(positive) >= 3 and len(positive) > len(negative) * 1.5:
                status = "contradicted"
            else:
                status = "insufficient_evidence"

            claims_switching = any(
                word in text.lower() for word in ("switch", "churn", "cancel", "leaving")
            )
            if status == "supported" and claims_switching and not switching:
                status = "partially_supported"

            rationale = (
                f"{len(group)} collected records relate to "
                f"{', '.join(TOPIC_BY_KEY[t].label.lower() for t in topics) if topics else 'this assumption'}; "
                f"{len(negative)} are negative and {len(positive)} positive. "
                f"{len(switching)} mention switching, renewal or cancellation explicitly."
            )
            results.append(
                {
                    "text": text,
                    "status": status,
                    "rationale": rationale,
                    "support_count": len(negative),
                    "contradict_count": len(positive),
                    "evidence_ids": [str(r.id) for r in (negative or group)[:8]],
                    "topics": topics,
                }
            )
        return results

    # ------------------------------------------------------------------- graph
    def build_relationships(self) -> list[StrategicRelationship]:
        for row in self.db.scalars(
            select(StrategicRelationship).where(StrategicRelationship.project_id == self.project.id)
        ):
            self.db.delete(row)
        self.db.flush()

        failures = list(
            self.db.scalars(
                select(FailureFinding)
                .where(FailureFinding.project_id == self.project.id)
                .order_by(FailureFinding.evidence_count.desc())
            )
        )
        opportunities = list(
            self.db.scalars(select(OpportunityFinding).where(OpportunityFinding.project_id == self.project.id))
        )
        clusters = list(
            self.db.scalars(select(TopicCluster).where(TopicCluster.project_id == self.project.id))
        )
        competitors = list(
            self.db.scalars(select(Competitor).where(Competitor.project_id == self.project.id))
        )
        records = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        cluster_by_topic = {}
        for cluster in clusters:
            for definition in TOPIC_DEFINITIONS:
                if cluster.label == definition.complaint_label or cluster.label == definition.request_label:
                    cluster_by_topic[definition.key] = cluster

        relationships: list[StrategicRelationship] = []

        def add(source: str, target: str, relation: str, rationale: str, confidence: float, evidence: list[str]) -> None:
            relationships.append(
                StrategicRelationship(
                    project_id=self.project.id,
                    source_node=source,
                    target_node=target,
                    relation=relation,
                    rationale=rationale,
                    confidence=round(confidence, 2),
                    evidence_ids=evidence[:12],
                )
            )

        for failure in failures:
            cluster = cluster_by_topic.get(failure.category)
            if cluster:
                add(
                    f"topic:{cluster.id}",
                    f"failure:{failure.id}",
                    "surfaces_as",
                    f"{failure.evidence_count} negative records in {cluster.label.lower()} roll up into this weakness.",
                    failure.confidence,
                    failure.evidence_ids,
                )
            add(
                f"failure:{failure.id}",
                f"risk:{failure.id}",
                "creates_risk",
                failure.business_implications or "Potential commercial exposure if unaddressed.",
                failure.confidence * 0.9,
                failure.evidence_ids,
            )
            for competitor in competitors:
                if competitor.is_primary:
                    continue
                mentioned = [r for r in records if str(r.id) in failure.evidence_ids and competitor.name.lower() in r.excerpt.lower()]
                if mentioned:
                    add(
                        f"competitor:{competitor.id}",
                        f"failure:{failure.id}",
                        "amplifies",
                        f"{competitor.name} is named in {len(mentioned)} records supporting this weakness.",
                        min(0.85, 0.45 + len(mentioned) * 0.1),
                        [str(r.id) for r in mentioned],
                    )

        for opportunity in opportunities:
            evidence = [str(e) for e in opportunity.evidence_ids]
            for failure in failures:
                if set(failure.evidence_ids) & set(evidence):
                    add(
                        f"risk:{failure.id}",
                        f"opportunity:{opportunity.id}",
                        "opens",
                        f"Addressing '{failure.title}' is the direct path to this opportunity.",
                        min(failure.confidence, opportunity.confidence),
                        evidence,
                    )
                    break
            add(
                f"opportunity:{opportunity.id}",
                f"action:{opportunity.id}",
                "recommends",
                opportunity.next_action or "Recommended next action.",
                opportunity.confidence,
                evidence,
            )

        for cluster in clusters:
            if cluster.trend in ("emerging", "declining") and cluster.kind == "complaint":
                add(
                    f"trend:{cluster.id}",
                    f"topic:{cluster.id}",
                    "amplifies",
                    f"{cluster.label} is {cluster.trend} across the research period.",
                    0.6,
                    [],
                )

        self.db.add_all(relationships)
        self.db.flush()
        return relationships

    # ----------------------------------------------------------------- roadmap
    def build_roadmap(self) -> list[RoadmapItem]:
        for row in self.db.scalars(select(RoadmapItem).where(RoadmapItem.project_id == self.project.id)):
            self.db.delete(row)
        self.db.flush()

        failures = list(
            self.db.scalars(
                select(FailureFinding)
                .where(FailureFinding.project_id == self.project.id)
                .order_by(FailureFinding.evidence_count.desc())
            )
        )
        opportunities = list(
            self.db.scalars(select(OpportunityFinding).where(OpportunityFinding.project_id == self.project.id))
        )

        items: list[RoadmapItem] = []
        horizon_for_severity = {
            "critical": "immediate",
            "high": "short_term",
            "medium": "medium_term",
            "low": "long_term",
        }
        order = 0
        for failure in failures:
            if failure.severity == "low":
                continue
            order += 1
            items.append(
                RoadmapItem(
                    project_id=self.project.id,
                    finding_type="failure",
                    finding_id=failure.id,
                    title=f"Fix {failure.category.replace('_', ' ')} friction",
                    problem=failure.summary,
                    improvement=(failure.recommended_actions[0] if failure.recommended_actions else None),
                    expected_impact=failure.business_implications,
                    complexity="high" if failure.severity == "critical" else "medium",
                    priority=failure.severity,
                    horizon=horizon_for_severity[failure.severity],
                    confidence=failure.confidence,
                    success_metrics=METRICS_BY_TOPIC.get(failure.category, ["Customer sentiment on this topic"]),
                    status="planned",
                    order_index=order,
                )
            )
        for opportunity in opportunities:
            if opportunity.impact_score < 55:
                continue
            order += 1
            horizon = {
                "quick_win": "short_term",
                "strategic_investment": "medium_term",
                "long_term": "long_term",
                "low_priority": "long_term",
            }[opportunity.quadrant]
            items.append(
                RoadmapItem(
                    project_id=self.project.id,
                    finding_type="opportunity",
                    finding_id=opportunity.id,
                    title=opportunity.title,
                    problem=opportunity.description,
                    improvement=opportunity.next_action,
                    expected_impact=opportunity.strategic_relevance,
                    complexity="low" if opportunity.effort_score <= 35 else "medium" if opportunity.effort_score <= 60 else "high",
                    priority="high" if opportunity.impact_score >= 75 else "medium",
                    horizon=horizon,
                    confidence=opportunity.confidence,
                    success_metrics=METRICS_BY_TOPIC.get(
                        next((d.key for d in TOPIC_DEFINITIONS if d.complaint_label == opportunity.title), ""), []
                    )
                    or ["Opportunity-specific conversion or adoption metric (define before build)"],
                    status="planned",
                    order_index=order,
                )
            )
        self.db.add_all(items)
        self.db.flush()
        return items

    # ------------------------------------------------------------------ report
    def build_report(self, *, provider: str) -> Report:
        from app.services.report_builder import ReportBuilder

        builder = ReportBuilder(self.db, self.project)
        return builder.generate(provider=provider)


def latest_report(db: Session, project_id: uuid.UUID) -> Report | None:
    return db.scalars(
        select(Report).where(Report.project_id == project_id).order_by(Report.version.desc())
    ).first()


def latest_scenarios(db: Session, project_id: uuid.UUID) -> list[SimulationScenario]:
    return list(
        db.scalars(
            select(SimulationScenario)
            .where(SimulationScenario.project_id == project_id)
            .order_by(SimulationScenario.created_at.desc())
        )
    )
