from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import JSONType, TimestampMixin, UUIDMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.chat import ChatConversation
    from app.models.evidence import EvidenceRecord
    from app.models.findings import FailureFinding, OpportunityFinding
    from app.models.reporting import Report
    from app.models.user import Company, User


# Lifecycle values are stored as short strings for portability across engines.
PROJECT_STATUSES = ("draft", "queued", "running", "completed", "failed", "cancelled")


class ResearchProject(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "research_projects"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(240), nullable=False)
    product_name: Mapped[str | None] = mapped_column(String(200))
    mode: Mapped[str] = mapped_column(String(32), nullable=False, default="standard")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="draft", index=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    summary: Mapped[str | None] = mapped_column(Text)
    current_stage: Mapped[str | None] = mapped_column(String(120))
    error_message: Mapped[str | None] = mapped_column(Text)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    opportunity_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    company: Mapped["Company"] = relationship(lazy="joined")
    configuration: Mapped["ResearchConfiguration | None"] = relationship(
        back_populates="project", cascade="all, delete-orphan", uselist=False, lazy="selectin"
    )
    tasks: Mapped[list["ResearchTask"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ResearchTask.order_index"
    )
    sources: Mapped[list["ResearchSource"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    evidence: Mapped[list["EvidenceRecord"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    competitors: Mapped[list["Competitor"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    failures: Mapped[list["FailureFinding"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    opportunities: Mapped[list["OpportunityFinding"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    reports: Mapped[list["Report"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["ChatConversation"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    user: Mapped["User"] = relationship(back_populates="projects")


class ResearchConfiguration(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "research_configurations"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("research_projects.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    global_scope: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    countries: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    regions: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    comparison_pairs: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    situation: Mapped[str | None] = mapped_column(String(120))
    situation_description: Mapped[str | None] = mapped_column(Text)
    objectives: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    assumptions: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    source_categories: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    research_period_start: Mapped[date | None] = mapped_column(Date)
    research_period_end: Mapped[date | None] = mapped_column(Date)
    depth: Mapped[str] = mapped_column(String(24), default="standard", nullable=False)
    competitor_target: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    analysis_preferences: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    project: Mapped[ResearchProject] = relationship(back_populates="configuration")


class ResearchTask(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "research_tasks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    stage: Mapped[str] = mapped_column(String(48), nullable=False)
    agent: Mapped[str] = mapped_column(String(48), nullable=False, default="orchestrator")
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    result_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped[ResearchProject] = relationship(back_populates="tasks")


class ResearchSource(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "research_sources"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    base_url: Mapped[str | None] = mapped_column(String(500))
    provider: Mapped[str] = mapped_column(String(48), default="demo_dataset", nullable=False)
    is_live: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    record_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    project: Mapped[ResearchProject] = relationship(back_populates="sources")


class Competitor(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "competitors"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    website: Mapped[str | None] = mapped_column(String(400))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    positioning: Mapped[str | None] = mapped_column(Text)
    pricing_summary: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    weaknesses: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    sentiment_score: Mapped[float | None] = mapped_column(Float)
    mention_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_suggested: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    project: Mapped[ResearchProject] = relationship(back_populates="competitors")
    observations: Mapped[list["CompetitorObservation"]] = relationship(
        back_populates="competitor", cascade="all, delete-orphan"
    )


class CompetitorObservation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "competitor_observations"

    competitor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("competitors.id", ondelete="CASCADE"), index=True, nullable=False
    )
    dimension: Mapped[str] = mapped_column(String(64), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float | None] = mapped_column(Float)
    evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("evidence_records.id", ondelete="SET NULL")
    )
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    competitor: Mapped[Competitor] = relationship(back_populates="observations")
