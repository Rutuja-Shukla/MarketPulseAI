"""Retrieval-augmented research assistant.

Answers are grounded in retrieved evidence records and stored findings. Without
a configured LLM the assistant returns a retrieval brief that quotes the
retrieved records verbatim — it never fabricates an answer.
"""
from __future__ import annotations

import uuid
from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.llm import LLMProviderError, try_get_llm, untrusted_block
from app.core.logging import get_logger
from app.models.chat import ChatConversation, ChatMessage
from app.models.evidence import EvidenceRecord
from app.models.findings import FailureFinding, OpportunityFinding
from app.models.research import Competitor, ResearchProject
from app.services.text_analysis import classify_topics, cosine, embedding, truncate

logger = get_logger(__name__)


def retrieve(db: Session, project: ResearchProject, question: str, limit: int = 6) -> list[EvidenceRecord]:
    records = list(
        db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == project.id))
    )
    if not records:
        return []
    question_vector = embedding(question)
    question_topics = set(classify_topics(question))
    scored: list[tuple[float, EvidenceRecord]] = []
    for record in records:
        similarity = cosine(question_vector, record.embedding)
        topic_bonus = 0.12 * len(question_topics & set(record.topics or []))
        recency = 0.02 if record.published_at else 0.0
        scored.append((similarity + topic_bonus + recency, record))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [record for score, record in scored[:limit] if score > 0.02] or [r for _, r in scored[:limit]]


def answer(db: Session, project: ResearchProject, conversation: ChatConversation, question: str) -> ChatMessage:
    records = retrieve(db, project, question)
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
    competitors = list(
        db.scalars(select(Competitor).where(Competitor.project_id == project.id))
    )
    related_topics = set(classify_topics(question))
    relevant_findings = [f for f in failures if f.category in related_topics] or failures[:3]
    relevant_opportunities = opportunities[:3]

    citations = [
        {
            "id": str(record.id),
            "source_name": record.source_name,
            "source_url": record.source_url,
            "excerpt": truncate(record.excerpt, 220),
            "sentiment": record.sentiment,
            "published_at": record.published_at.isoformat() if record.published_at else None,
            "is_demo": record.is_demo,
        }
        for record in records
    ]
    trace = [
        {"step": "embed_query", "detail": "96-dimension hashing embedding of the question"},
        {"step": "retrieve", "detail": f"{len(records)} evidence records retrieved by cosine similarity + topic match"},
        {"step": "findings", "detail": f"{len(relevant_findings)} related structured findings attached"},
    ]

    provider = "retrieval-v1"
    llm = try_get_llm()
    content: str | None = None
    if llm is not None and not project.is_demo:
        context = "\n\n".join(
            untrusted_block(
                f"EVIDENCE {index + 1} — {record.source_name} ({record.source_category}, "
                f"{record.published_at or 'undated'}, {record.sentiment})",
                f"{record.title or ''}\n{record.excerpt}",
                800,
            )
            for index, record in enumerate(records)
        )
        findings_text = "\n".join(
            f"- {f.title} | severity {f.severity} | {f.evidence_count} records | confidence {f.confidence}"
            for f in relevant_findings
        )
        try:
            payload = llm.generate_json(
                "Answer the analyst's question about this research project using ONLY the evidence below. "
                "Cite evidence by number in square brackets. If the evidence does not answer the question, "
                "say what additional research is needed. Keep the answer under 220 words.\n"
                f"Company: {project.company.name}\nProduct: {project.product_name}\n"
                f"Findings:\n{findings_text}\n\nEvidence:\n{context}\n\nQuestion: {question}",
                schema_hint='{"answer": "string"}',
            )
            content = str(payload.get("answer", "")).strip() or None
            if content:
                provider = "gemini-rag-v1"
        except (LLMProviderError, ValueError) as exc:
            logger.warning("assistant_llm_failed", extra={"event": str(exc)})

    if content is None:
        content = _retrieval_brief(project, question, records, relevant_findings, relevant_opportunities, competitors)

    message = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=content,
        citations=citations,
        retrieval_trace=trace,
        provider=provider,
    )
    db.add(message)
    db.flush()
    return message


def _retrieval_brief(
    project: ResearchProject,
    question: str,
    records: list[EvidenceRecord],
    failures: list[FailureFinding],
    opportunities: list[OpportunityFinding],
    competitors: list[Competitor],
) -> str:
    if not records:
        return (
            "This project has no stored evidence yet, so I cannot answer from research. "
            "Run an analysis first — I will not speculate without records."
        )
    topic_records: dict[str, list[EvidenceRecord]] = defaultdict(list)
    for record in records:
        for topic in record.topics or []:
            topic_records[topic].append(record)
    lines = [
        f"Retrieval summary for **{project.company.name}** — no LLM is configured, so this answer is assembled "
        f"directly from {len(records)} retrieved evidence records.",
        "",
    ]
    if failures:
        lines.append("**Relevant findings**")
        for finding in failures[:3]:
            lines.append(
                f"- {finding.title} — {finding.severity} severity, {finding.evidence_count} records, "
                f"confidence {int(finding.confidence * 100)}%. {finding.summary}"
            )
        lines.append("")
    lines.append("**What the retrieved evidence says**")
    for index, record in enumerate(records[:4], start=1):
        lines.append(
            f"{index}. {record.source_name} ({record.published_at or 'undated'}, {record.sentiment}): "
            f"“{truncate(record.excerpt, 210)}”"
        )
    lines.append("")
    if topic_records:
        top_topic, top_records = max(topic_records.items(), key=lambda item: len(item[1]))
        lines.append(
            f"**Pattern** — {len(top_records)} of the retrieved records relate to {top_topic.replace('_', ' ')}. "
            f"{len([r for r in top_records if r.sentiment == 'negative'])} are negative."
        )
    if opportunities:
        lines.append(
            f"**Prioritisation** — highest AI-assessed impact is “{opportunities[0].title}” "
            f"(impact {int(opportunities[0].impact_score)}, effort {int(opportunities[0].effort_score)})."
        )
    named = [c.name for c in competitors if not c.is_primary and c.mention_count > 0]
    if named:
        lines.append(f"**Competitors referenced** — {', '.join(named[:3])}.")
    lines.append("")
    lines.append(
        "Evidence records are linked below. Set `GEMINI_API_KEY` to enable narrative synthesis; "
        "the citation set stays the same."
    )
    return "\n".join(lines)


def get_or_create_conversation(db: Session, project: ResearchProject, user_id: uuid.UUID) -> ChatConversation:
    conversation = db.scalars(
        select(ChatConversation)
        .where(
            ChatConversation.project_id == project.id,
            ChatConversation.user_id == user_id,
        )
        .order_by(ChatConversation.created_at.asc())
    ).first()
    if conversation:
        return conversation
    conversation = ChatConversation(
        project_id=project.id,
        user_id=user_id,
        title=f"Assistant — {project.company.name}",
    )
    db.add(conversation)
    db.flush()
    return conversation
