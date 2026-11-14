from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.reporting import Notification
from app.models.research import ResearchProject
from app.models.user import User
from app.research.taxonomy import (
    COUNTRIES,
    MODE_PROFILES,
    OBJECTIVES,
    REGIONS,
    SITUATIONS,
    SOURCE_CATEGORIES,
    TOPIC_DEFINITIONS,
)
from app.schemas.auth import LoginRequest, RegisterRequest, Token, UserOut
from app.services.analytics import dashboard_metrics
from app.services.demo_seed import DEMO_EMAIL, DEMO_PASSWORD
from app.api.serializers import project_payload

router = APIRouter(tags=["auth"])


@router.post("/auth/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> Token:
    existing = db.scalars(select(User).where(User.email == payload.email.lower())).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        company_name=payload.company_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.post("/auth/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = db.scalars(select(User).where(User.email == payload.email.lower())).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return Token(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.post("/auth/demo", response_model=Token)
def demo_login(db: Session = Depends(get_db)) -> Token:
    if not settings.demo_mode:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demonstration mode is disabled")
    user = db.scalars(select(User).where(User.email == DEMO_EMAIL)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The demonstration workspace is not seeded yet. Restart the API or run scripts/seed_demo.py.",
        )
    return Token(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.get("/meta/catalog")
def catalog() -> dict:
    return {
        "countries": list(COUNTRIES),
        "regions": list(REGIONS),
        "source_categories": list(SOURCE_CATEGORIES),
        "objectives": list(OBJECTIVES),
        "situations": list(SITUATIONS),
        "modes": [
            {
                "key": key,
                "label": profile["label"],
                "description": profile["description"],
                "stages": len(profile["stages"]),
                "query_budget": profile["query_budget"],
                "competitors": profile["max_competitors"],
                "capabilities": profile["capabilities"],
            }
            for key, profile in MODE_PROFILES.items()
        ],
        "topics": [
            {"key": topic.key, "label": topic.label, "description": topic.description}
            for topic in TOPIC_DEFINITIONS
        ],
        "monitoring_tracks": [
            {"key": "sentiment", "label": "Customer sentiment changes"},
            {"key": "complaints", "label": "Emerging complaints"},
            {"key": "competitor", "label": "Competitor announcements"},
            {"key": "pricing", "label": "Pricing changes"},
            {"key": "launches", "label": "Product launches"},
            {"key": "trends", "label": "New market trends"},
            {"key": "opportunities", "label": "Previously identified opportunities"},
        ],
        "demo": {
            "available": settings.demo_mode,
            "email": DEMO_EMAIL,
            "password_hint": "Password is shown on the demo card",
        },
    }


@router.get("/meta/capabilities")
def capabilities(db: Session = Depends(get_db)) -> dict:
    demo_project = db.scalars(
        select(ResearchProject).where(ResearchProject.is_demo.is_(True))
    ).first()
    report = settings.capability_report()
    report["demo_project_id"] = str(demo_project.id) if demo_project else None
    report["demo_credentials"] = {"email": DEMO_EMAIL, "password": DEMO_PASSWORD} if settings.demo_mode else None
    return report


@router.get("/dashboard")
def dashboard(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    metrics = dashboard_metrics(db, user.id)
    projects = list(
        db.scalars(
            select(ResearchProject)
            .where(ResearchProject.user_id == user.id)
            .order_by(ResearchProject.created_at.desc())
            .limit(8)
        )
    )
    notifications = list(
        db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(6)
        )
    )
    return {
        "metrics": metrics,
        "recent_projects": [project_payload(project) for project in projects],
        "completed_projects": [
            project_payload(project) for project in projects if project.status == "completed"
        ][:4],
        "notifications": [
            {
                "id": str(item.id),
                "kind": item.kind,
                "title": item.title,
                "body": item.body,
                "read": item.read,
                "action_route": item.action_route,
                "created_at": item.created_at,
            }
            for item in notifications
        ],
        "demo_mode": settings.demo_mode,
        "live_research_available": settings.live_research_available,
    }
