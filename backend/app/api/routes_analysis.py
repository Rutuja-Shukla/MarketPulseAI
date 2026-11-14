from __future__ import annotations

import uuid
from collections import Counter, defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_project
from app.api.serializers import competitor_payload
from app.db.session import get_db
from app.models.evidence import EvidenceRecord, TopicCluster
from app.models.findings import FailureFinding, OpportunityFinding
from app.models.research import Competitor, ResearchProject
from app.research.taxonomy import TOPIC_BY_KEY, TOPIC_DEFINITIONS
from app.schemas.analysis import (
    CompetitorOut,
    EvidenceOut,
    FailureOut,
    GraphOut,
    OpportunityOut,
)
from app.services.analytics import project_analytics
from app.services.graph import build_graph, node_evidence

router = APIRouter(tags=["analysis"])


def _topic_key_for_label(label: str) -> str | None:
    for definition in TOPIC_DEFINITIONS:
        if label in (
            definition.label,
            definition.complaint_label,
            definition.praise_label,
            definition.request_label,
        ):
            return definition.key
    return None


def _finding_map(db: Session, project_id: uuid.UUID) -> dict[str, list[dict]]:
    mapping: dict[str, list[dict]] = defaultdict(list)
    failures = db.scalars(select(FailureFinding).where(FailureFinding.project_id == project_id))
    for failure in failures:
        for evidence_id in failure.evidence_ids or []:
            mapping[str(evidence_id)].append(
                {"id": str(failure.id), "type": "failure", "title": failure.title}
            )
    opportunities = db.scalars(
        select(OpportunityFinding).where(OpportunityFinding.project_id == project_id)
    )
    for opportunity in opportunities:
        for evidence_id in opportunity.evidence_ids or []:
            mapping[str(evidence_id)].append(
                {"id": str(opportunity.id), "type": "opportunity", "title": opportunity.title}
            )
    return mapping


def _evidence_payload(record: EvidenceRecord, mapping: dict[str, list[dict]]) -> dict:
    payload = EvidenceOut.model_validate(record).model_dump()
    payload["finding_ids"] = mapping.get(str(record.id), [])
    return payload


@router.get("/projects/{project_id}/evidence")
def list_evidence(
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=200),
    source: str | None = None,
    sentiment: str | None = None,
    country: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    contradictions_only: bool = False,
    ids: str | None = Query(default=None, description="Comma-separated evidence ids"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
) -> dict:
    all_records = list(
        db.scalars(
            select(EvidenceRecord)
            .where(EvidenceRecord.project_id == project.id)
            .order_by(EvidenceRecord.published_at.desc().nulls_last())
        )
    )
    filtered = all_records
    if ids:
        wanted = {item.strip() for item in ids.split(",") if item.strip()}
        filtered = [record for record in filtered if str(record.id) in wanted]
    if search:
        needle = search.lower()
        filtered = [
            record
            for record in filtered
            if needle in (record.excerpt or "").lower() or needle in (record.title or "").lower()
        ]
    if source:
        categories = {item.strip() for item in source.split(",") if item.strip()}
        filtered = [record for record in filtered if record.source_category in categories]
    if sentiment:
        labels = {item.strip() for item in sentiment.split(",") if item.strip()}
        filtered = [record for record in filtered if record.sentiment in labels]
    if country:
        filtered = [record for record in filtered if record.country == country.upper()]
    if date_from:
        filtered = [record for record in filtered if record.published_at and record.published_at >= date_from]
    if date_to:
        filtered = [record for record in filtered if record.published_at and record.published_at <= date_to]
    if contradictions_only:
        filtered = [record for record in filtered if record.contradiction_group]

    mapping = _finding_map(db, project.id)
    start = (page - 1) * page_size
    page_items = filtered[start : start + page_size]

    return {
        "items": [_evidence_payload(record, mapping) for record in page_items],
        "total": len(filtered),
        "page": page,
        "page_size": page_size,
        "facets": {
            "sources": [
                {"value": key, "count": count}
                for key, count in Counter(r.source_category for r in all_records).most_common()
            ],
            "sentiments": [
                {"value": key, "count": count}
                for key, count in Counter(r.sentiment for r in all_records).most_common()
            ],
            "countries": [
                {"value": key, "count": count}
                for key, count in Counter(r.country for r in all_records if r.country).most_common()
            ],
        },
        "demo": project.is_demo,
        "contradiction_count": len([r for r in all_records if r.contradiction_group]),
    }


@router.get("/projects/{project_id}/failures", response_model=list[FailureOut])
def failures(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)) -> list[FailureFinding]:
    return list(
        db.scalars(
            select(FailureFinding)
            .where(FailureFinding.project_id == project.id)
            .order_by(FailureFinding.evidence_count.desc())
        )
    )


@router.get("/projects/{project_id}/opportunities", response_model=list[OpportunityOut])
def opportunities(
    project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)
) -> list[OpportunityFinding]:
    return list(
        db.scalars(
            select(OpportunityFinding)
            .where(OpportunityFinding.project_id == project.id)
            .order_by(OpportunityFinding.impact_score.desc())
        )
    )


@router.get("/projects/{project_id}/customer-voice")
def customer_voice(
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
    search: str | None = Query(default=None, max_length=200),
    source: str | None = None,
    sentiment: str | None = None,
    country: str | None = None,
    topic: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=40, ge=1, le=120),
) -> dict:
    records = list(
        db.scalars(
            select(EvidenceRecord)
            .where(EvidenceRecord.project_id == project.id)
            .order_by(EvidenceRecord.published_at.desc().nulls_last())
        )
    )
    clusters = list(
        db.scalars(select(TopicCluster).where(TopicCluster.project_id == project.id))
    )
    mapping = _finding_map(db, project.id)

    topic_key = _topic_key_for_label(topic) if topic else None
    filtered = records
    if search:
        needle = search.lower()
        filtered = [r for r in filtered if needle in r.excerpt.lower() or needle in (r.title or "").lower()]
    if source:
        categories = {item.strip() for item in source.split(",")}
        filtered = [r for r in filtered if r.source_category in categories]
    if sentiment:
        labels = {item.strip() for item in sentiment.split(",")}
        filtered = [r for r in filtered if r.sentiment in labels]
    if country:
        filtered = [r for r in filtered if r.country == country.upper()]
    if topic_key:
        filtered = [r for r in filtered if topic_key in (r.topics or [])]
    if date_from:
        filtered = [r for r in filtered if r.published_at and r.published_at >= date_from]
    if date_to:
        filtered = [r for r in filtered if r.published_at and r.published_at <= date_to]

    counts = Counter(r.sentiment for r in records)
    topic_counts = Counter(topic for r in records for topic in (r.topics or []))
    complaints = [
        {
            "key": topic,
            "label": TOPIC_BY_KEY[topic].complaint_label,
            "count": count,
            "negative": len([r for r in records if topic in (r.topics or []) and r.sentiment == "negative"]),
            "positive": len([r for r in records if topic in (r.topics or []) and r.sentiment == "positive"]),
        }
        for topic, count in topic_counts.most_common()
        if topic in TOPIC_BY_KEY
        and len([r for r in records if topic in (r.topics or []) and r.sentiment == "negative"])
        >= len([r for r in records if topic in (r.topics or []) and r.sentiment == "positive"])
    ]
    praise = [
        {
            "key": topic,
            "label": TOPIC_BY_KEY[topic].praise_label,
            "count": count,
            "positive": len([r for r in records if topic in (r.topics or []) and r.sentiment == "positive"]),
        }
        for topic, count in topic_counts.most_common()
        if topic in TOPIC_BY_KEY
        and len([r for r in records if topic in (r.topics or []) and r.sentiment == "positive"])
        > len([r for r in records if topic in (r.topics or []) and r.sentiment == "negative"])
    ]
    requests = [
        {
            "key": cluster.label,
            "label": cluster.label,
            "count": cluster.evidence_count,
            "topic_key": _topic_key_for_label(cluster.label),
        }
        for cluster in clusters
        if cluster.kind == "request"
    ]

    return {
        "summary": {
            "total": len(records),
            "positive": counts["positive"],
            "negative": counts["negative"],
            "neutral": counts["neutral"],
            "mixed": counts["mixed"],
            "average_score": round(sum(r.sentiment_score for r in records) / len(records), 3) if records else 0,
        },
        "complaint_categories": complaints,
        "praise_categories": praise,
        "feature_requests": requests,
        "topics": [
            {
                "key": topic,
                "label": TOPIC_BY_KEY[topic].label,
                "count": count,
            }
            for topic, count in topic_counts.most_common()
            if topic in TOPIC_BY_KEY
        ],
        "evidence": [_evidence_payload(record, mapping) for record in filtered[:limit]],
        "filtered_total": len(filtered),
        "facets": {
            "sources": [
                {"value": key, "count": count}
                for key, count in Counter(r.source_category for r in records).most_common()
            ],
            "countries": [
                {"value": key, "count": count}
                for key, count in Counter(r.country for r in records if r.country).most_common()
            ],
            "sentiments": [
                {"value": key, "count": count} for key, count in counts.most_common()
            ],
        },
        "demo": project.is_demo,
    }


@router.get("/projects/{project_id}/competitors")
def competitors(
    project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)
) -> dict:
    all_competitors = list(
        db.scalars(select(Competitor).where(Competitor.project_id == project.id))
    )
    primary = next((c for c in all_competitors if c.is_primary), None)
    others = [c for c in all_competitors if not c.is_primary]
    records = list(
        db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == project.id))
    )

    dimensions = [
        {"key": "sentiment", "label": "Customer sentiment", "topic": None},
        {"key": "pricing", "label": "Pricing perception", "topic": "pricing"},
        {"key": "support", "label": "Customer experience", "topic": "customer_service"},
        {"key": "features", "label": "Capability depth", "topic": "missing_features"},
        {"key": "reporting", "label": "Reporting & analytics", "topic": "reporting_analytics"},
        {"key": "reliability", "label": "Reliability", "topic": "reliability"},
    ]

    rows = []
    for competitor in ([primary] if primary else []) + others:
        if competitor is None:
            continue
        related = (
            records
            if competitor.is_primary
            else [r for r in records if competitor.name.lower() in r.excerpt.lower()]
        )
        scores = {}
        for dimension in dimensions:
            topic = dimension["topic"]
            subset = [r for r in related if topic in (r.topics or [])] if topic else related
            if not subset:
                scores[dimension["key"]] = None
                continue
            average = sum(r.sentiment_score for r in subset) / len(subset)
            scores[dimension["key"]] = round((average + 1) * 50, 1)
        rows.append(
            {
                "id": str(competitor.id),
                "name": competitor.name,
                "is_primary": competitor.is_primary,
                "scores": scores,
                "evidence_count": len(related),
            }
        )

    timeline = []
    for competitor in others:
        mentions = [r for r in records if competitor.name.lower() in r.excerpt.lower()]
        for record in mentions:
            timeline.append(
                {
                    "date": record.published_at.isoformat() if record.published_at else None,
                    "title": record.title or record.excerpt[:90],
                    "competitor": competitor.name,
                    "source": record.source_name,
                    "sentiment": record.sentiment,
                }
            )
    timeline.sort(key=lambda item: item["date"] or "", reverse=True)

    insights = []
    for competitor in others:
        if competitor.mention_count == 0:
            continue
        insights.append(
            {
                "competitor": competitor.name,
                "mentions": competitor.mention_count,
                "sentiment_score": competitor.sentiment_score,
                "strengths": competitor.strengths,
                "weaknesses": competitor.weaknesses,
                "note": (
                    f"Based on {competitor.mention_count} records that name {competitor.name}. "
                    "No overall superiority score is assigned because coverage is not equal across vendors."
                ),
            }
        )

    return {
        "primary": competitor_payload(primary) if primary else None,
        "competitors": [competitor_payload(c) for c in others],
        "matrix": {"dimensions": dimensions, "rows": rows},
        "pricing": [
            {
                "name": c.name,
                "pricing_summary": c.pricing_summary,
                "evidence": c.source_count,
                "reliable": bool(c.pricing_summary and c.source_count >= 2),
            }
            for c in ([primary] if primary else []) + others
            if c is not None
        ],
        "timeline": timeline[:24],
        "insights": insights,
        "demo": project.is_demo,
    }


@router.get("/projects/{project_id}/graph", response_model=GraphOut)
def graph(
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
    relation: str | None = None,
    category: str | None = None,
) -> dict:
    payload = build_graph(db, project)
    if relation:
        allowed = {item.strip() for item in relation.split(",")}
        payload["edges"] = [edge for edge in payload["edges"] if edge["relation"] in allowed]
    if category:
        allowed = {item.strip() for item in category.split(",")}
        keep = {edge["source"] for edge in payload["edges"]} | {
            edge["target"] for edge in payload["edges"]
        }
        payload["nodes"] = [
            node for node in payload["nodes"] if node["category"] in allowed and node["id"] in keep
        ]
        node_ids = {node["id"] for node in payload["nodes"]}
        payload["edges"] = [
            edge
            for edge in payload["edges"]
            if edge["source"] in node_ids and edge["target"] in node_ids
        ]
    if not payload["nodes"]:
        raise HTTPException(
            status_code=404,
            detail="No relationships are available yet. Complete a standard or deep analysis first.",
        )
    return payload


@router.get("/projects/{project_id}/graph/node/{node_id}/evidence")
def graph_node_evidence(
    node_id: str,
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
) -> dict:
    items = node_evidence(db, project.id, node_id)
    return {"node_id": node_id, "items": items, "total": len(items)}


@router.get("/projects/{project_id}/analytics")
def analytics(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)) -> dict:
    if not project.evidence:
        raise HTTPException(
            status_code=404,
            detail="This project has no evidence records yet. Run the analysis to populate analytics.",
        )
    payload = project_analytics(db, project)
    payload["demo"] = project.is_demo
    payload["project_name"] = project.name
    return payload
