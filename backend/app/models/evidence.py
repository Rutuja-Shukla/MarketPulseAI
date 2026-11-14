from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import JSONType, TimestampMixin, UUIDMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.research import ResearchProject, ResearchSource


class EvidenceRecord(Base, UUIDMixin, TimestampMixin):
    """A single observed market signal with provenance.

    `is_demo` marks synthetic demonstration records; they are never presented as
    live web research.
    """

    __tablename__ = "evidence_records"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_sources.id", ondelete="SET NULL"), index=True
    )
    source_name: Mapped[str] = mapped_column(String(200), nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(1000))
    source_category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    published_at: Mapped[date | None] = mapped_column(Date, index=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[str | None] = mapped_column(String(500))
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    full_text: Mapped[str | None] = mapped_column(Text)
    country: Mapped[str | None] = mapped_column(String(80), index=True)
    author_handle: Mapped[str | None] = mapped_column(String(120))
    rating: Mapped[float | None] = mapped_column(Float)
    product_mentioned: Mapped[str | None] = mapped_column(String(200))
    company_mentioned: Mapped[str | None] = mapped_column(String(200))
    sentiment: Mapped[str] = mapped_column(String(16), default="neutral", nullable=False, index=True)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    topics: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    key_phrases: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    credibility_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    credibility_label: Mapped[str] = mapped_column(String(24), default="moderate", nullable=False)
    corroboration_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_of: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    duplicate_status: Mapped[str] = mapped_column(String(24), default="unique", nullable=False)
    contradiction_group: Mapped[str | None] = mapped_column(String(120))
    embedding: Mapped[list | None] = mapped_column(JSONType)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    external_id: Mapped[str | None] = mapped_column(String(200))
    search_query: Mapped[str | None] = mapped_column(Text)

    project: Mapped["ResearchProject"] = relationship(back_populates="evidence")
    source: Mapped["ResearchSource | None"] = relationship()


class SentimentRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sentiment_records"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    evidence_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("evidence_records.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[str] = mapped_column(String(16), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    provider: Mapped[str] = mapped_column(String(48), default="lexicon-v1", nullable=False)
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TopicCluster(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "topic_clusters"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    kind: Mapped[str] = mapped_column(String(24), nullable=False)  # complaint | praise | request | trend
    description: Mapped[str | None] = mapped_column(Text)
    evidence_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    negative_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    positive_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(16), default="mixed", nullable=False)
    trend: Mapped[str] = mapped_column(String(24), default="stable", nullable=False)
    first_seen: Mapped[date | None] = mapped_column(Date)
    last_seen: Mapped[date | None] = mapped_column(Date)
    monthly_counts: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
