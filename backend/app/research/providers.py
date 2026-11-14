"""Search-provider abstraction.

Live research requires a configured provider. When none is configured we return
an explicit `ProviderNotConfigured` error — the pipeline never fabricates a
search result.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Protocol

import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class ProviderNotConfigured(RuntimeError):
    """Raised when a live provider is requested without credentials."""


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    source_name: str
    published_at: date | None = None
    raw: dict = field(default_factory=dict)


class SearchProvider(Protocol):
    name: str

    def search(self, query: str, *, max_results: int = 8) -> list[SearchResult]: ...


class TavilySearchProvider:
    name = "tavily"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def search(self, query: str, *, max_results: int = 8) -> list[SearchResult]:
        if not self.api_key:
            raise ProviderNotConfigured("Tavily API key is not configured.")
        response = httpx.post(
            "https://api.tavily.com/search",
            json={
                "api_key": self.api_key,
                "query": query,
                "search_depth": "advanced",
                "max_results": max_results,
                "include_answer": False,
                "include_raw_content": False,
            },
            timeout=settings.search_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        results: list[SearchResult] = []
        for item in payload.get("results", []):
            url = item.get("url", "")
            results.append(
                SearchResult(
                    title=item.get("title") or url,
                    url=url,
                    snippet=item.get("content") or "",
                    source_name=_domain(url),
                    raw=item,
                )
            )
        return results


class BraveSearchProvider:
    name = "brave"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def search(self, query: str, *, max_results: int = 8) -> list[SearchResult]:
        if not self.api_key:
            raise ProviderNotConfigured("Brave Search API key is not configured.")
        response = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": max_results},
            headers={"X-Subscription-Token": self.api_key, "Accept": "application/json"},
            timeout=settings.search_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        results: list[SearchResult] = []
        for item in payload.get("web", {}).get("results", []):
            url = item.get("url", "")
            results.append(
                SearchResult(
                    title=item.get("title") or url,
                    url=url,
                    snippet=item.get("description") or "",
                    source_name=_domain(url),
                    raw=item,
                )
            )
        return results


def _domain(url: str) -> str:
    try:
        return url.split("//", 1)[-1].split("/", 1)[0].replace("www.", "")
    except Exception:  # pragma: no cover - defensive
        return "web"


def get_search_provider() -> SearchProvider:
    """Return the configured provider or raise with an actionable message."""
    if settings.search_provider == "tavily" and settings.tavily_api_key:
        return TavilySearchProvider(settings.tavily_api_key)
    if settings.search_provider == "brave" and settings.brave_api_key:
        return BraveSearchProvider(settings.brave_api_key)
    raise ProviderNotConfigured(
        "No live search provider is configured. Set SEARCH_PROVIDER plus TAVILY_API_KEY "
        "or BRAVE_API_KEY in .env to run live research, or run a demonstration analysis."
    )
