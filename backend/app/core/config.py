"""Typed application configuration, loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "MarketPulse AI"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api"
    secret_key: str = "dev-insecure-secret-change-me-please-0123456789"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = "sqlite:///./marketpulse.db"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"

    demo_mode: bool = True
    seed_demo_on_startup: bool = True

    search_provider: Literal["none", "tavily", "brave"] = "none"
    tavily_api_key: str = ""
    brave_api_key: str = ""
    search_timeout_seconds: int = 25

    llm_provider: Literal["gemini", "none"] = "gemini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"
    llm_timeout_seconds: int = 60

    job_runner: Literal["inline", "celery"] = "inline"
    redis_url: str = "redis://localhost:6379/0"

    rate_limit_ai_per_hour: int = 60
    research_max_queries: int = 12
    max_upload_bytes: int = 2_000_000

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def search_configured(self) -> bool:
        if self.search_provider == "tavily":
            return bool(self.tavily_api_key)
        if self.search_provider == "brave":
            return bool(self.brave_api_key)
        return False

    @property
    def llm_configured(self) -> bool:
        return self.llm_provider == "gemini" and bool(self.gemini_api_key)

    @property
    def live_research_available(self) -> bool:
        """Live research needs a configured search provider.

        Structured extraction falls back to the deterministic engine when no LLM is
        configured, and the report labels which provider produced it.
        """
        return self.search_configured

    def capability_report(self) -> dict[str, object]:
        return {
            "demo_mode": self.demo_mode,
            "search_provider": self.search_provider,
            "search_configured": self.search_configured,
            "llm_provider": self.llm_provider,
            "llm_configured": self.llm_configured,
            "live_research_available": self.live_research_available,
            "job_runner": self.job_runner,
            "limitations": [
                msg
                for msg in (
                    None
                    if self.search_configured
                    else "No search provider configured — live source discovery is disabled.",
                    None
                    if self.llm_configured
                    else "No LLM API key configured — live evidence reasoning is disabled.",
                )
                if msg
            ],
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
