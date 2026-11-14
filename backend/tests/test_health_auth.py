from __future__ import annotations

import uuid


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"


def test_catalog_is_public(client):
    response = client.get("/api/meta/catalog")
    assert response.status_code == 200
    body = response.json()
    assert any(country["code"] == "AU" for country in body["countries"])
    assert len(body["modes"]) == 3
    assert {mode["key"] for mode in body["modes"]} == {"quick", "standard", "deep"}


def test_register_login_and_me(client):
    email = f"analyst-{uuid.uuid4().hex[:8]}@example.com"
    register = client.post(
        "/api/auth/register",
        json={"email": email, "password": "StrongPass123", "full_name": "Dana Reid"},
    )
    assert register.status_code == 201, register.text
    token = register.json()["access_token"]

    login = client.post("/api/auth/login", json={"email": email, "password": "StrongPass123"})
    assert login.status_code == 200
    assert login.json()["user"]["email"] == email

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["full_name"] == "Dana Reid"


def test_duplicate_registration_is_rejected(client):
    email = f"dup-{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "StrongPass123"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    second = client.post("/api/auth/register", json=payload)
    assert second.status_code == 409


def test_wrong_password_is_rejected(client):
    email = f"wrong-{uuid.uuid4().hex[:8]}@example.com"
    client.post("/api/auth/register", json={"email": email, "password": "StrongPass123"})
    response = client.post("/api/auth/login", json={"email": email, "password": "nope-nope"})
    assert response.status_code == 401


def test_protected_routes_require_auth(client):
    assert client.get("/api/dashboard").status_code == 401
    assert client.get("/api/projects").status_code == 401

    invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert invalid.status_code == 401


def test_short_password_is_rejected(client):
    response = client.post(
        "/api/auth/register", json={"email": f"short-{uuid.uuid4().hex[:6]}@example.com", "password": "short"}
    )
    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "password"
