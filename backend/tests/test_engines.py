from __future__ import annotations

import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base
from app.models.research import ResearchConfiguration, ResearchProject
from app.models.user import Company, User
from app.research.demo_corpus import DEMO_EVIDENCE
from app.services.analysis_engine import AnalysisEngine
from app.services.text_analysis import (
    analyse_sentiment,
    classify_topics,
    credibility_for_source,
    embedding,
    jaccard,
    shingles,
)


@pytest.fixture()
def engine_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def project(engine_session):
    user = User(email=f"engine-{uuid.uuid4().hex[:6]}@example.com", password_hash="x")
    engine_session.add(user)
    engine_session.flush()
    company = Company(user_id=user.id, name="Acme Analytics", industry="B2B SaaS")
    engine_session.add(company)
    engine_session.flush()
    project = ResearchProject(
        user_id=user.id,
        company_id=company.id,
        name="Engine test",
        product_name="Acme Signals",
        mode="deep",
        status="draft",
        is_demo=True,
    )
    engine_session.add(project)
    engine_session.flush()
    engine_session.add(
        ResearchConfiguration(
            project_id=project.id,
            countries=["AU", "NZ"],
            source_categories=["reddit", "review_platform"],
            assumptions=[{"text": "We believe customers leave because pricing is expensive.", "status": "pending"}],
        )
    )
    engine_session.commit()
    engine_session.refresh(project)
    return project


def test_sentiment_labels():
    label, score, confidence = analyse_sentiment("I love this product, excellent support and fast dashboards")
    assert label == "positive"
    assert score > 0
    assert confidence > 0.3

    label, score, _ = analyse_sentiment("Terrible experience, expensive and slow, support ignored my ticket")
    assert label == "negative"
    assert score < 0

    label, score, _ = analyse_sentiment("The dashboard opens on a Monday.")
    assert label == "neutral"
    assert abs(score) < 0.2


def test_negation_flips_sentiment():
    _, positive_score, _ = analyse_sentiment("The support team is helpful")
    _, negated_score, _ = analyse_sentiment("The support team is not helpful")
    assert positive_score > 0
    assert negated_score < positive_score


def test_topic_classification():
    topics = classify_topics("The per seat pricing is too expensive and the support is slow")
    assert "pricing" in topics
    assert "customer_service" in topics


def test_near_duplicate_detection():
    a = shingles("Lumenly pricing is expensive for a six person growth team in Australia")
    b = shingles("Lumenly pricing is expensive for a six person growth team in Australia today")
    c = shingles("Completely different content about support response times and outages")
    assert jaccard(a, b) > 0.7
    assert jaccard(a, c) < 0.1


def test_embeddings_are_normalised_and_stable():
    first = embedding("pricing complaints from Australian customers")
    second = embedding("pricing complaints from Australian customers")
    assert first == second
    assert len(first) == 96
    assert abs(sum(v * v for v in first) - 1.0) < 0.01


def test_credibility_prefers_primary_research():
    high, label = credibility_for_source("industry_report", True, True)
    low, low_label = credibility_for_source("reddit", False, False)
    assert high > low
    assert label == "high"
    assert low_label == "low"


def test_ingest_deduplicates_and_classifies(engine_session, project):
    engine = AnalysisEngine(engine_session, project)
    records = [
        {
            "source_category": "reddit",
            "source_name": "Reddit",
            "text": "Lumenly is too expensive for our team, the per seat pricing is a real problem.",
            "published_at": None,
            "title": "Pricing",
        },
        {
            "source_category": "reddit",
            "source_name": "Reddit",
            "text": "Lumenly is too expensive for our team, the per seat pricing is a real problem.",
            "published_at": None,
            "title": "Pricing duplicate",
        },
        {
            "source_category": "review_platform",
            "source_name": "Trustpilot",
            "text": "Support is slow and they ignored my ticket for a week.",
            "published_at": None,
            "title": "Support",
        },
    ]
    created = engine.ingest(records, is_demo=True, source_map={})
    assert len(created) == 2, "near-identical records must be deduplicated"
    labels = {record.sentiment for record in created}
    assert "negative" in labels
    assert all(record.is_demo for record in created)


def test_findings_are_derived_from_evidence(engine_session, project):
    engine = AnalysisEngine(engine_session, project)
    records = [
        {
            "source_category": record["source_category"],
            "source_name": record["source_name"],
            "text": record["text"],
            "published_at": record["published_at"],
            "country": record["country"],
            "title": record["title"],
            "rating": record["rating"],
        }
        for record in DEMO_EVIDENCE
        if record["source_category"] in ("reddit", "review_platform")
    ]
    created = engine.ingest(records, is_demo=True, source_map={})
    assert len(created) > 20

    engine.build_competitors(["Orbit Metrics", "ClarityStack"])
    clusters = engine.build_topics()
    assert clusters

    failures = engine.build_failures()
    assert failures
    for finding in failures:
        assert finding.evidence_count >= 1
        assert finding.evidence_ids
        assert 0 < finding.confidence <= 1
        assert finding.severity in ("critical", "high", "medium", "low")
        assert finding.is_observed_complaint is True
        # every finding must trace to a stored record
        assert all(evidence_id for evidence_id in finding.evidence_ids)

    opportunities = engine.build_opportunities()
    assert opportunities
    for opportunity in opportunities:
        assert opportunity.is_estimate is True
        assert opportunity.quadrant in ("quick_win", "strategic_investment", "long_term", "low_priority")
        if opportunity.impact_score >= 65 and opportunity.effort_score <= 45:
            assert opportunity.quadrant == "quick_win"

    assumptions = engine.assess_assumptions(
        [{"text": "We believe customers are switching because subscription pricing is too expensive."}]
    )
    assert assumptions[0]["status"] in ("supported", "partially_supported")
    assert assumptions[0]["support_count"] >= 1
    assert assumptions[0]["evidence_ids"]

    relationships = engine.build_relationships()
    assert relationships
    assert {r.relation for r in relationships} >= {"surfaces_as", "creates_risk", "recommends"}

    roadmap = engine.build_roadmap()
    assert roadmap
    assert all(item.success_metrics for item in roadmap)

    report = engine.build_report(provider="test")
    assert report.executive_summary
    assert len(report.sections) >= 8
    assert report.is_demo is True


def test_ingest_handles_empty_payload(engine_session, project):
    engine = AnalysisEngine(engine_session, project)
    assert engine.ingest([], is_demo=True, source_map={}) == []
