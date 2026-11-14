"""Sliding-window in-process rate limiter for expensive AI endpoints."""
from __future__ import annotations

import threading
import time
import uuid
from collections import defaultdict, deque

from fastapi import HTTPException, status

from app.core.config import settings

_lock = threading.Lock()
_hits: dict[str, deque[float]] = defaultdict(deque)


def enforce_ai_limit(user_id: uuid.UUID, *, cost: int = 1, scope: str = "ai") -> None:
    bucket = f"{scope}:{user_id}"
    now = time.monotonic()
    window = 3600.0
    with _lock:
        entries = _hits[bucket]
        while entries and now - entries[0] > window:
            entries.popleft()
        if len(entries) + cost > settings.rate_limit_ai_per_hour:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"Rate limit reached ({settings.rate_limit_ai_per_hour} requests/hour for this action). "
                    "Try again later."
                ),
            )
        entries.extend([now] * cost)


def reset_limits() -> None:
    with _lock:
        _hits.clear()
