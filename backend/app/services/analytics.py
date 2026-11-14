"""Chart-ready aggregations computed from stored evidence and findings."""
from __future__ import annotations

import uuid
from collections import Counter, defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evidence import EvidenceRecord, TopicCluster
from app.models.findings import FailureFinding, OpportunityFinding
from app.models.research import Competitor, ResearchProject
from app.research.taxonomy import TOPIC_BY_KEY, TOPIC_DEFINITIONS


def _month(value) -> str | None:
    if value is None:
        return None
    return f"{value.year:04d}-{value.month:02d}"


def project_analytics(db: Session, project: ResearchProject) -> dict:
    evidence = list(
        db.scalars(
            select(EvidenceRecord)
            .where(EvidenceRecord.project_id == project.id)
            .order_by(EvidenceRecord.published_at.asc())
        )
    )
    failures = list(
        db.scalars(select(FailureFinding).where(FailureFinding.project_id == project.id))
    )
    opportunities = list(
        db.scalars(select(OpportunityFinding).where(OpportunityFinding.project_id == project.id))
    )
    competitors = list(
        db.scalars(select(Competitor).where(Competitor.project_id == project.id))
    )
    clusters = list(
        db.scalars(select(TopicCluster).where(TopicCluster.project_id == project.id))
    )

    # A. sentiment trend ------------------------------------------------------
    by_month: dict[str, Counter] = defaultdict(Counter)
    for record in evidence:
        month = _month(record.published_at)
        if month:
            by_month[month][record.sentiment] += 1
    sentiment_trend = {
        "months": sorted(by_month),
        "positive": [by_month[m]["positive"] for m in sorted(by_month)],
        "negative": [by_month[m]["negative"] for m in sorted(by_month)],
        "neutral": [by_month[m]["neutral"] + by_month[m]["mixed"] for m in sorted(by_month)],
    }

    # B. pain points ----------------------------------------------------------
    negative_by_topic = Counter()
    for record in evidence:
        if record.sentiment == "negative":
            for topic in record.topics or []:
                negative_by_topic[topic] += 1
    pain_points = [
        {"topic": TOPIC_BY_KEY[t].complaint_label, "key": t, "count": count}
        for t, count in negative_by_topic.most_common(8)
    ]

    # C. competitor benchmarking ---------------------------------------------
    dimensions = ["sentiment", "pricing", "support", "features", "reporting"]
    benchmark_series = []
    for competitor in competitors:
        if competitor.is_primary:
            related = evidence
        else:
            related = [r for r in evidence if competitor.name.lower() in r.excerpt.lower()]
        if not related and not competitor.is_primary:
            continue
        scores = {
            "sentiment": round(
                (sum(r.sentiment_score for r in related) / max(1, len(related)) + 1) * 50, 1
            ),
            "pricing": _dimension_score(related, "pricing", competitor),
            "support": _dimension_score(related, "customer_service", competitor),
            "features": _dimension_score(related, "missing_features", competitor),
            "reporting": _dimension_score(related, "reporting_analytics", competitor),
        }
        benchmark_series.append(
            {
                "name": competitor.name + (" (you)" if competitor.is_primary else ""),
                "is_primary": competitor.is_primary,
                "values": [scores[d] for d in dimensions],
                "mention_count": len(related) if not competitor.is_primary else len(evidence),
            }
        )

    # D. opportunity matrix ---------------------------------------------------
    opportunity_matrix = [
        {
            "id": str(o.id),
            "title": o.title,
            "impact": o.impact_score,
            "effort": o.effort_score,
            "quadrant": o.quadrant,
            "confidence": o.confidence,
        }
        for o in opportunities
    ]

    # E. geographic comparison ------------------------------------------------
    by_country: dict[str, list[EvidenceRecord]] = defaultdict(list)
    for record in evidence:
        if record.country:
            by_country[record.country].append(record)
    geography = []
    for country, group in sorted(by_country.items(), key=lambda item: -len(item[1])):
        average = sum(r.sentiment_score for r in group) / len(group)
        geography.append(
            {
                "country": country,
                "records": len(group),
                "sentiment": round(average, 3),
                "positive": len([r for r in group if r.sentiment == "positive"]),
                "negative": len([r for r in group if r.sentiment == "negative"]),
            }
        )

    # F. topic trends ---------------------------------------------------------
    topic_trends = [
        {
            "label": cluster.label,
            "trend": cluster.trend,
            "series": cluster.monthly_counts,
            "evidence_count": cluster.evidence_count,
            "kind": cluster.kind,
        }
        for cluster in clusters
    ]

    # G. source distribution --------------------------------------------------
    source_distribution = [
        {"source": source, "count": count}
        for source, count in Counter(r.source_category for r in evidence).most_common()
    ]

    # H. market signal timeline ----------------------------------------------
    timeline = []
    for record in sorted(evidence, key=lambda r: r.published_at or __import__("datetime").date.min):
        if record.published_at is None:
            continue
        timeline.append(
            {
                "date": record.published_at.isoformat(),
                "label": record.title or record.excerpt[:70],
                "category": record.source_category,
                "sentiment": record.sentiment,
                "source": record.source_name,
            }
        )

    severity_breakdown = Counter(f.severity for f in failures)
    return {
        "totals": {
            "evidence": len(evidence),
            "sources": len({r.source_category for r in evidence}),
            "countries": len(by_country),
            "failures": len(failures),
            "opportunities": len(opportunities),
            "competitors": len([c for c in competitors if not c.is_primary]),
            "positive": len([r for r in evidence if r.sentiment == "positive"]),
            "negative": len([r for r in evidence if r.sentiment == "negative"]),
            "neutral": len([r for r in evidence if r.sentiment in ("neutral", "mixed")]),
        },
        "sentiment_trend": sentiment_trend,
        "pain_points": pain_points,
        "benchmark_dimensions": dimensions,
        "benchmark_series": benchmark_series,
        "opportunity_matrix": opportunity_matrix,
        "geography": geography,
        "topic_trends": topic_trends,
        "source_distribution": source_distribution,
        "timeline": timeline,
        "severity_breakdown": [
            {"severity": s, "count": severity_breakdown.get(s, 0)}
            for s in ("critical", "high", "medium", "low")
        ],
    }


def _dimension_score(records: list[EvidenceRecord], topic: str, competitor: Competitor) -> float:
    related = [r for r in records if topic in (r.topics or [])]
    if contender := [c for c in competitor.weaknesses if TOPIC_BY_KEY.get(topic, None) and c == TOPIC_BY_KEY[topic].complaint_label]:
        return 42.0
    if not related:
        return 58.0
    average = sum(r.sentiment_score for r in related) / len(related)
    return round((average + 1) * 50, 1)


def dashboard_metrics(db: Session, user_id: uuid.UUID) -> dict:
    from app.models.reporting import Notification

    projects = list(
        db.scalars(
            select(ResearchProject)
            .where(ResearchProject.user_id == user_id)
            .order_by(ResearchProject.created_at.desc())
        )
    )
    project_ids = [p.id for p in projects]
    completed = [p for p in projects if p.status == "completed"]
    evidence_count = sum(p.evidence_count for p in projects)
    failures = 0
    critical_risks = 0
    opportunities = 0
    for project in completed:
        failures += len(
            db.scalars(select(FailureFinding.id).where(FailureFinding.project_id == project.id)).all()
        )
        critical_risks += len(
            db.scalars(
                select(FailureFinding.id).where(
                    FailureFinding.project_id == project.id,
                    FailureFinding.severity == "critical",
                )
            ).all()
        )
        opportunities += len(
            db.scalars(
                select(OpportunityFinding.id).where(OpportunityFinding.project_id == project.id)
            ).all()
        )
    unread = 0
    if project_ids:
        unread = len(
            db.scalars(
                select(Notification.id).where(
                    Notification.user_id == user_id, Notification.read.is_(False)
                )
            ).all()
        )
    return {
        "projects": len(projects),
        "completed": len(completed),
        "evidence": evidence_count,
        "failures": failures,
        "critical_risks": critical_risks,
        "opportunities": opportunities,
        "unread_notifications": unread,
    }
