"""Background research execution.

`inline` runs the pipeline in a process-local thread pool (no Redis needed);
`celery` dispatches to the worker used by Docker Compose.
"""
from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

from app.core.config import settings
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.research import ResearchProject
from app.services.orchestrator import ResearchOrchestrator

logger = get_logger(__name__)

_executor = ThreadPoolExecutor(max_workers=3, thread_name_prefix="research")


def run_project_analysis(project_id: uuid.UUID, demo: bool) -> None:
    db = SessionLocal()
    try:
        project = db.get(ResearchProject, project_id)
        if project is None:
            logger.warning("research_project_missing", extra={"project_id": str(project_id)})
            return
        orchestrator = ResearchOrchestrator(db, project, demo=demo)
        orchestrator.run()
    except Exception:  # noqa: BLE001 - never crash a worker thread silently
        logger.exception("research_job_crashed", extra={"project_id": str(project_id)})
        db.rollback()
        project = db.get(ResearchProject, project_id)
        if project is not None:
            project.status = "failed"
            project.error_message = "Unexpected research worker failure. Check server logs."
            db.commit()
    finally:
        db.close()


def enqueue_analysis(project_id: uuid.UUID, demo: bool) -> str:
    if settings.job_runner == "celery":
        try:
            from app.workers.celery_app import celery_app

            celery_app.send_task("research.run_project", args=[str(project_id), demo])
            return "celery"
        except Exception as exc:  # noqa: BLE001 - fall back rather than lose the job
            logger.warning("celery_dispatch_failed", extra={"event": str(exc)})
    _executor.submit(run_project_analysis, project_id, demo)
    return "inline"
