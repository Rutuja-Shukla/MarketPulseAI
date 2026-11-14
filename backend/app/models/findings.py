from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import JSONType, TimestampMixin, UUIDMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.research import ResearchProject


class FailureFinding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "failure_findings"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    observed_complaint: Mapped[str | None] = mapped_column(Text)
    interpretation: Mapped[str | None] = mapped_column(Text)
    business_implications: Mapped[str | None] = mapped_column(Text)
    recommended_actions: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    evidence_ids: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    representative_quote: Mapped[str | None] = mapped_column(Text)
    first_observed: Mapped[date | None] = mapped_column(Date)
    last_observed: Mapped[date | None] = mapped_column(Date)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    confidence_label: Mapped[str] = mapped_column(String(24), default="moderate", nullable=False)
    is_observed_complaint: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    project: Mapped["ResearchProject"] = relationship(back_populates="failures")


class OpportunityFinding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "opportunity_findings"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    demand_signal: Mapped[str | None] = mapped_column(Text)
    competitor_comparison: Mapped[str | None] = mapped_column(Text)
    strategic_relevance: Mapped[str | None] = mapped_column(Text)
    next_action: Mapped[str | None] = mapped_column(Text)
    evidence_ids: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    impact_score: Mapped[float] = mapped_column(Float, default=50, nullable=False)
    effort_score: Mapped[float] = mapped_column(Float, default=50, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    quadrant: Mapped[str] = mapped_column(String(32), default="strategic_investment", nullable=False)
    is_estimate: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    project: Mapped["ResearchProject"] = relationship(back_populates="opportunities")


class StrategicRelationship(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "strategic_relationships"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_node: Mapped[str] = mapped_column(String(120), nullable=False)
    target_node: Mapped[str] = mapped_column(String(120), nullable=False)
    relation: Mapped[str] = mapped_column(String(64), nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    evidence_ids: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)


class RoadmapItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "roadmap_items"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    finding_type: Mapped[str] = mapped_column(String(24), nullable=False)  # failure | opportunity
    finding_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    problem: Mapped[str | None] = mapped_column(Text)
    improvement: Mapped[str | None] = mapped_column(Text)
    expected_impact: Mapped[str | None] = mapped_column(Text)
    complexity: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    horizon: Mapped[str] = mapped_column(String(24), default="short_term", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    success_metrics: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="planned", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    project: Mapped["ResearchProject"] = relationship()


class SimulationScenario(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "simulation_scenarios"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    assumptions: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    advantages: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    disadvantages: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    competitor_responses: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    risks: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    evidence_ids: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.4, nullable=False)
    provider: Mapped[str] = mapped_column(String(48), default="heuristic-v1", nullable=False)
    created_at_index: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
