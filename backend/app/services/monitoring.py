"""Market change monitor.

Monitoring is only ever marked as automated when a live provider exists.
Otherwise runs are recorded as manual checks with an explicit notice.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.evidence import EvidenceRecord
from app.models.findings import FailureFinding, OpportunityFinding
from app.models.reporting import MonitoringConfiguration, Notification
from app.models.research import ResearchProject

INTERVAL_DAYS = {"daily": 1, "weekly": 7, "fortnightly": 14, "monthly": 30}

TRACK_LABELS = {
    "sentiment": "Customer sentiment changes",
    "complaints": "Emerging complaints",
    "competitor": "Competitor announcements",
    "pricing": "Pricing changes",
    "launches": "Product launches",
    "trends": "New market trends",
    "opportunities": "Previously identified opportunities",
}


def get_or_create(db: Session, project: ResearchProject) -> MonitoringConfiguration:
    config = db.scalars(
        select(MonitoringConfiguration).where(MonitoringConfiguration.project_id == project.id)
    ).first()
    if config:
        return config
    config = MonitoringConfiguration(
        project_id=project.id,
        user_id=project.user_id,
        enabled=False,
        interval="weekly",
        track=["sentiment", "complaints", "competitor", "opportunities"],
        execution_mode="automated" if settings.live_research_available else "manual",
    )
    db.add(config)
    db.flush()
    return config


def next_run(interval: str, from_time: datetime | None = None) -> datetime:
    base = from_time or datetime.now(timezone.utc)
    return base + timedelta(days=INTERVAL_DAYS.get(interval, 7))


def _aware(value: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; normalise before comparing."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def change_summary(db: Session, project: ResearchProject, since: datetime | None) -> dict:
    """Compare stored records against a baseline timestamp."""
    records = list(
        db.scalars(
            select(EvidenceRecord)
            .where(EvidenceRecord.project_id == project.id)
            .order_by(EvidenceRecord.published_at.desc())
        )
    )
    baseline = _aware(since)
    new_records = [
        r for r in records if r.collected_at and baseline and (_aware(r.collected_at) or baseline) > baseline
    ]
    sentiment_now = _share(records, "positive")
    recent = records[: max(1, len(records) // 3)]
    sentiment_recent = _share(recent, "positive")
    failures = list(
        db.scalars(
            select(FailureFinding)
            .where(FailureFinding.project_id == project.id)
            .order_by(FailureFinding.created_at.desc())
        )
    )
    opportunities = list(
        db.scalars(select(OpportunityFinding).where(OpportunityFinding.project_id == project.id))
    )
    return {
        "new_records": len(new_records),
        "sentiment_positive_share": round(sentiment_now * 100, 1),
        "sentiment_recent_share": round(sentiment_recent * 100, 1),
        "sentiment_delta": round((sentiment_recent - sentiment_now) * 100, 1),
        "latest_signal": (
            {
                "title": records[0].title,
                "source": records[0].source_name,
                "date": records[0].published_at.isoformat() if records[0].published_at else None,
                "sentiment": records[0].sentiment,
            }
            if records
            else None
        ),
        "complaint_watch": [
            {"title": f.title, "severity": f.severity, "evidence": f.evidence_count} for f in failures[:4]
        ],
        "opportunity_watch": [
            {"title": o.title, "impact": o.impact_score, "quadrant": o.quadrant} for o in opportunities[:3]
        ],
        "execution_mode": "automated" if settings.live_research_available else "manual",
        "notice": (
            "Live monitoring is active: scheduled runs use the configured search provider."
            if settings.live_research_available
            else "No live search provider is configured, so scheduled runs are recorded as manual checks. "
            "Past records are summarised but no new market data is fetched."
        ),
    }


def _share(records: list[EvidenceRecord], label: str) -> float:
    if not records:
        return 0.0
    return len([r for r in records if r.sentiment == label]) / len(records)


def record_run(db: Session, project: ResearchProject, config: MonitoringConfiguration) -> Notification:
    now = datetime.now(timezone.utc)
    summary = change_summary(db, project, config.last_run_at)
    config.last_run_at = now
    config.next_run_at = next_run(config.interval, now)
    notification = Notification(
        user_id=project.user_id,
        project_id=project.id,
        kind="monitoring_run",
        title=f"Monitoring check recorded — {project.name}",
        body=(
            f"{summary['new_records']} new records since the last check. "
            f"Positive share {summary['sentiment_positive_share']}%. {summary['notice']}"
        ),
        action_route=f"/analysis/{project.id}/analytics",
    )
    db.add(notification)
    db.flush()
    return notification
