from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_name: str
    source_url: str | None = None
    source_category: str
    published_at: date | None = None
    collected_at: datetime
    title: str | None = None
    excerpt: str
    country: str | None = None
    author_handle: str | None = None
    rating: float | None = None
    sentiment: str
    sentiment_score: float
    topics: list
    key_phrases: list
    credibility_score: float
    credibility_label: str
    corroboration_count: int
    duplicate_status: str
    contradiction_group: str | None = None
    is_demo: bool
    finding_ids: list[str] = Field(default_factory=list)


class FailureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    category: str
    severity: str
    summary: str
    observed_complaint: str | None = None
    interpretation: str | None = None
    business_implications: str | None = None
    recommended_actions: list
    evidence_ids: list
    evidence_count: int
    source_count: int
    representative_quote: str | None = None
    first_observed: date | None = None
    last_observed: date | None = None
    sentiment_score: float
    confidence: float
    confidence_label: str
    is_observed_complaint: bool


class OpportunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    category: str
    description: str
    demand_signal: str | None = None
    competitor_comparison: str | None = None
    strategic_relevance: str | None = None
    next_action: str | None = None
    evidence_ids: list
    evidence_count: int
    impact_score: float
    effort_score: float
    confidence: float
    quadrant: str
    is_estimate: bool


class CompetitorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    website: str | None = None
    is_primary: bool
    positioning: str | None = None
    pricing_summary: str | None = None
    strengths: list
    weaknesses: list
    sentiment_score: float | None = None
    mention_count: int
    source_count: int
    is_suggested: bool
    observations: list[dict] = Field(default_factory=list)


class GraphNode(BaseModel):
    id: str
    label: str
    category: str
    category_label: str
    detail: str
    confidence: float
    evidence_ids: list[str]
    meta: dict


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: str
    rationale: str | None = None
    confidence: float


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    legend: dict
    relationship_types: list[str]


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    version: int
    executive_summary: str
    sections: list
    limitations: list
    reference_ids: list
    generated_at: datetime | None = None
    provider: str
    is_demo: bool


class ScenarioIn(BaseModel):
    prompt: str = Field(min_length=8, max_length=1000)
    name: str | None = Field(default=None, max_length=200)
    simulate: bool = True


class ScenarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    prompt: str
    assumptions: list
    advantages: list
    disadvantages: list
    competitor_responses: list
    risks: list
    evidence_ids: list
    confidence: float
    provider: str
    created_at: datetime


class SimulationComparisonIn(BaseModel):
    scenarios: list[ScenarioIn] = Field(min_length=2, max_length=4)


class ChatMessageIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class ChatCitation(BaseModel):
    id: str | None = None
    source_name: str | None = None
    source_url: str | None = None
    excerpt: str | None = None
    sentiment: str | None = None
    published_at: str | None = None
    is_demo: bool = False


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    content: str
    citations: list
    retrieval_trace: list
    provider: str
    created_at: datetime


class RoadmapItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    finding_type: str
    finding_id: uuid.UUID | None = None
    title: str
    problem: str | None = None
    improvement: str | None = None
    expected_impact: str | None = None
    complexity: str
    priority: str
    horizon: str
    confidence: float
    success_metrics: list
    status: str
    notes: str | None = None
    order_index: int


class RoadmapUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=240)
    priority: Literal["critical", "high", "medium", "low"] | None = None
    status: Literal["planned", "in_progress", "completed", "parked"] | None = None
    horizon: Literal["immediate", "short_term", "medium_term", "long_term"] | None = None
    notes: str | None = Field(default=None, max_length=2000)
    order_index: int | None = Field(default=None, ge=0, le=999)


class MonitoringIn(BaseModel):
    enabled: bool = True
    interval: Literal["daily", "weekly", "fortnightly", "monthly"] = "weekly"
    track: list[str] = Field(default_factory=list, max_length=10)


class MonitoringOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    enabled: bool
    interval: str
    track: list
    last_run_at: datetime | None = None
    next_run_at: datetime | None = None
    execution_mode: str
    change_summary: dict = Field(default_factory=dict)


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID | None = None
    kind: str
    title: str
    body: str | None = None
    read: bool
    action_route: str | None = None
    created_at: datetime
