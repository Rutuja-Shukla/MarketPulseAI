from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import JSONType, TimestampMixin, UUIDMixin

if TYPE_CHECKING:  # pragma: no cover
    from app.models.research import ResearchProject


class Report(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "reports"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    sections: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    limitations: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    reference_ids: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider: Mapped[str] = mapped_column(String(48), default="template-v1", nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    project: Mapped["ResearchProject"] = relationship(back_populates="reports")


class MonitoringConfiguration(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "monitoring_configurations"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("research_projects.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    interval: Mapped[str] = mapped_column(String(24), default="weekly", nullable=False)
    track: Mapped[list] = mapped_column(JSONType, default=list, nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Monitoring only performs real work when a live provider is configured;
    # otherwise the UI states that checks are manual/preview-only.
    execution_mode: Mapped[str] = mapped_column(String(24), default="manual", nullable=False)


class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("research_projects.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(48), default="info", nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    action_route: Mapped[str | None] = mapped_column(String(300))
