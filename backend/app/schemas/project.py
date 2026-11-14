from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.research.taxonomy import COUNTRY_BY_CODE, SOURCE_CATEGORY_KEYS


class CompanyInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    website: str | None = Field(default=None, max_length=400)
    industry: str | None = Field(default=None, max_length=160)
    product_name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    target_audience: str | None = Field(default=None, max_length=2000)

    @field_validator("website")
    @classmethod
    def validate_website(cls, value: str | None) -> str | None:
        if not value:
            return None
        value = value.strip()
        if not value:
            return None
        if not value.startswith(("http://", "https://")):
            value = f"https://{value}"
        bare = value.replace("https://", "").replace("http://", "")
        if "." not in bare:
            raise ValueError("Website must look like a domain, e.g. example.com")
        return value


class MarketInput(BaseModel):
    global_scope: bool = False
    countries: list[str] = Field(default_factory=list, max_length=40)
    regions: list[str] = Field(default_factory=list, max_length=12)
    comparison_pairs: list[list[str]] = Field(default_factory=list, max_length=6)

    @field_validator("countries")
    @classmethod
    def validate_countries(cls, value: list[str]) -> list[str]:
        invalid = [code for code in value if code.upper() not in COUNTRY_BY_CODE]
        if invalid:
            raise ValueError(f"Unsupported country codes: {', '.join(invalid)}")
        return [code.upper() for code in dict.fromkeys(value)]

    @model_validator(mode="after")
    def validate_scope(self) -> "MarketInput":
        if not self.global_scope and not self.countries and not self.regions:
            raise ValueError("Select at least one country, a region, or the global market")
        for pair in self.comparison_pairs:
            if len(pair) != 2:
                raise ValueError("Comparison pairs must contain exactly two country codes")
        return self


class SituationInput(BaseModel):
    key: str | None = Field(default=None, max_length=80)
    description: str | None = Field(default=None, max_length=4000)


class CompetitorInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    website: str | None = Field(default=None, max_length=400)


class ResearchConfigInput(BaseModel):
    research_period_start: date | None = None
    research_period_end: date | None = None
    source_categories: list[str] = Field(default_factory=lambda: list(SOURCE_CATEGORY_KEYS))
    depth: Literal["quick", "standard", "deep"] = "standard"
    competitor_target: int = Field(default=3, ge=1, le=6)
    analysis_preferences: dict = Field(default_factory=dict)
    notes: str | None = Field(default=None, max_length=4000)

    @field_validator("source_categories")
    @classmethod
    def validate_sources(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("Select at least one source category")
        invalid = [item for item in value if item not in SOURCE_CATEGORY_KEYS]
        if invalid:
            raise ValueError(f"Unsupported source categories: {', '.join(invalid)}")
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def validate_period(self) -> "ResearchConfigInput":
        if self.research_period_start and self.research_period_end:
            if self.research_period_start > self.research_period_end:
                raise ValueError("Research period start must be before the end date")
        return self


class ProjectCreate(BaseModel):
    name: str = Field(min_length=3, max_length=240)
    company: CompanyInput
    market: MarketInput
    situation: SituationInput = Field(default_factory=SituationInput)
    objectives: list[str] = Field(default_factory=list, max_length=12)
    assumptions: list[str] = Field(default_factory=list, max_length=12)
    competitors: list[CompetitorInput] = Field(default_factory=list, max_length=10)
    config: ResearchConfigInput = Field(default_factory=ResearchConfigInput)
    demo_mode: bool = False


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=240)
    mode: Literal["quick", "standard", "deep"] | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stage: str
    agent: str
    name: str
    status: str
    progress: int
    detail: str | None = None
    result_count: int
    order_index: int
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    mode: str
    status: str
    is_demo: bool
    summary: str | None = None
    current_stage: str | None = None
    error_message: str | None = None
    evidence_count: int
    failure_count: int
    opportunity_count: int
    created_at: datetime
    completed_at: datetime | None = None
    product_name: str | None = None
    company_name: str = ""
    countries: list[str] = Field(default_factory=list)
    global_scope: bool = False
    progress: int = 0


class ProjectListOut(BaseModel):
    projects: list[ProjectOut]
    total: int


class ProjectStatusOut(BaseModel):
    id: uuid.UUID
    status: str
    current_stage: str | None = None
    error_message: str | None = None
    progress: int
    tasks: list[TaskOut]
    evidence_count: int
    is_demo: bool


class ConfigurationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    global_scope: bool
    countries: list
    regions: list
    comparison_pairs: list
    situation: str | None
    situation_description: str | None
    objectives: list
    assumptions: list
    source_categories: list
    research_period_start: date | None
    research_period_end: date | None
    depth: str
    competitor_target: int
    analysis_preferences: dict
    notes: str | None
