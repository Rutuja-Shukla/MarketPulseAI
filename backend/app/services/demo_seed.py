"""Idempotent demonstration workspace seeding.

Creates one clearly-labelled synthetic project with full analysis output so the
product can be evaluated without any external API key.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.core.security import hash_password
from app.models.reporting import MonitoringConfiguration, Notification
from app.models.research import (
    Competitor,
    ResearchConfiguration,
    ResearchProject,
    ResearchSource,
    ResearchTask,
)
from app.models.user import Company, Product, User
from app.research.demo_corpus import (
    DEMO_COMPANY,
    DEMO_COMPETITORS,
    DEMO_CONFIG,
    DEMO_EVIDENCE,
    DEMO_PROJECT_NAME,
    DEMO_SUMMARY,
)
from app.research.taxonomy import MODE_PROFILES, SOURCE_CATEGORIES, STAGE_LABELS
from app.services.analysis_engine import AnalysisEngine
from app.services.monitoring import next_run

logger = get_logger(__name__)

DEMO_EMAIL = "demo@marketpulse.ai"
DEMO_PASSWORD = "DemoPass123!"


def seed_demo_workspace(db: Session) -> bool:
    existing = db.scalars(
        select(ResearchProject).where(ResearchProject.is_demo.is_(True))
    ).first()
    if existing:
        return False

    user = db.scalars(select(User).where(User.email == DEMO_EMAIL)).first()
    if user is None:
        user = User(
            email=DEMO_EMAIL,
            full_name="Avery Chen",
            password_hash=hash_password(DEMO_PASSWORD),
            company_name="Lumenly",
            is_demo=True,
        )
        db.add(user)
        db.flush()

    company = Company(
        user_id=user.id,
        name=DEMO_COMPANY["name"],
        website=DEMO_COMPANY["website"],
        industry=DEMO_COMPANY["industry"],
        description=DEMO_COMPANY["description"],
        target_audience=DEMO_COMPANY["target_audience"],
        is_demo=True,
    )
    db.add(company)
    db.flush()
    db.add(
        Product(
            company_id=company.id,
            name=DEMO_COMPANY["product_name"],
            description=DEMO_COMPANY["description"],
            category="Market intelligence",
        )
    )

    started = datetime.now(timezone.utc) - timedelta(minutes=18)
    project = ResearchProject(
        user_id=user.id,
        company_id=company.id,
        name=DEMO_PROJECT_NAME,
        product_name=DEMO_COMPANY["product_name"],
        mode="deep",
        status="completed",
        is_demo=True,
        summary=DEMO_SUMMARY,
        current_stage="completed",
        started_at=started,
        completed_at=started + timedelta(minutes=12),
    )
    db.add(project)
    db.flush()

    db.add(
        ResearchConfiguration(
            project_id=project.id,
            global_scope=DEMO_CONFIG["global_scope"],
            countries=DEMO_CONFIG["countries"],
            regions=DEMO_CONFIG["regions"],
            comparison_pairs=DEMO_CONFIG["comparison_pairs"],
            situation=DEMO_CONFIG["situation"],
            situation_description=DEMO_CONFIG["situation_description"],
            objectives=DEMO_CONFIG["objectives"],
            assumptions=[dict(item) for item in DEMO_CONFIG["assumptions"]],
            source_categories=DEMO_CONFIG["source_categories"],
            research_period_start=date.fromisoformat(DEMO_CONFIG["research_period_start"]),
            research_period_end=date.fromisoformat(DEMO_CONFIG["research_period_end"]),
            depth=DEMO_CONFIG["depth"],
            competitor_target=DEMO_CONFIG["competitor_target"],
            analysis_preferences=DEMO_CONFIG["analysis_preferences"],
            notes="Synthetic demonstration project. No live web research was performed.",
        )
    )

    for competitor in DEMO_COMPETITORS:
        db.add(
            Competitor(
                project_id=project.id,
                name=competitor["name"],
                website=competitor["website"],
                positioning=competitor["positioning"],
                pricing_summary=competitor["pricing_summary"],
                strengths=list(competitor["strengths"]),
                weaknesses=list(competitor["weaknesses"]),
                is_suggested=True,
            )
        )

    categories = sorted({record["source_category"] for record in DEMO_EVIDENCE})
    source_map = {}
    for category in categories:
        label = next((c["label"] for c in SOURCE_CATEGORIES if c["key"] == category), category)
        source = ResearchSource(
            project_id=project.id,
            name=label,
            category=category,
            provider="demo_dataset",
            is_live=False,
            description="Synthetic demonstration records — not live web research.",
        )
        db.add(source)
        db.flush()
        source_map[category] = source.id
    db.flush()

    engine = AnalysisEngine(db, project)
    records = engine.ingest(DEMO_EVIDENCE, is_demo=True, source_map=source_map)
    for category, source_id in source_map.items():
        source = db.get(ResearchSource, source_id)
        if source:
            source.record_count = len([r for r in records if r.source_category == category])

    engine.build_competitors([c["name"] for c in DEMO_COMPETITORS])
    engine.build_topics()
    engine.build_failures()
    engine.build_opportunities()
    engine.build_relationships()
    engine.build_roadmap()

    config = db.scalars(
        select(ResearchConfiguration).where(ResearchConfiguration.project_id == project.id)
    ).first()
    if config:
        config.assumptions = engine.assess_assumptions(config.assumptions or [])

    engine.build_report(provider="demo-dataset+heuristic-v1")

    deep_stages = MODE_PROFILES["deep"]["stages"]
    for index, stage in enumerate(deep_stages):
        meta = STAGE_LABELS[stage]
        db.add(
            ResearchTask(
                project_id=project.id,
                stage=stage,
                agent=meta["agent"],
                name=meta["name"],
                status="completed",
                progress=100,
                order_index=index,
                detail="Completed on the demonstration corpus.",
                result_count=len(records),
                started_at=started + timedelta(seconds=index * 35),
                finished_at=started + timedelta(seconds=index * 35 + 30),
            )
        )

    project.evidence_count = len(records)
    project.failure_count = len(project.failures)
    project.opportunity_count = len(project.opportunities)

    db.add(
        MonitoringConfiguration(
            project_id=project.id,
            user_id=user.id,
            enabled=True,
            interval="weekly",
            track=["sentiment", "complaints", "competitor", "pricing", "opportunities"],
            last_run_at=started,
            next_run_at=next_run("weekly", started),
            execution_mode="manual",
        )
    )
    db.add(
        Notification(
            user_id=user.id,
            project_id=project.id,
            kind="demo_ready",
            title="Demonstration workspace ready",
            body=(
                "Lumenly Signals (synthetic) includes 42 illustrative evidence records, "
                "weakness and opportunity findings, a graph and an executive report."
            ),
            action_route=f"/analysis/{project.id}/report",
        )
    )
    db.commit()
    logger.info("demo_workspace_seeded", extra={"project_id": str(project.id)})
    return True
