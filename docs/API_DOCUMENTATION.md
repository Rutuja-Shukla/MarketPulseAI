# API documentation

Base URL: `/api` (development: `http://localhost:8000/api`).
Interactive schema: `/docs` (Swagger UI) and `/openapi.json`.

## Authentication

Bearer JWT in `Authorization: Bearer <token>`. Tokens are issued by
`/auth/register`, `/auth/login` and `/auth/demo`, and expire after
`ACCESS_TOKEN_EXPIRE_MINUTES` (default 7 days).

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@marketpulse.ai","password":"DemoPass123!"}'
```

```json
{ "access_token": "eyJ…", "token_type": "bearer", "user": { "id": "…", "email": "demo@marketpulse.ai" } }
```

Every project route resolves the project through the authenticated user; a
project belonging to someone else returns **404**, not 403, so IDs do not leak.

## Errors

| Status | Meaning | Body |
| --- | --- | --- |
| 400 | Invalid request semantics | `{"detail": "..."}` |
| 401 | Missing/expired token, bad credentials | `{"detail": "..."}` |
| 404 | Unknown or foreign resource | `{"detail": "..."}` |
| 409 | Duplicate account / conflicting state | `{"detail": "..."}` |
| 422 | Schema validation | `{"detail": "...", "errors": [{"field": "...", "message": "..."}]}` |
| 429 | AI rate limit exceeded | `{"detail": "..."}` |
| 500 | Unhandled server error (request id logged) | `{"detail": "..."}` |

## Auth & meta

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Create analyst account; returns token |
| POST | `/auth/login` | — | Email + password sign-in |
| POST | `/auth/demo` | — | Sign in as the seeded demo analyst |
| GET | `/auth/me` | ✔ | Current user profile |
| GET | `/meta/catalog` | — | Countries, regions, source categories, topics, modes, depths, tracks |
| GET | `/meta/capabilities` | — | Demo mode, provider configuration, limitations |
| GET | `/dashboard` | ✔ | Metrics, recent/completed projects, notifications |
| GET | `/health` | — | Liveness (outside `/api`) |

`GET /health` returns `{"status":"ok","database":"ok","version":"..."}`; it is
used by Compose and the container health checks.

## Projects

| Method | Path | Description |
| --- | --- | --- |
| POST | `/projects` | Create a research project from the brief |
| GET | `/projects` | List own projects (`?status=&search=`) |
| GET | `/projects/{id}` | Project detail, configuration, tasks, sources, competitors |
| PATCH | `/projects/{id}` | Rename / adjust objectives |
| DELETE | `/projects/{id}` | Delete project and dependent rows |
| POST | `/projects/{id}/run` | Start (or restart) the pipeline — `202` |
| GET | `/projects/{id}/status` | Stage progress, current stage, error |
| GET | `/projects/{id}/sources` | Source coverage summary |
| POST | `/projects/suggest-competitors` | Competitor suggestions from description |

Create payload (abridged):

```json
{
  "name": "Lumenly market assessment",
  "mode": "standard",
  "company": { "name": "Lumenly", "website": "https://lumenly.example", "industry": "B2B SaaS" },
  "product": { "name": "Lumenly Signals", "description": "Revenue intelligence for mid-market teams" },
  "market": { "global_scope": false, "countries": ["AU", "NZ"], "regions": [], "comparison_pairs": [] },
  "customers": { "segments": ["RevOps leads"], "company_size": "50-500" },
  "objectives": ["identify_product_weaknesses", "understand_customer_dissatisfaction"],
  "assumptions": ["Customers are switching because pricing is too high."],
  "competitors": ["Orbit Metrics", "ClarityStack"],
  "source_categories": ["review_sites", "forums", "support_communities"],
  "depth": "deep",
  "period": { "from": "2025-01-01", "to": "2026-01-01" }
}
```

Validation highlights: 3–120 character name, known ISO country codes, at least
one market unless `global_scope`, at least one source category and objective,
non-inverted period, maximum competitor count.

## Analysis

| Method | Path | Description |
| --- | --- | --- |
| GET | `/projects/{id}/evidence` | Paginated evidence with facets |
| GET | `/projects/{id}/failures` | Weakness findings with evidence and actions |
| GET | `/projects/{id}/opportunities` | Opportunity findings with impact/effort |
| GET | `/projects/{id}/customer-voice` | Themes, representative quotes, segments |
| GET | `/projects/{id}/competitors` | Comparison matrix and per-competitor detail |
| GET | `/projects/{id}/graph` | Nodes and typed edges for the intelligence graph |
| GET | `/projects/{id}/graph/node/{node_id}/evidence` | Evidence behind one graph node |
| GET | `/projects/{id}/analytics` | Sentiment trend, topics, geography, sources, severity |

Evidence query parameters: `search`, `source`, `sentiment`, `country`,
`date_from`, `date_to`, `contradictions_only`, `page`, `page_size` (max 50).

```json
{
  "items": [
    {
      "id": "…",
      "source_name": "Reviewboard",
      "source_category": "review_sites",
      "source_url": "https://demo.marketpulse.ai/…",
      "title": "Powerful, but the price jump hurt",
      "excerpt": "…",
      "published_at": "2025-11-02T00:00:00Z",
      "collected_at": "2026-02-01T09:12:00Z",
      "sentiment": "negative",
      "sentiment_score": -0.52,
      "topics": ["pricing", "support"],
      "country": "AU",
      "credibility_score": 0.71,
      "credibility_label": "moderate",
      "corroboration_count": 4,
      "duplicate_status": "unique",
      "contradiction_group": "pricing-value",
      "finding_ids": [{ "type": "failure", "id": "…", "title": "Pricing escalation" }],
      "is_demo": true
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "contradiction_count": 3,
  "facets": { "sources": [], "countries": [], "sentiments": [] }
}
```

## Outputs

| Method | Path | Description |
| --- | --- | --- |
| GET | `/projects/{id}/report` | Versioned report document |
| POST | `/projects/{id}/report/regenerate` | Rebuild from current evidence |
| GET | `/projects/{id}/report/export` | Print-optimised standalone HTML |
| GET | `/projects/{id}/roadmap` | Prioritised actions |
| PATCH | `/projects/{id}/roadmap/{item_id}` | Edit status, owner, priority |
| GET | `/projects/{id}/roadmap/export` | CSV export |
| GET | `/projects/{id}/scenarios` | Saved simulations |
| POST | `/projects/{id}/simulate` | Run a scenario |
| POST | `/projects/{id}/simulate/compare` | Run two or more scenarios |
| DELETE | `/projects/{id}/scenarios/{scenario_id}` | Remove a scenario |
| GET | `/projects/{id}/chat` | Assistant transcript |
| POST | `/projects/{id}/chat` | Grounded question answering |

Report shape: `title`, `executive_summary`, `sections[]` (typed `text`, `list`,
`metrics`, `references`), `limitations[]`, `reference_ids[]`, `provider`,
`version`, `generated_at`, `is_demo`.

## Operations

| Method | Path | Description |
| --- | --- | --- |
| GET | `/monitoring` | All monitored projects with change summaries |
| GET | `/projects/{id}/monitoring` | Fetch or lazily create configuration |
| POST | `/projects/{id}/monitoring` | Update enabled, interval, tracks |
| POST | `/projects/{id}/monitoring/run` | Run a check now |
| GET | `/notifications` | Latest notifications |
| POST | `/notifications/{id}/read` | Mark one read |
| POST | `/notifications/read-all` | Mark all read |

Intervals: `daily`, `weekly`, `fortnightly`, `monthly`.
Tracks: `sentiment`, `complaints`, `competitor`, `opportunities`.

`execution_mode` in a monitoring response is `automated` only when a live search
provider is configured; otherwise `manual` and a `notice` explains why. The
monitor never claims continuous collection it cannot perform.

## Rate limits

`POST /chat` and `POST /simulate` are limited per user per hour
(`RATE_LIMIT_AI_PER_HOUR`, default 60) and return `429` with a retry hint.

## CORS

`CORS_ORIGINS` is a comma-separated allowlist. The Compose stack allows the
nginx origin (`http://localhost:8080`) and Vite (`http://localhost:5173`).
