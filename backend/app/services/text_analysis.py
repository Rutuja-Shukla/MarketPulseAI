"""Deterministic text analysis used by the live and demo pipelines.

The lexicon classifier is intentionally transparent: every label can be
explained by the tokens that produced it, which matters more for market
research than a black-box score.
"""
from __future__ import annotations

import hashlib
import math
import re
from collections import Counter

from app.research.taxonomy import TOPIC_DEFINITIONS, TOPIC_BY_KEY

_WORD_RE = re.compile(r"[a-zA-Z][a-zA-Z'-]+")

POSITIVE_TERMS: dict[str, float] = {
    "love": 2.0, "loved": 2.0, "excellent": 2.2, "fantastic": 2.2, "great": 1.6,
    "good": 1.2, "helpful": 1.4, "improved": 1.2, "improvement": 1.0, "fast": 1.0,
    "easy": 1.2, "intuitive": 1.6, "reliable": 1.4, "smooth": 1.2, "responsive": 1.4,
    "worth": 1.0, "valuable": 1.2, "clear": 0.8, "recommend": 1.6, "best": 1.8,
    "brilliant": 2.0, "seamless": 1.6, "happy": 1.4, "impressed": 1.6, "solid": 1.0,
    "genuinely": 0.6, "strong": 0.8, "useful": 1.2, "supportive": 1.2, "quickly": 0.8,
    "superb": 2.0, "delight": 1.4, "delightful": 1.8, "value": 0.6, "polished": 1.2,
    "affordable": 1.4, "transparent": 1.0, "saved": 0.8, "saves": 0.8,
}

NEGATIVE_TERMS: dict[str, float] = {
    "hate": 2.2, "terrible": 2.4, "awful": 2.2, "worst": 2.4, "bad": 1.4,
    "disappointing": 2.0, "disappointed": 2.0, "frustrating": 2.0, "frustration": 1.8,
    "frustrated": 1.8, "slow": 1.4, "broken": 2.0, "bug": 1.2, "bugs": 1.2,
    "crash": 2.0, "crashes": 2.0, "expensive": 2.2, "overpriced": 2.4,
    "confusing": 1.8, "clunky": 1.8, "unreliable": 2.0, "missing": 1.2, "lacking": 1.4,
    "ignored": 1.8, "poor": 1.6, "worse": 1.6, "hard": 1.3, "difficult": 1.4,
    "problem": 1.0, "problems": 1.2, "issue": 0.8, "issues": 1.0, "complaint": 1.0,
    "cancelled": 1.6, "cancel": 1.0, "churn": 1.6, "outage": 2.2, "downtime": 2.0,
    "stale": 1.6, "inaccurate": 1.8, "wrong": 1.2, "delay": 1.2, "delayed": 1.2,
    "unusable": 2.4, "refund": 1.0, "stuck": 1.2, "fail": 1.4, "failed": 1.4,
    "struggle": 1.2, "struggling": 1.4, "abandoned": 1.6, "lost": 1.0, "risk": 0.8,
    "weak": 1.2, "steep": 1.2, "costly": 1.8, "pricey": 1.8, "hike": 1.6,
    "increase": 0.8, "increased": 0.8, "jumped": 1.0, "double": 1.0, "doubles": 1.2,
    "sneaky": 1.6, "lottery": 1.2, "silence": 1.4, "painful": 1.6, "tedious": 1.4,
    "blocker": 1.4, "friction": 1.2, "inconsistent": 1.4, "unhappy": 1.6,
    "unclear": 1.2, "disappointment": 1.6, "defeats": 1.4, "timeouts": 1.6,
    "timeout": 1.6, "unresponsive": 1.8, "backlog": 1.2, "unanswered": 1.4,
    "rejected": 1.2, "blocked": 1.2, "manual": 0.6, "rebuilds": 0.8, "rebuild": 0.8,
    "compresses": 0.6, "unrealistic": 2.0, "justify": 0.8, "price": 0.8,
    "pricing": 1.0, "priced": 0.9, "cost": 0.8, "costs": 0.8, "budget": 0.6,
    "budgets": 0.6, "afford": 1.6, "procurement": 0.6, "invoice": 0.6,
    "invoices": 0.6, "billing": 0.9, "renewal": 0.6, "notice": 0.4,
    "minimum": 0.5, "absorb": 0.6, "waiting": 0.8, "wait": 0.5,
    "frictionless": 0.0,
}

NEGATORS = {"not", "never", "hardly", "barely", "isn't", "wasn't", "don't", "didn't", "doesn't", "cannot", "can't", "isnt", "dont"}

INTENSIFIERS = {
    "very": 1.4, "really": 1.3, "extremely": 1.6, "so": 1.2, "incredibly": 1.5,
    "totally": 1.3, "too": 1.35, "completely": 1.4, "absolutely": 1.4,
}

CONTRAST_MARKERS = {"but", "however", "though", "although", "yet", "except"}

RATING_LABELS = {
    5: "positive",
    4: "positive",
    3: "mixed",
    2: "negative",
    1: "negative",
}


def _tokens(text: str) -> list[str]:
    return [t.lower() for t in _WORD_RE.findall(text)]


def analyse_sentiment(
    text: str, rating: float | None = None
) -> tuple[str, float, float]:
    """Return (label, score in [-1, 1], confidence in [0, 1]).

    Reviews in this domain are usually mixed, so two signals are combined: a
    transparent lexicon score and, when present, the published star rating.
    Language after a contrast marker ("but", "however") carries more weight
    because that is where reviewers usually state their verdict.
    """
    tokens = _tokens(text)
    if not tokens and rating is None:
        return "neutral", 0.0, 0.2

    positive_sum = 0.0
    negative_sum = 0.0
    hits = 0
    negate_window = 0
    multiplier = 1.0
    contrast = 1.0

    for token in tokens:
        if token in CONTRAST_MARKERS:
            contrast = 1.6
            continue
        if token in NEGATORS:
            negate_window = 3
            continue
        if token in INTENSIFIERS:
            multiplier = INTENSIFIERS[token]
            continue
        positive_weight = POSITIVE_TERMS.get(token)
        negative_weight = NEGATIVE_TERMS.get(token)
        if positive_weight is None and negative_weight is None:
            negate_window = max(0, negate_window - 1)
            multiplier = 1.0
            continue
        is_positive = positive_weight is not None and (
            negative_weight is None or positive_weight >= negative_weight
        )
        weight = (positive_weight if is_positive else negative_weight) or 0.0
        value = weight * multiplier * contrast
        if negate_window > 0:
            is_positive = not is_positive
            value *= 0.8
        if is_positive:
            positive_sum += value
        else:
            negative_sum += value
        hits += 1
        negate_window = max(0, negate_window - 1)
        multiplier = 1.0

    total = positive_sum + negative_sum
    # Polarity over expressed sentiment, not raw token count: neutral prose
    # (methodology notes, news copy) should not dilute a clear verdict. The
    # intensity factor stops one weak word in an otherwise factual page from
    # reading as a strong opinion.
    polarity = 0.0 if total <= 0 else (positive_sum - negative_sum) / total
    intensity = min(1.0, total / 5.0)
    text_score = polarity * intensity

    if rating is not None:
        rating_score = max(-1.0, min(1.0, (rating - 3.1) / 1.9))
        normalised = round(rating_score * 0.62 + text_score * 0.38, 3)
    else:
        normalised = round(text_score, 3)

    if normalised > 0.22:
        label = "positive"
    elif normalised < -0.22:
        label = "negative"
    elif abs(normalised) <= 0.07:
        label = "neutral"
    else:
        label = "mixed"

    confidence = min(0.95, 0.32 + math.log1p(hits) / 2.8 + (0.14 if rating is not None else 0))
    return label, normalised, round(confidence, 2)


def rating_sentiment(rating: float | None) -> str | None:
    if rating is None:
        return None
    if rating >= 4:
        return "positive"
    if rating <= 2:
        return "negative"
    return "mixed"


def classify_topics(text: str) -> list[str]:
    lowered = text.lower()
    hits: list[str] = []
    for definition in TOPIC_DEFINITIONS:
        if any(keyword in lowered for keyword in definition.keywords):
            hits.append(definition.key)
    return hits


def extract_key_phrases(text: str, limit: int = 6) -> list[str]:
    tokens = [t for t in _tokens(text) if len(t) > 3]
    stop = {
        "that", "with", "have", "this", "from", "they", "there", "their", "would", "could",
        "should", "about", "which", "when", "what", "your", "ours", "been", "were", "will",
        "just", "like", "into", "than", "then", "also", "more", "most", "some", "very",
        "much", "only", "even", "because", "after", "before", "while", "still", "over",
    }
    counts = Counter(t for t in tokens if t not in stop)
    return [word for word, _ in counts.most_common(limit)]


def shingles(text: str, size: int = 5) -> set[str]:
    tokens = [t for t in _tokens(text) if len(t) > 2]
    if len(tokens) < size:
        return {" ".join(tokens)} if tokens else set()
    return {" ".join(tokens[i : i + size]) for i in range(len(tokens) - size + 1)}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def embedding(text: str, dimensions: int = 96) -> list[float]:
    """Hashing bag-of-words embedding.

    Deterministic, dependency-free and good enough for lexical retrieval over a
    few thousand evidence records. Swap in a hosted embedding model later by
    implementing `EmbeddingProvider`.
    """
    vector = [0.0] * dimensions
    tokens = [t for t in _tokens(text) if len(t) > 2]
    for index, token in enumerate(tokens):
        digest = hashlib.blake2b(token.encode(), digest_size=8).digest()
        bucket = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        weight = 1.0 / math.sqrt(index + 1)
        vector[bucket] += sign * weight
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [round(v / norm, 5) for v in vector]


def cosine(a: list[float] | None, b: list[float] | None) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b))


def credibility_for_source(category: str, has_url: bool, has_date: bool) -> tuple[float, str]:
    base = {
        "industry_report": 0.82,
        "news": 0.76,
        "industry_publication": 0.74,
        "company_announcement": 0.6,
        "competitor_site": 0.62,
        "review_platform": 0.58,
        "app_store": 0.55,
        "reddit": 0.5,
        "product_forum": 0.48,
    }.get(category, 0.5)
    if has_url:
        base += 0.05
    if has_date:
        base += 0.05
    base = min(0.95, base)
    label = "high" if base >= 0.72 else "moderate" if base >= 0.55 else "low"
    return round(base, 2), label


def topic_label(key: str, kind: str = "label") -> str:
    definition = TOPIC_BY_KEY.get(key)
    if not definition:
        return key.replace("_", " ").title()
    return {
        "label": definition.label,
        "complaint": definition.complaint_label,
        "praise": definition.praise_label,
        "request": definition.request_label,
    }.get(kind, definition.label)


def truncate(text: str, limit: int = 320) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    return clean if len(clean) <= limit else clean[: limit - 1].rstrip() + "…"
