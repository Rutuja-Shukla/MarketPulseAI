from __future__ import annotations

import uuid

from celery import Celery

from app.core.config import settings

celery_app = Celery("marketpulse", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    task_track_started=True,
    worker_max_tasks_per_child=50,
    broker_connection_retry_on_startup=True,
)


@celery_app.task(name="research.run_project")
def run_project(project_id: str, demo: bool) -> None:
    from app.workers.jobs import run_project_analysis

    run_project_analysis(uuid.UUID(project_id), demo)


@celery_app.task(name="monitoring.tick")
def monitoring_tick() -> None:
    """Recompute monitoring snapshots for enabled projects."""
    from datetime import datetime, timezone

    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.models.reporting import MonitoringConfiguration
    from app.models.research import ResearchProject
    from app.services.monitoring import record_run

    db = SessionLocal()
    try:
        configs = list(db.scalars(select(MonitoringConfiguration).where(MonitoringConfiguration.enabled.is_(True))))
        now = datetime.now(timezone.utc)
        for config in configs:
            if config.next_run_at and config.next_run_at > now:
                continue
            project = db.get(ResearchProject, config.project_id)
            if project:
                record_run(db, project, config)
        db.commit()
    finally:
        db.close()
