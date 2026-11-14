from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_project
from app.api.serializers import project_payload
from app.core.config import settings
from app.db.session import get_db
from app.models.reporting import MonitoringConfiguration, Notification
from app.models.research import ResearchProject
from app.models.user import User
from app.schemas.analysis import MonitoringIn, MonitoringOut, NotificationOut
from app.services import monitoring as monitoring_service

router = APIRouter(tags=["operations"])


@router.get("/monitoring")
def list_monitoring(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    projects = list(
        db.scalars(
            select(ResearchProject)
            .where(ResearchProject.user_id == user.id, ResearchProject.status == "completed")
            .order_by(ResearchProject.created_at.desc())
        )
    )
    entries = []
    for project in projects:
        config = db.scalars(
            select(MonitoringConfiguration).where(MonitoringConfiguration.project_id == project.id)
        ).first()
        if config is None:
            continue
        entries.append(
            {
                "project": project_payload(project),
                "monitoring": {
                    "id": str(config.id),
                    "project_id": str(project.id),
                    "enabled": config.enabled,
                    "interval": config.interval,
                    "track": config.track,
                    "last_run_at": config.last_run_at,
                    "next_run_at": config.next_run_at,
                    "execution_mode": config.execution_mode,
                    "change_summary": monitoring_service.change_summary(db, project, config.last_run_at),
                },
            }
        )
    return {"entries": entries, "total": len(entries)}


@router.get("/projects/{project_id}/monitoring", response_model=MonitoringOut)
def get_monitoring(
    project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)
):
    config = monitoring_service.get_or_create(db, project)
    db.commit()
    db.refresh(config)
    payload = MonitoringOut.model_validate(config)
    payload.change_summary = monitoring_service.change_summary(db, project, config.last_run_at)
    return payload


@router.post("/projects/{project_id}/monitoring", response_model=MonitoringOut)
def configure_monitoring(
    payload: MonitoringIn,
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
):
    config = monitoring_service.get_or_create(db, project)
    config.enabled = payload.enabled
    config.interval = payload.interval
    config.track = payload.track or config.track
    config.execution_mode = "automated" if settings.live_research_available else "manual"
    if payload.enabled:
        config.next_run_at = monitoring_service.next_run(config.interval)
    db.commit()
    db.refresh(config)
    result = MonitoringOut.model_validate(config)
    result.change_summary = monitoring_service.change_summary(db, project, config.last_run_at)
    return result


@router.post("/projects/{project_id}/monitoring/run")
def run_monitoring_now(
    project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)
) -> dict:
    config = monitoring_service.get_or_create(db, project)
    notification = monitoring_service.record_run(db, project, config)
    db.commit()
    return {
        "recorded": True,
        "execution_mode": config.execution_mode,
        "summary": monitoring_service.change_summary(db, project, config.last_run_at),
        "notification_id": str(notification.id),
    }


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
    )


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/notifications/read-all")
def mark_all_read(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict:
    notifications = list(
        db.scalars(
            select(Notification).where(
                Notification.user_id == user.id, Notification.read.is_(False)
            )
        )
    )
    for notification in notifications:
        notification.read = True
    db.commit()
    return {"updated": len(notifications)}
