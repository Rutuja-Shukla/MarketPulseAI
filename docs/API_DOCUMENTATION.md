# API documentation

| | |
| --- | --- |
| Base path | `/api` (e.g. `http://localhost:8000/api`) |
| Interactive docs | `/docs` (Swagger UI) · `/openapi.json` (schema) |
| Liveness | `GET /health` — **outside** `/api` |
| Content type | `application/json` (except report/roadmap exports) |
| Auth | `Authorization: Bearer <jwt>` on every route marked **✔** |
| Versioning | none; the client ships with the server, contracts are the Pydantic models |

> Every example below uses synthetic demonstration data. No real credentials,
> tokens, customer records or keys appear in this document.

---

## 1. Authentication and errors

### Bearer token

Tokens are issued by `POST /auth/register`, `POST /auth/login` and `POST /auth/demo`.
Payload: `{"sub": "<user uuid>", "exp": ..., "iat": ...}`, HS256, lifetime
`ACCESS_TOKEN_EXPIRE_MINUTES` (default 10080 = 7 days).

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@marketpulse.ai","password":"DemoPass123!"}'
```

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": {
    "id": "3f2b7c1e-9a44-4c1f-8f0e-0d6a1b2c3d4e",
    "email": "demo@marketpulse.ai",
    "full_name": "Avery Chen",
    "company_name": "Lumenly",
    "is_demo": true
  }
}
```

### Error envelope

Every error carries a `request_id` that also appears in the server log line for the
same request.

| Status | When | Body |
| --- | --- | --- |
| `400` | invalid request semantics (e.g. editing a running project) | `{"detail": "...", "request_id": "..."}` |
| `401` | missing/malformed/expired token, bad credentials, deleted user | `{"detail": "...", "request_id": "..."}` (with `WWW-Authenticate: Bearer` on missing credentials) |
| `404` | unknown **or foreign** resource (deliberate: existence is not confirmed) | `{"detail": "Research project not found", "request_id": "..."}` |
| `409` | conflicting state, duplicate account, missing capability | `{"detail": "...", "request_id": "..."}` |
| `422` | schema validation | `{"detail": "Some fields need attention.", "errors": [{"field": "market.countries", "message": "..."}], "request_id": "..."}` |
| `429` | AI rate limit exceeded | `{"detail": "Rate limit reached (60 requests/hour for this action). Try again later.", "request_id": "..."}` |
| `500` | unhandled exception | `{"detail": "Something went wrong on our side. The error has been logged.", "request_id": "..."}` |
| `502` | model failure where no deterministic fallback exists (`suggest-competitors`) | `{"detail": "Competitor suggestion failed: ...", "request_id": "..."}` |
| `503` | demo workspace requested before seeding | `{"detail": "The demonstration workspace is not seeded yet. ..."}` |

### Rate limits

Implemented as an in-process sliding window, keyed by `(scope, user)`, default 60
requests/hour (`RATE_LIMIT_AI_PER_HOUR`). Costs are weighted:

| Endpoint | Scope | Cost |
| --- | --- | --- |
| `POST /projects/{id}/run` | `research-run` | 3 |
| `POST /projects/{id}/simulate` | `simulator` | 2 |
| `POST /projects/{id}/simulate/compare` | `simulator` | number of scenarios (2–4) |
| `POST /projects/{id}/chat` | `assistant` | 1 |
| `POST /projects/{id}/report/regenerate` | `report` | 1 |
| `POST /projects/suggest-competitors` | `suggest-competitors` | 1 |

All other endpoints are unmetered. The limiter is per process (see
[`SECURITY.md`](SECURITY.md) §9).

---

## 2. Auth, meta and dashboard

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Create an analyst account → **201** token |
| POST | `/auth/login` | — | Email + password → token |
| POST | `/auth/demo` | — | Token for the seeded demo analyst (disabled when `DEMO_MODE=false` → 404) |
| GET | `/auth/me` | ✔ | Current user |
| GET | `/meta/catalog` | — | Countries, regions, source categories, objectives, situations, modes, topics, monitoring tracks, demo availability |
| GET | `/meta/capabilities` | — | Provider configuration, limitations, demo project id, demo credentials when `DEMO_MODE=true` |
| GET | `/dashboard` | ✔ | Metrics, recent projects, latest reports, notifications |
| GET | `/health` | — | Liveness + database check (root, not `/api`) |

### `POST /auth/register`

```json
{ "email": "analyst@example.com", "password": "at-least-8-chars", "full_name": "Dana Reid", "company_name": "Acme" }
```

Validation: `EmailStr`, password 8–128 characters, `full_name` ≤ 160,
`company_name` ≤ 160. Duplicate email → **409**. Returns `201` with the same body as
login. Email is stored lower-cased.

### `GET /meta/catalog` (200, abridged)

```json
{
  "countries": [{ "code": "AU", "name": "Australia", "region": "Oceania" }],
  "regions": ["Africa", "Asia", "Europe", "Middle East", "North America", "Oceania", "South America"],
  "source_categories": [{ "key": "reddit", "label": "Reddit discussions", "note": "Public community threads; access via search provider." }],
  "objectives": [{ "key": "sentiment", "label": "Understand customer sentiment" }],
  "situations": [{ "key": "losing_customers", "label": "Losing customers to competitors" }],
  "modes": [
    { "key": "quick", "label": "Quick Scan", "description": "…", "stages": 10, "query_budget": 4, "competitors": 2, "capabilities": ["sentiment", "topics", "failures"] },
    { "key": "standard", "label": "Standard Analysis", "description": "…", "stages": 15, "query_budget": 8, "competitors": 3, "capabilities": ["sentiment", "topics", "failures", "opportunities", "competitors"] },
    { "key": "deep", "label": "Deep Intelligence", "description": "…", "stages": 18, "query_budget": 14, "competitors": 4, "capabilities": ["sentiment", "topics", "failures", "opportunities", "competitors", "trends", "contradictions"] }
  ],
  "topics": [{ "key": "pricing", "label": "Pricing & perceived value", "description": "…" }],
  "monitoring_tracks": [{ "key": "sentiment", "label": "Customer sentiment changes" }],
  "demo": { "available": true, "email": "demo@marketpulse.ai", "password_hint": "Password is shown on the demo card" }
}
```

### `GET /meta/capabilities` (200)

```json
{
  "demo_mode": true,
  "search_provider": "none",
  "search_configured": false,
  "llm_provider": "gemini",
  "llm_configured": false,
  "live_research_available": false,
  "job_runner": "inline",
  "limitations": [
    "No search provider configured — live source discovery is disabled.",
    "No LLM API key configured — live evidence reasoning is disabled."
  ],
  "demo_project_id": "<uuid or null>",
  "demo_credentials": { "email": "demo@marketpulse.ai", "password": "DemoPass123!" }
}
```

`demo_credentials` is `null` when `DEMO_MODE=false`. The UI uses this endpoint to
render capability banners instead of guessing.

### `GET /dashboard` (200, abridged)

```json
{
  "metrics": { "projects": 1, "completed": 1, "evidence": 47, "failures": 11, "critical_risks": 3, "opportunities": 13, "unread_notifications": 3 },
  "recent_projects": [{ "id": "<uuid>", "name": "Lumenly Signals — ANZ & India market position", "mode": "deep", "status": "completed", "is_demo": true, "progress": 100, "evidence_count": 47, "failure_count": 11, "opportunity_count": 13, "company_name": "Lumenly", "countries": ["AU", "NZ", "IN", "GB"], "global_scope": false }],
  "completed_projects": [],
  "notifications": [{ "id": "<uuid>", "kind": "research_completed", "title": "Analysis ready: …", "body": "47 evidence records, 11 weaknesses and 13 opportunities.", "read": false, "action_route": "/analysis/<uuid>/report", "created_at": "2026-11-14T09:12:00Z" }],
  "demo_mode": true,
  "live_research_available": false
}
```

### `GET /health` (200)

```json
{ "status": "ok", "database": "ok", "demo_mode": true, "live_research_available": false, "job_runner": "inline", "environment": "development" }
```

`status` becomes `degraded` and `database` `unavailable` when `SELECT 1` fails; the
route still returns **200** so a supervisor can distinguish "process up, dependency
down".

---

## 3. Projects

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/projects` | ✔ | Create a project from a brief → **201** |
| POST | `/projects/suggest-competitors` | ✔ | LLM competitor suggestions (not persisted) |
| GET | `/projects` | ✔ | List own projects (`?status=&q=`) |
| GET | `/projects/{id}` | ✔ | Project + configuration + tasks + competitors + sources + company |
| PATCH | `/projects/{id}` | ✔ | Rename and/or change depth (regenerates the task ledger) |
| DELETE | `/projects/{id}` | ✔ | Delete project and all children → **204** |
| POST | `/projects/{id}/run` | ✔ | Start/restart the pipeline → **202** |
| GET | `/projects/{id}/status` | ✔ | Stage ledger, current stage, progress, error |
| GET | `/projects/{id}/sources` | ✔ | Source coverage summary |

### `POST /projects` — request body

```json
{
  "name": "Lumenly market assessment",
  "company": {
    "name": "Lumenly",
    "website": "lumenly.example",
    "industry": "B2B SaaS",
    "product_name": "Lumenly Signals",
    "description": "Revenue intelligence for mid-market teams",
    "target_audience": "RevOps leads"
  },
  "market": {
    "global_scope": false,
    "countries": ["AU", "NZ"],
    "regions": ["Oceania"],
    "comparison_pairs": [["AU", "NZ"]]
  },
  "situation": { "key": "losing_customers", "description": "Renewals are harder this quarter." },
  "objectives": ["sentiment", "pricing", "competitors"],
  "assumptions": ["Customers are switching because pricing is too high."],
  "competitors": [{ "name": "Orbit Metrics", "website": "orbit.example" }],
  "config": {
    "source_categories": ["reddit", "review_platform", "news"],
    "depth": "standard",
    "competitor_target": 2,
    "research_period_start": "2025-01-01",
    "research_period_end": "2026-01-01",
    "analysis_preferences": {},
    "notes": "Internal assessment"
  },
  "demo_mode": false
}
```

**Validation rules** (enforced by `schemas/project.py`, all failures → **422**):

| Field | Rule |
| --- | --- |
| `name` | 3–240 characters |
| `company.name` | 1–200; `website` normalised to `https://…` and must contain a dot; `description` ≤ 4000; `target_audience` ≤ 2000 |
| `market.countries` | must be known ISO codes (`COUNTRY_BY_CODE`), max 40, de-duplicated and upper-cased |
| `market` | at least one country/region unless `global_scope` is true; `comparison_pairs` entries must have exactly two codes; max 6 pairs |
| `objectives`, `assumptions` | max 12 each (keys are not validated against the catalog) |
| `competitors` | max 10; name 1–200; a competitor with the same name as the company is skipped |
| `config.source_categories` | non-empty, every key in `SOURCE_CATEGORY_KEYS` |
| `config.depth` | `quick` \| `standard` \| `deep` |
| `config.competitor_target` | 1–6 |
| `config` period | `research_period_start ≤ research_period_end` when both are set |
| `demo_mode` | `true` requires `DEMO_MODE=true`; `false` requires a configured search provider |

**Capability guards** (checked before insertion): live project without a provider →
**409**; demo project with `DEMO_MODE=false` → **409**.

**Side effects:** creates `companies` + `products` + `research_projects` +
`research_configurations` + `competitors`, then `prepare()` inserts the stage ledger
(all `pending`). The project is returned with `status: "draft"` and `progress: 0`.

**Success (201, abridged):**

```json
{
  "id": "576c7292-ba72-48bc-b151-f4586c943600",
  "name": "Lumenly market assessment",
  "mode": "standard",
  "status": "draft",
  "is_demo": false,
  "summary": null,
  "current_stage": null,
  "error_message": null,
  "evidence_count": 0,
  "failure_count": 0,
  "opportunity_count": 0,
  "created_at": "2026-11-16T10:04:12Z",
  "completed_at": null,
  "product_name": "Lumenly Signals",
  "company_name": "Lumenly",
  "countries": ["AU", "NZ"],
  "global_scope": false,
  "progress": 0
}
```

### `POST /projects/{id}/run` (202)

```json
{ "status": "queued", "runner": "inline" }
```

- Already `queued`/`running` → **200** `{"status": "...", "message": "Research is already in progress"}` (no new job).
- Live project without a provider → **409**.
- Rate limit cost 3 → **429** when exhausted.

### `GET /projects/{id}/status` (200)

```json
{
  "id": "<uuid>",
  "status": "running",
  "current_stage": "sentiment_classification",
  "error_message": null,
  "progress": 47,
  "tasks": [
    {
      "id": "<uuid>",
      "stage": "understand_request",
      "agent": "orchestrator",
      "name": "Understand company, product and geography",
      "status": "completed",
      "progress": 100,
      "detail": "Standard Analysis for Lumenly (Lumenly Signals) in Australia, New Zealand. Objectives: …",
      "result_count": 1,
      "order_index": 0,
      "started_at": "2026-11-16T10:04:31Z",
      "finished_at": "2026-11-16T10:04:31Z"
    }
  ],
  "evidence_count": 19,
  "is_demo": false
}
```

`progress` = `completed == all ? 100 : ((completed + 0.5 × running) / total) × 100`.

### `GET /projects/{id}` (200, abridged)

```json
{
  "project": { "id": "<uuid>", "name": "…", "status": "completed", "progress": 100, "…": "…" },
  "configuration": {
    "global_scope": false, "countries": ["AU", "NZ"], "regions": ["Oceania"], "comparison_pairs": [["AU","NZ"]],
    "situation": "losing_customers", "situation_description": "…",
    "objectives": ["sentiment", "pricing"], "assumptions": [{ "text": "…", "status": "supported", "rationale": "…", "support_count": 4, "contradict_count": 1, "evidence_ids": ["<uuid>"], "topics": ["pricing"] }],
    "source_categories": ["reddit", "review_platform"], "research_period_start": "2025-01-01", "research_period_end": "2026-01-01",
    "depth": "standard", "competitor_target": 2, "analysis_preferences": {}, "notes": null
  },
  "tasks": [{ "stage": "…", "status": "completed", "…": "…" }],
  "competitors": [{ "name": "Orbit Metrics", "is_primary": false, "mention_count": 4, "strengths": [], "weaknesses": ["Pricing concerns"], "observations": [{ "dimension": "pricing", "value": "…", "score": 0.12, "evidence_id": "<uuid>" }] }],
  "sources": [{ "id": "<uuid>", "name": "Review platforms", "category": "review_platform", "provider": "demo_dataset", "is_live": false, "record_count": 18, "description": "…", "base_url": null }],
  "company": { "name": "Lumenly", "website": "https://lumenly.example", "industry": "B2B SaaS", "description": "…", "target_audience": "…" }
}
```

### `PATCH /projects/{id}`

```json
{ "name": "Renamed assessment", "mode": "deep" }
```

Both fields optional (name 3–240). Editing while `status == "running"` → **409**.
Changing `mode` updates the configuration depth and regenerates the task ledger, so
the next run uses the new stage list.

### `DELETE /projects/{id}` → **204** (no body). Cascade details in
[`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) §12.

### `POST /projects/suggest-competitors`

```json
{ "company_name": "Lumenly", "product_name": "Lumenly Signals", "industry": "B2B SaaS", "description": "Revenue intelligence" }
```

Requires a configured LLM; otherwise **409** with an actionable message. Not stored
until the analyst adds them to a brief. Response (200):

```json
{
  "competitors": [{ "name": "Orbit Metrics", "website": null, "reason": "Mid-market revenue analytics", "source": "llm_suggestion" }],
  "note": "Model suggestions — verify before relying on them."
}
```

At most 5 items; malformed model output → **502**.

---

## 4. Analysis

All routes are project-scoped and inherit ownership checks (foreign id → **404**).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/projects/{id}/evidence` | Paginated, filterable evidence with facets |
| GET | `/projects/{id}/failures` | Weakness findings (severity, confidence, evidence ids) |
| GET | `/projects/{id}/opportunities` | Opportunities with impact/effort/quadrant |
| GET | `/projects/{id}/customer-voice` | Sentiment summary, complaint/praise categories, requests, filtered quotes |
| GET | `/projects/{id}/competitors` | Matrix, pricing table, mention timeline, per-competitor insight |
| GET | `/projects/{id}/graph` | Nodes + typed edges (+ `?relation=`, `?category=` filters) |
| GET | `/projects/{id}/graph/node/{node_id}/evidence` | Records behind one graph node |
| GET | `/projects/{id}/analytics` | Eight chart datasets + totals (**404** when the project has no evidence) |

### `GET /projects/{id}/evidence`

| Query param | Type | Notes |
| --- | --- | --- |
| `search` | string ≤ 200 | case-insensitive substring over title + excerpt |
| `source` | comma list | source categories |
| `sentiment` | comma list | `positive,negative,neutral,mixed` |
| `country` | string | upper-cased ISO code, exact match |
| `date_from`, `date_to` | ISO date | inclusive, on `published_at` |
| `contradictions_only` | bool | records with a `contradiction_group` |
| `ids` | comma list | fetch specific records (used by graph drill-down) |
| `page` | int ≥ 1 | default 1 |
| `page_size` | int 1–100 | default 25 |

```json
{
  "items": [
    {
      "id": "9a1c…",
      "source_name": "Trustpilot",
      "source_url": "https://demo.marketpulse.ai/reviews/lumenly-price-jump",
      "source_category": "review_platform",
      "published_at": "2025-10-20",
      "collected_at": "2026-11-14T09:00:00Z",
      "title": "Still too expensive for what we use",
      "excerpt": "We use maybe 20% of the platform and still pay for five seats minimum…",
      "country": "AU",
      "author_handle": null,
      "rating": 2.0,
      "sentiment": "mixed",
      "sentiment_score": -0.22,
      "topics": ["pricing", "subscription_management"],
      "key_phrases": ["platform", "seats", "value"],
      "credibility_score": 0.63,
      "credibility_label": "moderate",
      "corroboration_count": 4,
      "duplicate_status": "unique",
      "contradiction_group": "topic:pricing",
      "is_demo": true,
      "finding_ids": [{ "id": "<uuid>", "type": "failure", "title": "Pricing concerns in Lumenly Signals" }]
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 25,
  "facets": {
    "sources": [{ "value": "review_platform", "count": 18 }],
    "sentiments": [{ "value": "negative", "count": 21 }],
    "countries": [{ "value": "AU", "count": 14 }]
  },
  "demo": true,
  "contradiction_count": 34
}
```

Filtering is applied in Python over the project's records before pagination, so
`total` is exact but the work is O(n) per request (see
[`PERFORMANCE.md`](PERFORMANCE.md) §3).

### `GET /projects/{id}/failures` (200)

```json
[
  {
    "id": "<uuid>",
    "title": "Pricing concerns in Lumenly Signals",
    "category": "pricing",
    "severity": "critical",
    "summary": "13 of 20 collected records touching pricing & perceived value are negative across 6 source categories (AU, GB, IN, NZ). Recurring, corroborated and material.",
    "observed_complaint": "…",
    "interpretation": "Customers describe pricing & perceived value as a friction point. This is an interpretation of public language, not a measured revenue outcome.",
    "business_implications": "…",
    "recommended_actions": ["Model a usage-based or tiered plan for smaller teams", "…"],
    "evidence_ids": ["<uuid>", "…"],
    "evidence_count": 13,
    "source_count": 6,
    "representative_quote": "…",
    "first_observed": "2025-11-02",
    "last_observed": "2026-10-20",
    "sentiment_score": -0.58,
    "confidence": 0.91,
    "confidence_label": "high",
    "is_observed_complaint": true
  }
]
```

Ordering: `evidence_count` descending (the stored order is severity then count; this
route re-sorts by count).

### `GET /projects/{id}/opportunities` (200)

```json
[
  {
    "id": "<uuid>",
    "title": "Repackage plans around workspace value instead of seats",
    "category": "Commercial model",
    "description": "12 collected records touch pricing & perceived value, including 7 explicit requests or complaints. ClarityStack is perceived more strongly on value for money.",
    "demand_signal": "…",
    "competitor_comparison": "ClarityStack is perceived more strongly on value for money.",
    "strategic_relevance": "Directly addresses the highest-volume complaint cluster and the competitor price gap.",
    "next_action": "Model a workspace-priced tier for teams under 20 seats and test it with 10 renewals.",
    "evidence_ids": ["<uuid>"],
    "evidence_count": 7,
    "impact_score": 94.0,
    "effort_score": 46.0,
    "confidence": 0.78,
    "quadrant": "strategic_investment",
    "is_estimate": true
  }
]
```

### `GET /projects/{id}/customer-voice`

Params: `search`, `source`, `sentiment`, `country`, `topic`, `date_from`, `date_to`,
`limit` (1–120, default 40).

```json
{
  "summary": { "total": 47, "positive": 6, "negative": 21, "neutral": 9, "mixed": 11, "average_score": -0.27 },
  "complaint_categories": [{ "key": "pricing", "label": "Pricing concerns", "count": 20, "negative": 13, "positive": 2 }],
  "praise_categories": [{ "key": "onboarding", "label": "Onboarding experience", "count": 9, "positive": 5 }],
  "feature_requests": [{ "key": "Plan and billing requests", "label": "Plan and billing requests", "count": 20, "topic_key": "pricing" }],
  "topics": [{ "key": "pricing", "label": "Pricing & perceived value", "count": 20 }],
  "evidence": ["…same shape as the evidence endpoint…"],
  "filtered_total": 31,
  "facets": { "sources": [], "countries": [], "sentiments": [] },
  "demo": true
}
```

### `GET /projects/{id}/competitors` (200, abridged)

```json
{
  "primary": { "name": "Lumenly", "is_primary": true, "mention_count": 47, "sentiment_score": -0.24, "strengths": [], "weaknesses": [] },
  "competitors": [{ "name": "Orbit Metrics", "mention_count": 4, "sentiment_score": -0.31, "strengths": ["Speed and reliability"], "weaknesses": ["Pricing concerns"] }],
  "matrix": {
    "dimensions": [
      { "key": "sentiment", "label": "Customer sentiment", "topic": null },
      { "key": "pricing", "label": "Pricing perception", "topic": "pricing" },
      { "key": "support", "label": "Customer experience", "topic": "customer_service" },
      { "key": "features", "label": "Capability depth", "topic": "missing_features" },
      { "key": "reporting", "label": "Reporting & analytics", "topic": "reporting_analytics" },
      { "key": "reliability", "label": "Reliability", "topic": "reliability" }
    ],
    "rows": [{ "id": "<uuid>", "name": "Orbit Metrics", "is_primary": false, "evidence_count": 4, "scores": { "sentiment": 38.0, "pricing": 38.0, "support": null, "features": 52.0, "reporting": 38.0, "reliability": null } }]
  },
  "pricing": [{ "name": "ClarityStack", "pricing_summary": "Per-seat pricing from $49", "evidence": 3, "reliable": true }],
  "timeline": [{ "date": "2026-08-14", "title": "…", "competitor": "Orbit Metrics", "source": "Reddit discussions", "sentiment": "negative" }],
  "insights": [{ "competitor": "Orbit Metrics", "mentions": 4, "sentiment_score": -0.31, "strengths": [], "weaknesses": ["Pricing concerns"], "note": "Based on 4 records that name Orbit Metrics. No overall superiority score is assigned because coverage is not equal across vendors." }],
  "demo": true
}
```

`scores` are `(mean sentiment + 1) × 50` per dimension; `null` means insufficient
evidence and the UI renders it as such. `timeline` is capped at 24 entries.

### `GET /projects/{id}/graph`

```json
{
  "nodes": [
    { "id": "failure:<uuid>", "label": "Pricing concerns in Lumenly Signals", "category": "weakness", "category_label": "Product weakness", "detail": "13 of 20 …", "confidence": 0.91, "evidence_ids": ["<uuid>"], "meta": { "severity": "critical", "evidence_count": 13 } }
  ],
  "edges": [
    { "id": "<uuid>", "source": "topic:<uuid>", "target": "failure:<uuid>", "relation": "surfaces_as", "rationale": "13 negative records in pricing concerns roll up into this weakness.", "confidence": 0.91 }
  ],
  "legend": { "weakness": { "label": "Product weakness", "color": "negative" } },
  "relationship_types": ["creates_risk", "opens", "recommends", "surfaces_as"]
}
```

Relations: `surfaces_as`, `creates_risk`, `amplifies`, `opens`, `recommends`.
Filters: `?relation=a,b` and `?category=weakness,opportunity`. Empty graph → **404**
("No relationships are available yet…").

### `GET /projects/{id}/analytics` (200)

```json
{
  "totals": { "evidence": 47, "sources": 9, "countries": 4, "failures": 11, "opportunities": 13, "competitors": 3, "positive": 6, "negative": 21, "neutral": 20 },
  "sentiment_trend": { "months": ["2025-11"], "positive": [1], "negative": [2], "neutral": [1] },
  "pain_points": [{ "topic": "Pricing concerns", "key": "pricing", "count": 13 }],
  "benchmark_dimensions": ["sentiment", "pricing", "support", "features", "reporting"],
  "benchmark_series": [{ "name": "Lumenly (you)", "is_primary": true, "values": [44.0, 35.0, 41.0, 48.0, 40.0], "mention_count": 47 }],
  "opportunity_matrix": [{ "id": "<uuid>", "title": "…", "impact": 94.0, "effort": 46.0, "quadrant": "strategic_investment", "confidence": 0.78 }],
  "geography": [{ "country": "IN", "records": 11, "sentiment": -0.19, "positive": 1, "negative": 5 }],
  "topic_trends": [{ "label": "Pricing concerns", "trend": "emerging", "series": [{ "month": "2025-11", "count": 2 }], "evidence_count": 20, "kind": "complaint" }],
  "source_distribution": [{ "source": "review_platform", "count": 18 }],
  "timeline": [{ "date": "2025-11-02", "label": "…", "category": "reddit", "sentiment": "negative", "source": "Reddit discussions" }],
  "severity_breakdown": [{ "severity": "critical", "count": 3 }],
  "demo": true,
  "project_name": "Lumenly Signals — ANZ & India market position"
}
```

---

## 5. Outputs — report, roadmap, simulator, assistant

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/projects/{id}/report` | ✔ | Latest report version (**404** if none) |
| POST | `/projects/{id}/report/regenerate` | ✔ | Build a new version from current evidence (**409** without evidence) |
| GET | `/projects/{id}/report/export` | ✔ | Standalone print-ready HTML (`text/html`) |
| GET | `/projects/{id}/roadmap` | ✔ | Prioritised items (auto-built once if evidence exists) |
| PATCH | `/projects/{id}/roadmap/{item_id}` | ✔ | Edit priority/status/horizon/notes/order/title |
| GET | `/projects/{id}/roadmap/export` | ✔ | Markdown roadmap (`text/markdown`, attachment) |
| GET | `/projects/{id}/scenarios` | ✔ | Saved simulations, newest first |
| POST | `/projects/{id}/simulate` | ✔ | Run one scenario → **201** (**409** without evidence) |
| POST | `/projects/{id}/simulate/compare` | ✔ | Run 2–4 scenarios → **201** |
| DELETE | `/projects/{id}/scenarios/{scenario_id}` | ✔ | Delete a scenario → **204** |
| GET | `/projects/{id}/chat` | ✔ | Conversation + messages + suggested questions |
| POST | `/projects/{id}/chat` | ✔ | Ask a grounded question (**409** without evidence) |

### `GET /projects/{id}/report` (200)

```json
{
  "id": "<uuid>",
  "title": "Lumenly — Market intelligence assessment",
  "version": 1,
  "executive_summary": "Lumenly operates in B2B SaaS across AU, NZ, IN, GB. This assessment draws on 47 evidence records …",
  "sections": [
    { "key": "sentiment", "title": "Customer sentiment", "type": "metrics", "body": "Of 47 records, 6 are positive …", "items": [{ "label": "Positive", "value": "13%" }] },
    { "key": "complaints", "title": "Key customer complaints", "type": "list", "body": "Ordered by volume of corroborating negative records.", "items": [{ "title": "…", "meta": "CRITICAL · 13 records · confidence 91%", "body": "…", "quote": "…" }] },
    { "key": "references", "title": "Evidence and references", "type": "references", "body": "47 records; the 20 most recent are listed.", "items": [{ "title": "…", "meta": "Trustpilot · 2025-10-20 · mixed", "url": "https://demo.marketpulse.ai/…", "body": "…" }] }
  ],
  "limitations": ["Public conversations are self-selected and are not a representative sample of the customer base.", "…"],
  "reference_ids": ["<uuid>"],
  "generated_at": "2026-11-14T09:12:00Z",
  "provider": "demo-dataset+heuristic-v1",
  "is_demo": true
}
```

Section `type` values: `narrative`, `metrics`, `list`, `references`.

### `POST /projects/{id}/simulate`

```json
{ "prompt": "What if we reduce subscription prices by 10%?", "name": "Price cut", "simulate": true }
```

`prompt` 8–1000 characters; `name` ≤ 200 (defaults to a truncated prompt). Rate limit
cost 2. Response **201**:

```json
{
  "id": "<uuid>",
  "name": "Price cut",
  "prompt": "What if we reduce subscription prices by 10%?",
  "assumptions": ["Public sentiment is a leading indicator of commercial outcomes (unverified for this company).", "Assumption: a 10% reduction moves at least part of the price-objection segment to renew."],
  "advantages": ["Removes the single most cited objection: 13 of 20 pricing-related records describe cost as a blocker."],
  "disadvantages": ["A uniform reduction compresses revenue from customers who are not price-sensitive …"],
  "competitor_responses": ["Orbit Metrics could emphasise non-price differentiation or match the change."],
  "risks": ["Temporary goodwill without structural retention improvement if the complaint is about value, not price."],
  "evidence_ids": ["<uuid>"],
  "confidence": 0.48,
  "provider": "heuristic-v1",
  "created_at": "2026-11-16T10:20:00Z"
}
```

`confidence` is always < 1 and the UI labels the output as a hypothesis. The
`simulate` boolean is accepted for compatibility and does not change behaviour.

### `POST /projects/{id}/chat`

```json
{ "content": "What are the three most important problems?" }
```

`content` 1–2000 characters; rate limit cost 1. Response **200**:

```json
{
  "id": "<uuid>",
  "role": "assistant",
  "content": "Retrieval summary for **Lumenly** — no LLM is configured, so this answer is assembled directly from 6 retrieved evidence records. …",
  "citations": [
    { "id": "<uuid>", "source_name": "Trustpilot", "source_url": "https://demo.marketpulse.ai/…", "excerpt": "…", "sentiment": "mixed", "published_at": "2025-10-20", "is_demo": true }
  ],
  "retrieval_trace": [
    { "step": "embed_query", "detail": "96-dimension hashing embedding of the question" },
    { "step": "retrieve", "detail": "6 evidence records retrieved by cosine similarity + topic match" },
    { "step": "findings", "detail": "2 related structured findings attached" }
  ],
  "provider": "retrieval-v1",
  "created_at": "2026-11-16T10:22:00Z"
}
```

`provider` is `retrieval-v1` (assembled) or `gemini-rag-v1` (synthesised). The user
message is persisted before the answer is generated, so a failure still shows the
question in history.

### `PATCH /projects/{id}/roadmap/{item_id}`

```json
{ "status": "in_progress", "priority": "high", "notes": "Validated with the retention team" }
```

All fields optional: `title` ≤ 240, `priority` ∈ critical/high/medium/low, `status` ∈
planned/in_progress/completed/parked, `horizon` ∈ immediate/short_term/medium_term/
long_term, `notes` ≤ 2000, `order_index` 0–999.

---

## 6. Operations

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/monitoring` | ✔ | Own completed projects with a monitoring config |
| GET | `/projects/{id}/monitoring` | ✔ | Config (created on first read) + change summary |
| POST | `/projects/{id}/monitoring` | ✔ | Update enabled/interval/track |
| POST | `/projects/{id}/monitoring/run` | ✔ | Record a check now |
| GET | `/notifications` | ✔ | Latest 50 notifications |
| POST | `/notifications/{id}/read` | ✔ | Mark one read (**404** if not yours) |
| POST | `/notifications/read-all` | ✔ | Mark all read → `{"updated": n}` |

### `GET /projects/{id}/monitoring` (200)

```json
{
  "id": "<uuid>",
  "project_id": "<uuid>",
  "enabled": true,
  "interval": "weekly",
  "track": ["sentiment", "complaints", "competitor", "opportunities"],
  "last_run_at": "2026-11-16T04:00:00Z",
  "next_run_at": "2026-11-23T04:00:00Z",
  "execution_mode": "manual",
  "change_summary": {
    "new_records": 0,
    "sentiment_positive_share": 12.8,
    "sentiment_recent_share": 12.8,
    "sentiment_delta": 0.0,
    "latest_signal": { "title": "…", "source": "Trustpilot", "date": "2026-10-20", "sentiment": "mixed" },
    "complaint_watch": [{ "title": "Pricing concerns in Lumenly Signals", "severity": "critical", "evidence": 13 }],
    "opportunity_watch": [{ "title": "Repackage plans around workspace value instead of seats", "impact": 94.0, "quadrant": "strategic_investment" }],
    "execution_mode": "manual",
    "notice": "No live search provider is configured, so scheduled runs are recorded as manual checks. Past records are summarised but no new market data is fetched."
  }
}
```

### `POST /projects/{id}/monitoring`

```json
{ "enabled": true, "interval": "fortnightly", "track": ["sentiment", "pricing"] }
```

`interval` ∈ daily/weekly/fortnightly/monthly; `track` max 10 items (unknown keys are
stored but only the known ones are rendered). When `enabled`, `next_run_at` is
recomputed. `execution_mode` is forced to `automated` only when a live provider is
configured, else `manual`.

### `POST /projects/{id}/monitoring/run` (200)

```json
{ "recorded": true, "execution_mode": "manual", "summary": { "new_records": 0, "…": "…" }, "notification_id": "<uuid>" }
```

No external collection happens: the run compares stored records with `last_run_at`.

---

## 7. Cross-cutting behaviour

| Topic | Behaviour |
| --- | --- |
| Pagination | **Only** `/evidence` (`page`, `page_size` ≤ 100). Every other collection is returned whole. |
| Sorting | Fixed per endpoint (findings by evidence count, opportunities by impact, evidence by `published_at` desc nulls last, roadmap by `order_index`). No `sort` parameter exists. |
| Idempotency | `POST /projects/{id}/run` is idempotent while running; `POST /report/regenerate` always creates a new version; seeding is idempotent. No `Idempotency-Key` support. |
| Concurrency | No optimistic locking; last write wins on `PATCH`. |
| Caching | No `Cache-Control` on API responses; the client caches via TanStack Query. |
| CORS | `CORS_ORIGINS` allowlist, methods `GET POST PATCH DELETE OPTIONS`, headers `Authorization, Content-Type, Accept`, credentials allowed. |
| Request tracing | `x-request-id` accepted from the client or generated; echoed on the response and included in error bodies and logs. |
| OpenAPI accuracy | Every route declares a `response_model` or a typed return annotation, so `/openapi.json` reflects the real contract. |

---

## Related documents

- Schemas in full: [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) (models) and
  `backend/app/schemas/*.py` (contracts)
- Auth and ownership rules: [`SECURITY.md`](SECURITY.md)
- Pipeline endpoints in context: [`RESEARCH_PIPELINE.md`](RESEARCH_PIPELINE.md) §4
