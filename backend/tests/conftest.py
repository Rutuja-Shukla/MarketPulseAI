from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", f"sqlite:///./test-{uuid.uuid4().hex}.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-marketpulse-tests-0001")
os.environ.setdefault("SEED_DEMO_ON_STARTUP", "false")
os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("RATE_LIMIT_AI_PER_HOUR", "500")


@pytest.fixture(scope="session")
def app_module():
    from app.main import app

    return app


@pytest.fixture()
def client(app_module):
    from fastapi.testclient import TestClient

    with TestClient(app_module) as test_client:
        yield test_client


@pytest.fixture()
def db_session():
    from app.db.session import SessionLocal, init_db

    init_db()
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def auth_headers(client):
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "TestPassword123", "full_name": "Test Analyst"},
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, email


def build_project_payload(**overrides) -> dict:
    payload = {
        "name": "Acme Signals market assessment",
        "company": {
            "name": "Acme Analytics",
            "website": "acme.example",
            "industry": "B2B SaaS",
            "product_name": "Acme Signals",
            "description": "Customer intelligence dashboards for e-commerce teams.",
            "target_audience": "Growth and retention teams",
        },
        "market": {
            "global_scope": False,
            "countries": ["AU", "NZ"],
            "regions": ["Oceania"],
            "comparison_pairs": [["AU", "NZ"]],
        },
        "situation": {"key": "losing_customers", "description": "Renewals are harder this quarter."},
        "objectives": ["sentiment", "pricing", "competitors"],
        "assumptions": ["We believe customers leave because pricing is too expensive."],
        "competitors": [{"name": "Orbit Metrics"}],
        "config": {
            "source_categories": ["reddit", "review_platform", "news"],
            "depth": "standard",
            "competitor_target": 2,
        },
        "demo_mode": True,
    }
    payload.update(overrides)
    return payload
