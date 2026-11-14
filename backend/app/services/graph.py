"""Strategic intelligence graph built from stored findings and relationships."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evidence import TopicCluster
from app.models.findings import FailureFinding, OpportunityFinding, StrategicRelationship
from app.models.research import Competitor, ResearchProject

CATEGORY_META = {
    "complaint": {"label": "Customer complaint", "color": "negative"},
    "expectation": {"label": "Customer expectation", "color": "accent"},
    "weakness": {"label": "Product weakness", "color": "negative"},
    "competitor": {"label": "Competitor strength", "color": "warning"},
    "trend": {"label": "Market trend", "color": "positive"},
    "risk": {"label": "Business risk", "color": "warning"},
    "opportunity": {"label": "Growth opportunity", "color": "positive"},
    "action": {"label": "Recommended action", "color": "navy"},
}


def build_graph(db: Session, project: ResearchProject) -> dict:
    failures = list(
        db.scalars(
            select(FailureFinding)
            .where(FailureFinding.project_id == project.id)
            .order_by(FailureFinding.evidence_count.desc())
        )
    )
    opportunities = list(
        db.scalars(select(OpportunityFinding).where(OpportunityFinding.project_id == project.id))
    )
    clusters = list(
        db.scalars(select(TopicCluster).where(TopicCluster.project_id == project.id))
    )
    competitors = list(
        db.scalars(select(Competitor).where(Competitor.project_id == project.id))
    )
    relationships = list(
        db.scalars(
            select(StrategicRelationship).where(StrategicRelationship.project_id == project.id)
        )
    )

    nodes: dict[str, dict] = {}

    def add_node(
        node_id: str,
        *,
        label: str,
        category: str,
        detail: str,
        confidence: float,
        evidence_ids: list[str] | None = None,
        meta: dict | None = None,
    ) -> None:
        if node_id in nodes:
            return
        nodes[node_id] = {
            "id": node_id,
            "label": label,
            "category": category,
            "category_label": CATEGORY_META.get(category, {}).get("label", category.title()),
            "detail": detail,
            "confidence": round(confidence, 2),
            "evidence_ids": evidence_ids or [],
            "meta": meta or {},
        }

    for cluster in clusters:
        if cluster.kind == "complaint":
            add_node(
                f"topic:{cluster.id}",
                label=cluster.label,
                category="complaint",
                detail=(
                    f"{cluster.negative_count} negative and {cluster.positive_count} positive records. "
                    f"Observed between {cluster.first_seen or 'n/a'} and {cluster.last_seen or 'n/a'}. "
                    f"Trend: {cluster.trend}."
                ),
                confidence=min(0.9, 0.4 + cluster.evidence_count * 0.05),
                meta={"evidence_count": cluster.evidence_count, "trend": cluster.trend},
            )
        elif cluster.kind == "request":
            add_node(
                f"topic:{cluster.id}",
                label=cluster.label,
                category="expectation",
                detail=(
                    f"{cluster.evidence_count} records describe what customers expect but cannot yet do."
                ),
                confidence=min(0.9, 0.4 + cluster.evidence_count * 0.05),
                meta={"evidence_count": cluster.evidence_count},
            )

    for failure in failures:
        add_node(
            f"failure:{failure.id}",
            label=failure.title,
            category="weakness",
            detail=failure.summary,
            confidence=failure.confidence,
            evidence_ids=failure.evidence_ids,
            meta={"severity": failure.severity, "evidence_count": failure.evidence_count},
        )
        add_node(
            f"risk:{failure.id}",
            label=f"Risk: {failure.category.replace('_', ' ')}",
            category="risk",
            detail=failure.business_implications or "Potential commercial exposure.",
            confidence=round(failure.confidence * 0.9, 2),
            evidence_ids=failure.evidence_ids[:6],
            meta={"severity": failure.severity},
        )

    for competitor in competitors:
        if competitor.is_primary:
            continue
        strengths = competitor.strengths or []
        weak = strengths[0] if strengths else competitor.positioning or "Limited evidence"
        add_node(
            f"competitor:{competitor.id}",
            label=f"{competitor.name}: {weak}" if strengths else competitor.name,
            category="competitor",
            detail=(
                f"{competitor.mention_count} collected records mention {competitor.name}. "
                f"{competitor.positioning or ''}"
            ).strip(),
            confidence=min(0.85, 0.35 + competitor.mention_count * 0.08),
            meta={"mention_count": competitor.mention_count, "strengths": strengths},
        )

    for opportunity in opportunities:
        add_node(
            f"opportunity:{opportunity.id}",
            label=opportunity.title,
            category="opportunity",
            detail=opportunity.description,
            confidence=opportunity.confidence,
            evidence_ids=opportunity.evidence_ids[:10],
            meta={
                "impact": opportunity.impact_score,
                "effort": opportunity.effort_score,
                "quadrant": opportunity.quadrant,
            },
        )
        add_node(
            f"action:{opportunity.id}",
            label=(opportunity.next_action or "Next action")[:110],
            category="action",
            detail=opportunity.next_action or "",
            confidence=opportunity.confidence,
            evidence_ids=opportunity.evidence_ids[:5],
            meta={"effort": opportunity.effort_score},
        )

    for cluster in clusters:
        if cluster.trend in ("emerging", "declining"):
            add_node(
                f"trend:{cluster.id}",
                label=f"{cluster.trend.title()}: {cluster.label.lower()}",
                category="trend",
                detail=f"Discussion volume is {cluster.trend} across the research period.",
                confidence=0.62,
                meta={"trend": cluster.trend},
            )

    edges = []
    for relationship in relationships:
        if relationship.source_node not in nodes or relationship.target_node not in nodes:
            continue
        edges.append(
            {
                "id": str(relationship.id),
                "source": relationship.source_node,
                "target": relationship.target_node,
                "relation": relationship.relation,
                "rationale": relationship.rationale,
                "confidence": relationship.confidence,
            }
        )

    connected = {edge["source"] for edge in edges} | {edge["target"] for edge in edges}
    return {
        "nodes": [node for node_id, node in nodes.items() if node_id in connected],
        "edges": edges,
        "legend": CATEGORY_META,
        "relationship_types": sorted({edge["relation"] for edge in edges}),
    }


def node_evidence(db: Session, project_id: uuid.UUID, node_id: str) -> list[dict]:
    """Resolve a graph node to its underlying evidence records."""
    from app.models.evidence import EvidenceRecord

    ids: list[str] = []
    kind, _, raw_id = node_id.partition(":")
    if kind == "failure":
        finding = db.get(FailureFinding, uuid.UUID(raw_id)) if _is_uuid(raw_id) else None
        ids = list(finding.evidence_ids) if finding else []
    elif kind == "opportunity":
        finding = db.get(OpportunityFinding, uuid.UUID(raw_id)) if _is_uuid(raw_id) else None
        ids = list(finding.evidence_ids) if finding else []
    elif kind == "topic":
        cluster = db.get(TopicCluster, uuid.UUID(raw_id)) if _is_uuid(raw_id) else None
        if cluster:
            definition = cluster.label.lower()
            records = db.scalars(
                select(EvidenceRecord).where(EvidenceRecord.project_id == project_id)
            )
            ids = [str(r.id) for r in records if definition[:12] in r.excerpt.lower()]
    elif kind == "risk":
        finding = db.get(FailureFinding, uuid.UUID(raw_id)) if _is_uuid(raw_id) else None
        ids = list(finding.evidence_ids)[:6] if finding else []
    elif kind == "competitor":
        competitor = db.get(Competitor, uuid.UUID(raw_id)) if _is_uuid(raw_id) else None
        if competitor:
            records = db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == project_id))
            ids = [str(r.id) for r in records if competitor.name.lower() in r.excerpt.lower()][:10]

    if not ids:
        return []
    records = db.scalars(
        select(EvidenceRecord).where(
            EvidenceRecord.project_id == project_id,
            EvidenceRecord.id.in_([uuid.UUID(i) for i in ids if _is_uuid(i)]),
        )
    )
    return [
        {
            "id": str(record.id),
            "source_name": record.source_name,
            "source_url": record.source_url,
            "sentiment": record.sentiment,
            "published_at": record.published_at.isoformat() if record.published_at else None,
            "excerpt": record.excerpt,
            "source_category": record.source_category,
        }
        for record in records
    ]


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError):
        return False
