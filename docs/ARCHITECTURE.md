# Architecture

## Shape of the system

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser — React 18 + TypeScript + Vite                            │
│  TanStack Query · React Hook Form + zod · ECharts · React Flow      │
└───────────────▲────────────────────────────────────────────────────┘
                │ HTTPS / JSON, Bearer JWT
┌───────────────┴────────────────────────────────────────────────────┐
│  FastAPI (app.main)                                                │
│  · routers: auth, projects, analysis, outputs, ops                  │
│  · dependencies: session, current user, project ownership           │
│  · middleware: CORS, request id, structured logging, rate limits    │
└──────┬───────────────────────┬──────────────────────┬──────────────┘
       │                       │                      │
┌──────▼─────────┐   ┌─────────▼──────────┐  ┌────────▼─────────────┐
│ Research       │   │ Analysis & outputs │  │ Persistence          │
│ orchestrator   │   │ analysis_engine    │  │ SQLAlchemy 2         │
│ search provider│   │ report_builder     │  │ PostgreSQL / SQLite  │
│ Gemini client  │   │ analytics, graph   │  │ Alembic migrations   │
│ demo corpus    │   │ simulator, RAG     │  │                      │
└──────┬─────────┘   └────────────────────┘  └──────────────────────┘
       │
┌──────▼─────────────────────────────────────────────────────────────┐
│ Job runner — inline ThreadPoolExecutor (default) or Celery + Redis │
└────────────────────────────────────────────────────────────────────┘
```

## Layers

### API layer (`backend/app/api`)

Routers are thin. They validate with Pydantic schemas, resolve the current user,
load the project through `get_project` (which enforces ownership), call a service
and serialise the result. Business logic never lives in a route.

`routes_auth.py` also serves `meta/catalog` (countries, topics, modes, tracks)
and `meta/capabilities` (what is configured right now), so the UI can render
honest capability banners.

### Service layer (`backend/app/services`)

- `orchestrator.py` — runs the staged pipeline, persists a `ResearchTask` row per
  stage, emits notifications, and finalises the project. Stage lists differ per
  mode (`quick`, `standard`, `deep`).
- `analysis_engine.py` — ingestion, de-duplication, sentiment, topic assignment,
  failure/opportunity detection, assumption testing, graph relationships,
  roadmap generation and report assembly.
- `text_analysis.py` — deterministic lexicon sentiment, phrase extraction and
  topic matching. Calibrated so mixed/neutral language is not forced negative.
- `search/` providers — Tavily and Brave clients behind one interface, plus the
  synthetic demo corpus. All return the same `RawRecord` shape.
- `llm/gemini.py` — optional enrichment with timeout, retry, JSON-schema
  validation and prompt-injection guards. Failure degrades gracefully.
- `report_builder.py` — versioned report document: summary, sections, references,
  limitations, provider label.
- `analytics.py`, `graph.py`, `roadmap.py`, `simulator.py`, `assistant.py`,
  `monitoring.py` — derived views, all computed from stored evidence.

### Persistence

SQLAlchemy 2 typed models in `backend/app/models`. JSON columns use
`JSON().with_variant(JSONB, "postgresql")` and identifiers use `Uuid`, so the
same schema runs on SQLite for tests and PostgreSQL in production.

Core tables: `users`, `companies`, `research_projects`, `project_configurations`,
`research_tasks`, `evidence_records`, `sentiment_records`, `topic_clusters`,
`failure_findings`, `opportunity_findings`, `assumptions`,
`competitor_analyses`, `competitor_observations`, `strategic_relationships`,
`roadmap_items`, `scenarios`, `reports`, `chat_conversations`, `chat_messages`,
`monitoring_configs`, `notifications`.

Every project-scoped table carries `project_id`; every query is scoped by the
authenticated owner.

### Jobs

`JOB_RUNNER=inline` starts a thread pool inside the API process — zero external
dependencies, ideal for local use and single-container deployment.
`JOB_RUNNER=celery` dispatches to a Celery worker over Redis (used by Compose).
Both call the same orchestrator entry point, so behaviour is identical.

Progress is persisted per stage, which is why the UI can show a live stage list
rather than a spinner.

## Trust model

The product's central claim is traceability, enforced in code:

1. **Evidence first.** Findings are constructed from records, never from prose.
   A finding without supporting record IDs is discarded.
2. **Four epistemic levels.** The UI separates observed evidence, AI
   interpretation, strategic hypothesis and recommendation. Assumptions are
   stored as testable rows with a verdict.
3. **Contradiction handling.** Records arguing the opposite of a cluster are
   linked by `contradiction_group`; the UI surfaces them instead of hiding them.
4. **Provenance.** Each record stores source name, URL, category, country,
   publication date, collection date, author handle where available, credibility
   score and corroboration count.
5. **Demo honesty.** Demo records carry `is_demo`, the project carries
   `is_demo`, URLs point at `demo.marketpulse.ai`, and every surface repeats the
   demo label. `invented statistics` are never generated.
6. **Degradation labels.** Reports record the provider used
   (`deterministic-v1`, `retrieval-v1`, `heuristic-v1`, or the live model).

## Security

- Passwords: PBKDF2-HMAC-SHA256, 210k iterations, per-user salt.
- Tokens: HS256 JWT with `sub`, `exp`, `iat`; 7-day default lifetime.
- Ownership: every project route resolves through `get_project`, which 404s on
  foreign IDs rather than leaking existence.
- Injection: LLM prompts wrap retrieved text in delimiters and instruct the model
  to treat it as data; outputs are schema-validated before storage.
- Uploads: bounded by `MAX_UPLOAD_BYTES`; only text-like evidence is accepted.
- Secrets: environment only, never returned by an endpoint or embedded in the
  build. `.env` is git-ignored.
- Rate limiting: per-user hourly budget for assistant and simulation calls.

## Frontend architecture

- Route-level code splitting (`React.lazy`) for every analysis surface.
- `useProjectData` centralises query keys; mutations invalidate precisely.
- `AnalysisLayout` loads project + status once, polls while running, and provides
  an outlet context so pages do not duplicate requests.
- Charts are wrapped in a single `EChart` component that owns resize handling and
  disposes instances on unmount.
- Theme and auth are small context providers; the theme is applied to
  `<html class="dark">` and persisted in `localStorage`.
- Accessibility: semantic landmarks, labelled inputs, visible focus rings,
  `prefers-reduced-motion` support, keyboard-operable graph and tabs.

## Why these choices

| Decision | Reason |
| --- | --- |
| Deterministic analysis core | Reproducible, testable, and defensible; the LLM cannot fabricate severity |
| Inline runner default | `docker compose up` works without Redis; Celery remains available |
| SQLite for tests | Fast, isolated per-session databases; same metadata as Postgres |
| Report as HTML + print CSS | Reliable PDF without a headless browser dependency in the container |
| Own auth | No external identity provider required for a self-contained demo |
| No mock API in the frontend | Tests mock `fetch`; the app always talks to a real backend |
