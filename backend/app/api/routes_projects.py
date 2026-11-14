from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from pydantic import BaseModel, Field

from app.agents.llm import LLMProviderError, try_get_llm
from app.api.deps import get_current_user, get_project
from app.api.serializers import competitor_payload, project_payload, project_progress
from app.core.config import settings
from app.core.ratelimit import enforce_ai_limit
from app.db.session import get_db
from app.models.research import Competitor, ResearchConfiguration, ResearchProject, ResearchSource
from app.models.user import Company, Product, User
from app.schemas.project import (
    ConfigurationOut,
    ProjectCreate,
    ProjectListOut,
    ProjectOut,
    ProjectStatusOut,
    ProjectUpdate,
    TaskOut,
)
from app.services.orchestrator import ResearchOrchestrator
from app.workers.jobs import enqueue_analysis

router = APIRouter(tags=["projects"])


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if not payload.demo_mode and not settings.live_research_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Live research is not configured. Set SEARCH_PROVIDER with TAVILY_API_KEY or BRAVE_API_KEY "
                "to run live analysis, or enable demonstration mode to explore the workflow with the "
                "synthetic dataset."
            ),
        )
    if payload.demo_mode and not settings.demo_mode:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Demonstration mode is disabled")

    countries = [] if payload.market.global_scope else payload.market.countries
    company = Company(
        user_id=user.id,
        name=payload.company.name.strip(),
        website=payload.company.website,
        industry=payload.company.industry,
        description=payload.company.description,
        target_audience=payload.company.target_audience,
        is_demo=payload.demo_mode,
    )
    db.add(company)
    db.flush()
    db.add(
        Product(
            company_id=company.id,
            name=payload.company.product_name or payload.company.name,
            description=payload.company.description,
            category=payload.company.industry,
        )
    )
    project = ResearchProject(
        user_id=user.id,
        company_id=company.id,
        name=payload.name.strip(),
        product_name=payload.company.product_name or payload.company.name,
        mode=payload.config.depth,
        status="draft",
        is_demo=payload.demo_mode,
    )
    db.add(project)
    db.flush()
    db.add(
        ResearchConfiguration(
            project_id=project.id,
            global_scope=payload.market.global_scope,
            countries=countries,
            regions=payload.market.regions,
            comparison_pairs=payload.market.comparison_pairs,
            situation=payload.situation.key,
            situation_description=payload.situation.description,
            objectives=payload.objectives,
            assumptions=[{"text": text, "status": "pending"} for text in payload.assumptions if text.strip()],
            source_categories=payload.config.source_categories,
            research_period_start=payload.config.research_period_start,
            research_period_end=payload.config.research_period_end,
            depth=payload.config.depth,
            competitor_target=payload.config.competitor_target,
            analysis_preferences=payload.config.analysis_preferences,
            notes=payload.config.notes,
        )
    )
    for competitor in payload.competitors:
        if competitor.name.strip().lower() == company.name.lower():
            continue
        db.add(
            Competitor(
                project_id=project.id,
                name=competitor.name.strip(),
                website=competitor.website,
                is_suggested=False,
            )
        )
    db.commit()
    db.refresh(project)
    ResearchOrchestrator(db, project, demo=payload.demo_mode).prepare()
    db.commit()
    db.refresh(project)
    return project_payload(project)


class CompetitorSuggestionRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    product_name: str | None = Field(default=None, max_length=200)
    industry: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=2000)


@router.post("/projects/suggest-competitors")
def suggest_competitors(
    payload: CompetitorSuggestionRequest,
    user: User = Depends(get_current_user),
) -> dict:
    """Ask the configured LLM for likely competitors.

    Suggestions are prompts for the analyst, not research findings, and are
    never stored until the analyst accepts them.
    """
    llm = try_get_llm()
    if llm is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Competitor suggestions need a configured LLM. Add GEMINI_API_KEY, or add competitors "
                "manually — the platform will not invent company names without a model."
            ),
        )
    enforce_ai_limit(user.id, cost=1, scope="suggest-competitors")
    try:
        result = llm.generate_json(
            "Suggest up to 5 plausible direct competitors for the company below. "
            "Only include companies you are reasonably confident exist. "
            'Return JSON: {"competitors": [{"name": str, "website": str|null, "reason": str}]}.\n'
            f"Company: {payload.company_name}\nProduct: {payload.product_name or 'n/a'}\n"
            f"Industry: {payload.industry or 'n/a'}\nDescription: {payload.description or 'n/a'}",
            schema_hint='{"competitors": [{"name": "", "website": null, "reason": ""}]}',
        )
    except LLMProviderError as exc:
        raise HTTPException(status_code=502, detail=f"Competitor suggestion failed: {exc}") from exc
    items = result.get("competitors")
    if not isinstance(items, list):
        raise HTTPException(status_code=502, detail="The model returned an unexpected response")
    clean = []
    for item in items[:5]:
        if isinstance(item, dict) and item.get("name"):
            clean.append(
                {
                    "name": str(item["name"])[:200],
                    "website": str(item.get("website") or "")[:400] or None,
                    "reason": str(item.get("reason") or "")[:300],
                    "source": "llm_suggestion",
                }
            )
    return {"competitors": clean, "note": "Model suggestions — verify before relying on them."}


@router.get("/projects", response_model=ProjectListOut)
def list_projects(
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None, max_length=120),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectListOut:
    query = select(ResearchProject).where(ResearchProject.user_id == user.id)
    if status_filter:
        query = query.where(ResearchProject.status == status_filter)
    if q:
        query = query.where(ResearchProject.name.ilike(f"%{q}%"))
    projects = list(db.scalars(query.order_by(ResearchProject.created_at.desc())))
    return ProjectListOut(
        projects=[ProjectOut(**project_payload(project)) for project in projects],
        total=len(projects),
    )


@router.get("/projects/{project_id}")
def get_project_detail(
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
) -> dict:
    config = db.scalars(
        select(ResearchConfiguration).where(ResearchConfiguration.project_id == project.id)
    ).first()
    sources = list(
        db.scalars(select(ResearchSource).where(ResearchSource.project_id == project.id))
    )
    return {
        "project": project_payload(project),
        "configuration": ConfigurationOut.model_validate(config).model_dump() if config else None,
        "tasks": [TaskOut.model_validate(task).model_dump() for task in project.tasks],
        "competitors": [competitor_payload(c) for c in project.competitors],
        "sources": [
            {
                "id": str(source.id),
                "name": source.name,
                "category": source.category,
                "provider": source.provider,
                "is_live": source.is_live,
                "record_count": source.record_count,
                "description": source.description,
                "base_url": source.base_url,
            }
            for source in sources
        ],
        "company": {
            "name": project.company.name,
            "website": project.company.website,
            "industry": project.company.industry,
            "description": project.company.description,
            "target_audience": project.company.target_audience,
        },
    }


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    payload: ProjectUpdate,
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
) -> dict:
    if project.status == "running":
        raise HTTPException(status_code=409, detail="Cannot edit a project while research is running")
    if payload.name:
        project.name = payload.name.strip()
    if payload.mode:
        project.mode = payload.mode
        if project.configuration:
            project.configuration.depth = payload.mode
        ResearchOrchestrator(db, project, demo=project.is_demo).prepare()
    db.commit()
    db.refresh(project)
    return project_payload(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
) -> None:
    db.delete(project)
    db.commit()


@router.post("/projects/{project_id}/run", status_code=status.HTTP_202_ACCEPTED)
def run_project(
    project: ResearchProject = Depends(get_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    if project.status in ("queued", "running"):
        return {"status": project.status, "message": "Research is already in progress"}
    enforce_ai_limit(user.id, cost=3, scope="research-run")
    if not project.is_demo and not settings.live_research_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Live research is not configured. Add a search provider key or use demonstration mode.",
        )
    ResearchOrchestrator(db, project, demo=project.is_demo).prepare()
    project.status = "queued"
    project.error_message = None
    db.commit()
    runner = enqueue_analysis(project.id, project.is_demo)
    return {"status": "queued", "runner": runner}


@router.get("/projects/{project_id}/status", response_model=ProjectStatusOut)
def project_status(project: ResearchProject = Depends(get_project)) -> ProjectStatusOut:
    return ProjectStatusOut(
        id=project.id,
        status=project.status,
        current_stage=project.current_stage,
        error_message=project.error_message,
        progress=project_progress(project),
        tasks=[TaskOut.model_validate(task) for task in project.tasks],
        evidence_count=project.evidence_count,
        is_demo=project.is_demo,
    )


@router.get("/projects/{project_id}/sources")
def project_sources(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)) -> dict:
    sources = list(db.scalars(select(ResearchSource).where(ResearchSource.project_id == project.id)))
    return {
        "sources": [
            {
                "id": str(source.id),
                "name": source.name,
                "category": source.category,
                "provider": source.provider,
                "is_live": source.is_live,
                "record_count": source.record_count,
                "description": source.description,
                "base_url": source.base_url,
            }
            for source in sources
        ],
        "live": any(source.is_live for source in sources),
        "demo": project.is_demo,
    }
