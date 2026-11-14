from __future__ import annotations

import time

from tests.conftest import build_project_payload


def _run_project(client, headers, payload=None) -> dict:
    payload = payload or build_project_payload()
    created = client.post("/api/projects", json=payload, headers=headers)
    assert created.status_code == 201, created.text
    project = created.json()
    assert project["status"] == "draft"

    started = client.post(f"/api/projects/{project['id']}/run", headers=headers)
    assert started.status_code == 202, started.text

    deadline = time.time() + 60
    status = {}
    while time.time() < deadline:
        response = client.get(f"/api/projects/{project['id']}/status", headers=headers)
        assert response.status_code == 200
        status = response.json()
        if status["status"] in ("completed", "failed"):
            break
        time.sleep(0.4)
    assert status.get("status") == "completed", status
    assert status["progress"] == 100
    assert status["tasks"] and all(task["status"] == "completed" for task in status["tasks"])
    return project


def test_create_project_validates_country(client, auth_headers):
    headers, _ = auth_headers
    payload = build_project_payload()
    payload["market"]["countries"] = ["ZZ"]
    response = client.post("/api/projects", json=payload, headers=headers)
    assert response.status_code == 422
    assert any("country" in error["message"].lower() for error in response.json()["errors"])


def test_create_project_requires_market_scope(client, auth_headers):
    headers, _ = auth_headers
    payload = build_project_payload()
    payload["market"] = {"global_scope": False, "countries": [], "regions": [], "comparison_pairs": []}
    response = client.post("/api/projects", json=payload, headers=headers)
    assert response.status_code == 422


def test_create_project_rejects_inverted_period(client, auth_headers):
    headers, _ = auth_headers
    payload = build_project_payload()
    payload["config"]["research_period_start"] = "2026-10-01"
    payload["config"]["research_period_end"] = "2026-01-01"
    response = client.post("/api/projects", json=payload, headers=headers)
    assert response.status_code == 422


def test_full_demo_research_flow(client, auth_headers):
    headers, _ = auth_headers
    project = _run_project(client, headers)
    project_id = project["id"]

    detail = client.get(f"/api/projects/{project_id}", headers=headers)
    assert detail.status_code == 200
    body = detail.json()
    assert body["project"]["is_demo"] is True
    assert body["configuration"]["countries"] == ["AU", "NZ"]
    assert body["sources"]
    assert all(source["is_live"] is False for source in body["sources"])
    assert body["company"]["name"] == "Acme Analytics"

    evidence = client.get(f"/api/projects/{project_id}/evidence?page_size=100", headers=headers)
    assert evidence.status_code == 200
    evidence_body = evidence.json()
    assert evidence_body["total"] > 0
    assert evidence_body["demo"] is True
    first = evidence_body["items"][0]
    assert first["is_demo"] is True
    assert first["source_name"]
    assert first["sentiment"] in ("positive", "negative", "neutral", "mixed")
    assert first["credibility_label"] in ("high", "moderate", "low")

    failures = client.get(f"/api/projects/{project_id}/failures", headers=headers).json()
    assert failures, "expected weakness findings from the demo corpus"
    assert failures[0]["severity"] in ("critical", "high", "medium", "low")
    assert failures[0]["evidence_ids"]
    assert failures[0]["recommended_actions"]
    assert 0 < failures[0]["confidence"] <= 1

    opportunities = client.get(f"/api/projects/{project_id}/opportunities", headers=headers).json()
    assert opportunities
    assert all(item["is_estimate"] is True for item in opportunities)
    assert all(item["quadrant"] in ("quick_win", "strategic_investment", "long_term", "low_priority") for item in opportunities)

    voice = client.get(f"/api/projects/{project_id}/customer-voice", headers=headers).json()
    assert voice["summary"]["total"] > 0
    assert voice["complaint_categories"]
    assert voice["evidence"]

    filtered = client.get(
        f"/api/projects/{project_id}/customer-voice?sentiment=negative&country=AU", headers=headers
    ).json()
    assert all(item["sentiment"] == "negative" and item["country"] == "AU" for item in filtered["evidence"])

    competitors = client.get(f"/api/projects/{project_id}/competitors", headers=headers).json()
    assert competitors["primary"]["is_primary"] is True
    assert competitors["competitors"]
    assert competitors["matrix"]["rows"]

    graph = client.get(f"/api/projects/{project_id}/graph", headers=headers).json()
    assert graph["nodes"] and graph["edges"]
    categories = {node["category"] for node in graph["nodes"]}
    assert {"weakness", "risk", "opportunity"}.issubset(categories)
    node_id = graph["nodes"][0]["id"]
    node_evidence = client.get(
        f"/api/projects/{project_id}/graph/node/{node_id}/evidence", headers=headers
    ).json()
    assert "items" in node_evidence

    analytics = client.get(f"/api/projects/{project_id}/analytics", headers=headers).json()
    for key in (
        "sentiment_trend",
        "pain_points",
        "benchmark_series",
        "opportunity_matrix",
        "geography",
        "topic_trends",
        "source_distribution",
        "timeline",
    ):
        assert key in analytics
    assert analytics["totals"]["evidence"] > 0
    assert analytics["sentiment_trend"]["months"]

    report = client.get(f"/api/projects/{project_id}/report", headers=headers)
    assert report.status_code == 200
    report_body = report.json()
    assert report_body["is_demo"] is True
    assert len(report_body["sections"]) >= 8
    assert report_body["limitations"]

    export = client.get(f"/api/projects/{project_id}/report/export", headers=headers)
    assert export.status_code == 200
    assert "text/html" in export.headers["content-type"]
    assert "DEMO DATA" in export.text
    assert "Executive summary" in export.text

    roadmap = client.get(f"/api/projects/{project_id}/roadmap", headers=headers).json()
    assert roadmap
    item = roadmap[0]
    update = client.patch(
        f"/api/projects/{project_id}/roadmap/{item['id']}",
        json={"status": "in_progress", "notes": "Validated with the retention team"},
        headers=headers,
    )
    assert update.status_code == 200
    assert update.json()["status"] == "in_progress"
    assert update.json()["notes"] == "Validated with the retention team"

    roadmap_export = client.get(f"/api/projects/{project_id}/roadmap/export", headers=headers)
    assert roadmap_export.status_code == 200
    assert "Product roadmap" in roadmap_export.text

    scenario = client.post(
        f"/api/projects/{project_id}/simulate",
        json={"prompt": "What if we reduce subscription prices by 10%?"},
        headers=headers,
    )
    assert scenario.status_code == 201, scenario.text
    scenario_body = scenario.json()
    assert scenario_body["assumptions"]
    assert scenario_body["advantages"] and scenario_body["disadvantages"]
    assert scenario_body["confidence"] < 1

    comparison = client.post(
        f"/api/projects/{project_id}/simulate/compare",
        json={
            "scenarios": [
                {"prompt": "What if we enter the New Zealand market?"},
                {"prompt": "What if we improve customer support response times?"},
            ]
        },
        headers=headers,
    )
    assert comparison.status_code == 201
    assert len(comparison.json()) == 2

    chat = client.post(
        f"/api/projects/{project_id}/chat",
        json={"content": "What are the three most important problems?"},
        headers=headers,
    )
    assert chat.status_code == 200, chat.text
    chat_body = chat.json()
    assert chat_body["role"] == "assistant"
    assert chat_body["citations"], "assistant answers must cite stored evidence"
    assert chat_body["retrieval_trace"]

    history = client.get(f"/api/projects/{project_id}/chat", headers=headers).json()
    assert len(history["messages"]) == 2

    monitoring = client.get(f"/api/projects/{project_id}/monitoring", headers=headers).json()
    assert monitoring["execution_mode"] == "manual"
    assert monitoring["change_summary"]["notice"]

    run_now = client.post(f"/api/projects/{project_id}/monitoring/run", headers=headers)
    assert run_now.status_code == 200
    assert run_now.json()["recorded"] is True

    notifications = client.get("/api/notifications", headers=headers).json()
    assert notifications
    assert any(item["kind"] == "research_completed" for item in notifications)

    dashboard = client.get("/api/dashboard", headers=headers).json()
    assert dashboard["metrics"]["projects"] == 1
    assert dashboard["metrics"]["completed"] == 1
    assert dashboard["recent_projects"][0]["id"] == project_id

    listed = client.get("/api/projects?status=completed", headers=headers).json()
    assert listed["total"] == 1


def test_project_isolation_between_users(client, auth_headers):
    headers, _ = auth_headers
    project = _run_project(client, headers)

    other = client.post(
        "/api/auth/register",
        json={"email": "other-analyst@example.com", "password": "StrongPass123"},
    ).json()
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}

    assert client.get(f"/api/projects/{project['id']}", headers=other_headers).status_code == 404
    assert client.get(f"/api/projects/{project['id']}/evidence", headers=other_headers).status_code == 404
    assert client.get("/api/projects", headers=other_headers).json()["total"] == 0


def test_live_research_without_provider_is_explicit(client, auth_headers):
    headers, _ = auth_headers
    payload = build_project_payload(demo_mode=False)
    response = client.post("/api/projects", json=payload, headers=headers)
    assert response.status_code == 409
    assert "Live research is not configured" in response.json()["detail"]


def test_delete_project_removes_children(client, auth_headers):
    headers, _ = auth_headers
    project = _run_project(client, headers)
    deleted = client.delete(f"/api/projects/{project['id']}", headers=headers)
    assert deleted.status_code == 204
    assert client.get(f"/api/projects/{project['id']}", headers=headers).status_code == 404
