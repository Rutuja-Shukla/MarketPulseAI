# MarketPulse AI

**Evidence-led market intelligence: a research pipeline that shows its working — every finding traceable to a stored record, every score computed by code, the LLM used only for language.**

![Stack](https://img.shields.io/badge/stack-FastAPI%20%C2%B7%20React%20%C2%B7%20PostgreSQL-0b1f18)
![Tests](https://img.shields.io/badge/tests-23%20backend%20%C2%B7%2030%20frontend-0f9d6e)
![CI](https://github.com/Rutuja-Shukla/MarketPulseAI/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/python-3.11%2B-0b1f18)
![License](https://img.shields.io/badge/license-MIT-65786f)

---

## 1. Project introduction

### The business problem

Product and strategy teams are asked "why are we losing deals?" and answer with
anecdotes. The raw signal exists — review pages, community threads, support
forums, release notes, competitor pricing pages — but it is scattered, of uneven
quality, duplicated, and easy to quote selectively. The two common failure modes
are (a) a dashboard of unlinked numbers nobody trusts, and (b) an LLM that
produces a fluent narrative with no verifiable source.

### The solution

MarketPulse AI runs a bounded, observable research pipeline over public signal and
produces a structured, **evidence-traceable** assessment:

1. Collect permitted records from a configured search provider (or a clearly
   labelled synthetic corpus when no provider is configured).
2. Normalise, classify and score them deterministically — sentiment, topics,
   credibility, corroboration, contradictions, duplicates.
3. Derive findings from those records only. A finding without supporting record
   IDs is discarded rather than embellished.
4. Optionally enrich the *language* with Gemini, under schema validation and
   prompt-injection guards, with a deterministic fallback when the model is
   unavailable.
5. Deliver a versioned report, a prioritised roadmap, an intelligence graph, a
   grounded research assistant and chart-ready analytics.

### Intended users

Analyst-led teams evaluating a product or market position: product managers,
product marketing, competitive intelligence, RevOps and founders preparing a
market assessment. The interface assumes an analyst, not a data engineer —
research is configured through a seven-step studio, not SQL.

### Engineering differentiators

| Differentiator | What it means in code |
| --- | --- |
| **Deterministic core, LLM at the edge** | Sentiment, severity, confidence, impact/effort and every aggregate are computed from rows (`services/analysis_engine.py`, `services/text_analysis.py`). Gemini may rewrite a summary; it cannot change a score. |
| **Four epistemic levels kept separate** | Observed evidence, AI interpretation, strategic hypothesis and recommendation are distinct fields and distinct UI treatments. Assumptions are stored as testable rows with a verdict. |
| **Traceability as an invariant** | `FailureFinding.evidence_ids`, `OpportunityFinding.evidence_ids` and `StrategicRelationship.evidence_ids` link back to `evidence_records`; the graph resolves nodes to their records on demand. |
| **Honest degradation** | No provider → live research is refused with `409`, not silently faked. No LLM → reports and assistant fall back to deterministic/retrieval providers and label themselves (`heuristic-v1`, `retrieval-v1`). Demo data is marked at row, project and UI level. |
| **Observable pipeline** | One `research_tasks` row per stage with status, timing, item count and error text, so a failed run explains itself and the UI shows a live stage list instead of a spinner. |
| **Self-contained auth** | PBKDF2-HMAC-SHA256 (260,000 iterations) + HS256 JWT. No external identity provider required to run the project. |

---

## 2. Live application

**No public deployment URL is verified for this repository.** Do not assume a
hosted instance exists; run it locally (Section 11) or with Docker Compose
(Section 10). Any URL added here in future must be verified before it is
documented.

### Demo account

The application seeds one demonstration workspace on first start
(`SEED_DEMO_ON_STARTUP=true`, `DEMO_MODE=true`):

| Field | Value |
| --- | --- |
| Email | `demo@marketpulse.ai` |
| Password | `DemoPass123!` |
| Alternative | the **Enter the demonstration workspace** button on `/login` (`POST /api/auth/demo`) |

These credentials are development defaults defined in
`backend/app/services/demo_seed.py`. They are **not** a production account and
must be changed or the seeding disabled before any real deployment
(see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §7).

### Deployment and demo limitations — read before evaluating

- **Demo data is synthetic.** The seeded project (*Lumenly Signals — ANZ & India
  market position*) is built from a fictional corpus in
  `backend/app/research/demo_corpus.py`: fictional company, fictional
  competitors, and source URLs pointing at `demo.marketpulse.ai`, which does not
  publish those articles. Every surface repeats the label
  **DEMO DATA — illustrative findings, not live market research**.
- **Live research requires a search provider key.** With `SEARCH_PROVIDER=none`
  (the default) live projects are refused with `409` and the UI states why.
- **The live provider and LLM paths have not been exercised with real keys in
  this environment** — they are implemented against the documented Tavily, Brave
  and Gemini HTTP APIs and are covered only by deterministic-fallback tests.
- **Docker Compose is authored but was not executed here** (no Docker daemon on
  the development machine). See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §9 for
  exactly what was and was not verified.
- Free-tier hosts sleep, expire databases and cap Redis connections; a
  permanently free deployment is not guaranteed by any provider.

---

## 3. Application screenshots

Captured from the running application (`http://127.0.0.1:5173`) against the
seeded demonstration workspace. Images live in `docs/images/`.

### Executive dashboard

`/dashboard` — research record, critical-risk count, opportunity count and the
configured capability state.

![Executive dashboard](docs/images/dashboard.png)

### Market intelligence overview

`/analysis/{id}/overview` — executive summary with evidence, weakness,
opportunity and market counts, plus assumption verdicts.

![Market intelligence overview](docs/images/overview.png)

### Sentiment analytics

`/analysis/{id}/analytics` — eight chart sets aggregated from stored records; no
chart is padded with sample values.

![Sentiment analytics](docs/images/sentiment-analytics.png)

### Competitor analysis

`/analysis/{id}/competitors` — dimension matrix derived only from records that
mention each company; **insufficient evidence is shown as such instead of a
score**.

![Competitor analysis](docs/images/competitor-analysis.png)

### Research pipeline progress

A live deep-mode run (`Northwind Robotics — EMEA market entry`): 18 persisted
stages, current stage and percentage. The stage list is the `research_tasks` table
read back through `GET /api/projects/{id}/status`.

![Research pipeline progress](docs/images/research-pipeline.png)

### Evidence and source traceability

`/analysis/{id}/evidence` — every claim resolves to a record with source, date,
sentiment, credibility and contradiction flag.

![Evidence and trust centre](docs/images/evidence-trust-centre.png)

### Reports and recommendations

`/analysis/{id}/report` — the versioned deliverable, with reference list,
limitations and print/PDF export.

![Executive report](docs/images/report.png)

---

## 4. Key features

### Market research

A research brief is captured through a seven-step studio (company, market,
situation, objectives, assumptions, competitors, sources/depth) and validated by
Pydantic before it becomes a project. Three depth profiles exist, each with its
own query budget, evidence target and stage list:

| Mode | Stages | Query budget | Evidence target | Adds |
| --- | --- | --- | --- | --- |
| `quick` | 10 | 4 | 14 | Sentiment, topics, weaknesses |
| `standard` | 15 | 8 | 32 | Opportunities, competitor positioning, report |
| `deep` | 18 | 14 | 44 | Trend modelling, contradiction analysis, roadmap |

Stage lists live in `backend/app/research/taxonomy.py` and are served to the UI by
`GET /api/meta/catalog`, so the interface never hard-codes the pipeline.

### Evidence collection and validation

- Provider abstraction (`research/providers.py`): Tavily (POST, advanced depth) and
  Brave (GET, subscription token) behind one `search()` interface; a missing key
  raises `ProviderNotConfigured` rather than returning fabricated results.
- Per-record provenance: source name, source category, URL, publication date,
  collection timestamp, author handle, rating.
- Deterministic credibility prior by source category plus URL/date bonuses
  (`text_analysis.credibility_for_source`).
- Near-duplicate suppression: 5-gram shingles + Jaccard similarity ≥ 0.72.
- Corroboration counting and contradiction grouping per topic.
- Records with no text are dropped at ingestion; a project's live run fails loudly
  if the provider returns nothing (`ResearchError`).

### Sentiment analytics

Transparent lexicon classification with negation scope, intensifiers, contrast
weighting and star-rating priors; four labels (positive/negative/neutral/mixed)
and a score in `[-1, 1]`. Fully specified with worked examples in
[`docs/RESEARCH_PIPELINE.md`](docs/RESEARCH_PIPELINE.md) §7.

### Competitor intelligence

Primary company plus competitors, each scored per dimension (sentiment, pricing,
customer experience, capability depth, reporting, reliability) from sentiment in
records that name them. The API returns `null` for dimensions with no evidence and
the UI renders "insufficient" — no superiority score is invented. Observations
carry the example record they came from.

### AI-powered enrichment

Gemini 2.0 Flash (configurable) rewrites report summaries, proposes extra research
questions, answers the assistant and can draft scenario prose. Every call is
JSON-constrained, schema-checked, wrapped in a guardrail system instruction, and
degrades to the deterministic path on error. See
[`docs/AI_ENGINEERING.md`](docs/AI_ENGINEERING.md).

### Research assistant / RAG

Retrieval-augmented over the project's **own** evidence only: hashing
bag-of-words embedding (96 dimensions, deterministic, dependency-free), cosine
similarity + topic-overlap bonus + recency tie-break, top-6 context. Answers carry
`citations` (record IDs, source, excerpt URL) and a `retrieval_trace`. Without an
LLM the assistant returns a **retrieval brief** quoting the records verbatim
rather than generating prose. This is lexical retrieval — **not** vector search
against a `pgvector` index (see §13).

### Strategic recommendations

Failure findings → severity, confidence, business implication, recommended
actions. Opportunities → impact/effort/confidence and a quadrant
(`quick_win`, `strategic_investment`, `long_term`, `low_priority`). Roadmap items
inherit priority/horizon from severity and impact, carry success metrics, and are
editable (`PATCH .../roadmap/{item_id}`). Assumptions from the brief are tested
against the evidence and receive `supported | partially_supported | contradicted |
insufficient_evidence`.

### Reporting and visualisation

Versioned report documents (12 sections, reference IDs, limitations, provider
label), print-optimised standalone HTML export, Markdown roadmap export,
ECharts visuals, a React Flow intelligence graph (`surfaces_as`, `creates_risk`,
`amplifies`, `opens`, `recommends`), a qualitative strategy simulator and a market
monitor that labels itself `manual` unless a live provider is configured.

---

## 5. Technology stack

Only what the repository actually depends on (`backend/requirements.txt`,
`frontend/package.json`).

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 18, TypeScript 5.6, Vite 6, React Router 6, TanStack Query 5, React Hook Form + zod, Tailwind CSS 3, ECharts 5, @xyflow/react (React Flow) 12, lucide-react, framer-motion |
| **Backend** | Python 3.11+ (image uses 3.12), FastAPI, Uvicorn, Pydantic v2 + pydantic-settings, PyJWT, httpx, email-validator |
| **Database** | PostgreSQL 16 (Compose) or SQLite (default local/test); SQLAlchemy 2 typed ORM; Alembic 1.13; JSONB via `.with_variant` |
| **AI / LLM** | Google Gemini API (`generateContent`, `gemini-2.0-flash`), optional; deterministic lexicon engine as the always-on baseline |
| **Search integrations** | Tavily Search API, Brave Web Search API (optional, either one) |
| **Background processing** | In-process `ThreadPoolExecutor` runner (default) **or** Celery 5.3 + Redis 7 (Compose) |
| **Infrastructure** | Docker multi-stage builds, Docker Compose, nginx (static + `/api` reverse proxy), pgvector image (extension enabled; not used for retrieval today) |
| **Testing & quality** | pytest, FastAPI TestClient, Vitest 3, Testing Library, jsdom, Playwright |

---

## 6. System architecture

```mermaid
flowchart TD
    subgraph Client["Browser"]
        UI["React 18 + TypeScript<br/>Vite SPA<br/>TanStack Query · RHF + zod<br/>ECharts · React Flow"]
    end

    subgraph API["FastAPI application (backend/app)"]
        ROUTERS["API routers<br/>auth · projects · analysis · outputs · ops"]
        DEPS["Dependencies<br/>JWT auth · project ownership<br/>CORS · request id · rate limit"]
        SERVICES["Service layer<br/>analysis_engine · analytics · graph<br/>report_builder · simulator · assistant · monitoring"]
        ORCH["Research orchestrator<br/>stage tasks persisted per project"]
    end

    subgraph External["External integrations (optional)"]
        SEARCH["Search providers<br/>Tavily / Brave"]
        GEMINI["Gemini API<br/>JSON-constrained"]
    end

    subgraph Data["Persistence"]
        PG[("PostgreSQL 16 / SQLite<br/>22 tables · SQLAlchemy 2 · Alembic")]
    end

    subgraph Jobs["Job execution"]
        INLINE["Inline runner (default)<br/>ThreadPoolExecutor, 3 workers"]
        CELERY["Optional: Redis + Celery worker<br/>(compose profile)"]
    end

    UI -->|"HTTPS /api · Bearer JWT"| ROUTERS
    ROUTERS --> DEPS
    DEPS --> SERVICES
    ROUTERS --> ORCH
    ORCH --> SEARCH
    ORCH --> SERVICES
    ORCH -.->|"only when key configured"| GEMINI
    SERVICES --> PG
    ORCH --> PG
    ROUTERS -->|"POST /run"| INLINE
    ROUTERS -.->|"JOB_RUNNER=celery"| CELERY
    CELERY --> ORCH
    INLINE --> ORCH
```

Full layer-by-layer description, component interactions and four diagrams:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Redis and Celery are drawn as
optional there because the deployed-intended default is the inline runner.

---

## 7. Research pipeline

```
brief → plan queries → discover → collect → extract/ingest → deduplicate
      → sentiment + topics → cluster → weaknesses → opportunities
      → competitors → contradictions → graph → assumptions → roadmap → report
```

Every stage writes a `research_tasks` row (status, `started_at`, `finished_at`,
`result_count`, `detail`, error text). A stage exception marks that task `failed`
and the project `failed` with a readable message; already-stored evidence stays
queryable. Deterministic stages are computed from persisted rows — the LLM is
never on the scoring path.

Stage-by-stage behaviour, thresholds, formulas, edge cases and worked examples:
[`docs/RESEARCH_PIPELINE.md`](docs/RESEARCH_PIPELINE.md).
AI integration, RAG and guardrails: [`docs/AI_ENGINEERING.md`](docs/AI_ENGINEERING.md).

---

## 8. Security and reliability

| Control | Implementation |
| --- | --- |
| Password storage | PBKDF2-HMAC-SHA256, 260,000 iterations, 16-byte per-user salt, `hmac.compare_digest` verification |
| Session tokens | HS256 JWT (`sub`, `exp`, `iat`), 7-day default lifetime, `PyJWTError` handled as unauthenticated |
| Resource ownership | Every project route resolves through `get_project`, which returns **404** (not 403) for foreign IDs |
| Input validation | Pydantic schemas at the edge: ISO country allowlist, source-category allowlist, period ordering, length limits; 422 responses carry field-level messages |
| SQL injection | SQLAlchemy Core/ORM with bound parameters throughout; no string-built SQL |
| CORS | Explicit origin allowlist from `CORS_ORIGINS`, explicit methods and headers |
| Rate limiting | In-process sliding window per user per scope (default 60/hour) on report regeneration, suggestions, research runs, simulation and assistant calls |
| LLM boundaries | Retrieved text wrapped in delimiters and declared untrusted; JSON-only responses; provider/network failures fall back to deterministic output |
| Secret handling | Environment only; nothing returned by an endpoint except the demo credential when `DEMO_MODE=true`; `.env` git-ignored |
| Error hygiene | Unhandled errors return a generic message plus `x-request-id`; details go to structured logs |
| Response hardening | `x-content-type-options: nosniff`, `referrer-policy`, nginx `X-Frame-Options` |

Threat model with status per control: [`docs/SECURITY.md`](docs/SECURITY.md).
This project has **not** been penetration-tested or audited.

### Reliability and degradation

| Condition | Behaviour |
| --- | --- |
| No search provider | Live project creation/run refused (`409`); demo corpus available; capability banner explains it |
| No LLM key | Deterministic analysis, report and assistant retrieval brief; provider labels say so |
| LLM 429/5xx | Two attempts, then `LLMProviderError` propagates to the caller, which logs and keeps the deterministic result |
| Search error mid-run | Stage fails with `ResearchError` including the failing query; project marked failed |
| Celery dispatch failure | Falls back to the inline runner instead of losing the job |
| Stage crash | Task `failed` + project `failed` + `error_message`; partial evidence remains readable |
| Background CLI/manual | `scripts/seed_demo.py` is idempotent and safe to re-run |

---

## 9. Testing

```bash
# Backend — 23 tests, 3 files (SQLite per session, no external services)
cd backend && python -m pytest -q

# Frontend — 30 tests, 8 files (Vitest + Testing Library, jsdom)
cd frontend && npm test

# Type-check + production build
cd frontend && npm run build

# End-to-end (Playwright; needs the API on :8000 and the Vite server)
cd frontend && npx playwright install chromium && npm run e2e
```

| Suite | Result (this environment) |
| --- | --- |
| `pytest -q` | **23 passed**, 0 failed/skipped — includes a full demo pipeline flow and cross-user isolation |
| `npm test` | **8 files / 30 tests passed** |
| `npm run build` (`tsc -b && vite build`) | passed |
| Playwright journey | see [`docs/TESTING.md`](docs/TESTING.md) for the run recorded during this documentation pass |

Coverage is **not** measured — no coverage tool or threshold is configured in the
repository, so no percentage is claimed.

Every push and pull request is configured to run the same commands in GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): a `backend` job (pytest on
Python 3.12), a `frontend` job (`npm ci`, Vitest, production build) and an `e2e` job
that starts uvicorn on SQLite, installs Chromium and runs the Playwright journey.
The workflow needs no secrets or provider keys; it cannot deploy anything.

What the suites cover (auth, ownership isolation, pipeline, algorithms, fallbacks,
mocking strategy, test isolation) and what is untested:
[`docs/TESTING.md`](docs/TESTING.md).

---

## 10. Deployment architecture

| Environment | What runs |
| --- | --- |
| **Local (no Docker)** | Uvicorn on `:8000` + SQLite (`backend/marketpulse.db`) + Vite on `:5173` with `/api` proxied; inline job runner; no Redis |
| **Docker Compose** | `postgres` (pg16 + pgvector), `redis`, `backend` (migrates then serves), `worker` (Celery, concurrency 2), `frontend` (nginx on `:8080` proxying `/api`); health-gated startup |
| **Intended production shape** | Stateless API container + managed PostgreSQL; **`JOB_RUNNER=inline` is the sensible default on hosts without a worker process**; Redis/Celery only when a worker is actually deployed |

The complete multi-container stack and the production shape are **different
configurations**; nothing in the repository deploys to Vercel or Render, and
Redis/Celery must not be assumed present in production. Diagram, environment
variables, migration procedure, health checks, and the reused-trade-offs table:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## 11. Installation and local development

### Prerequisites

- Python **3.11+** (3.12 matches the container image) and `pip`
- Node **20+** and `npm`
- Optional: Docker + Docker Compose (full stack), Playwright Chromium (E2E)

### 1. Environment configuration

```bash
cp .env.example .env
# then edit at minimum SECRET_KEY; add provider/LLM keys only if you need live mode
```

`backend/app/core/config.py` reads `.env` / `../.env` via pydantic-settings, so a
single root `.env` serves both the API and the Compose stack. Every variable,
default and effect: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §6.

### 2. Backend setup

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

cd backend
alembic upgrade head               # creates the schema (SQLite by default)
uvicorn app.main:app --reload --port 8000
```

`http://127.0.0.1:8000/health` → `{"status":"ok","database":"ok",...}`;
`http://127.0.0.1:8000/docs` → OpenAPI/Swagger UI.

On startup the API also calls `Base.metadata.create_all` (development
convenience) and seeds the demo workspace when `DEMO_MODE` and
`SEED_DEMO_ON_STARTUP` are true.

To use PostgreSQL locally instead of SQLite:

```env
DATABASE_URL=postgresql+psycopg://marketpulse:marketpulse@localhost:5432/marketpulse
```

Run `alembic upgrade head` again against that URL.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev                        # http://127.0.0.1:5173
```

Vite proxies `/api` to `http://127.0.0.1:8000` (override with
`VITE_PROXY_TARGET`). For a build against a different API origin, set
`VITE_API_BASE_URL` at build time — it is baked into the bundle.

### 4. Database migrations

```bash
cd backend
alembic upgrade head      # apply all revisions
alembic downgrade -1      # roll back the latest revision
alembic current           # inspect the applied revision
```

Alembic takes `DATABASE_URL` from application settings, not `alembic.ini`.
See [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) §10.

### 5. Optional background services

```bash
# Full local stack (Postgres + Redis + Celery worker + nginx frontend)
docker compose up --build

# Background services only
docker compose up -d postgres redis
# then run the backend with JOB_RUNNER=celery and a worker:
cd backend && celery -A app.workers.celery_app.celery_app worker --loglevel=info --concurrency=2
```

With `JOB_RUNNER=inline` (default) no Redis or worker is required — research runs
in a process-local thread pool.

### 6. Optional: live research and LLM enrichment

```env
SEARCH_PROVIDER=tavily            # none | tavily | brave
TAVILY_API_KEY=...                # or BRAVE_API_KEY with SEARCH_PROVIDER=brave
LLM_PROVIDER=gemini               # gemini | none
GEMINI_API_KEY=...                # optional enrichment
GEMINI_MODEL=gemini-2.0-flash
```

Never commit real keys. `.env` is git-ignored; use your host's secret manager in
deployment.

---

## 12. Technical documentation index

| Document | What it answers |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Layers, component interactions, execution sequence, deployment topology, trade-offs |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) | All 22 tables, keys, relationships, ER diagram, indexes, JSONB usage, migrations, deletion behaviour |
| [`docs/RESEARCH_PIPELINE.md`](docs/RESEARCH_PIPELINE.md) | Stage-by-stage pipeline, sentiment/severity/opportunity/validation algorithms with worked examples |
| [`docs/AI_ENGINEERING.md`](docs/AI_ENGINEERING.md) | Gemini integration, prompts, structured output, RAG retrieval maths, hallucination and injection controls |
| [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) | Every endpoint, auth, params, schemas, status codes, error envelopes with real examples |
| [`docs/SECURITY.md`](docs/SECURITY.md) | AuthN/AuthZ, ownership isolation, validation, threat model, residual risk |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Local vs Compose vs production, env vars, migrations, health checks, verification matrix |
| [`docs/TESTING.md`](docs/TESTING.md) | Test inventory, what each suite proves, mocking, isolation, verified results, gaps |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) | Query and pipeline cost model, known bottlenecks, proposed measurements |
| [`docs/LIMITATIONS_AND_ROADMAP.md`](docs/LIMITATIONS_AND_ROADMAP.md) | Everything not implemented or not verified, and realistic next steps |
| [`docs/decisions/`](docs/decisions/) | ADR-001 FastAPI · ADR-002 PostgreSQL · ADR-003 SQLAlchemy/Alembic · ADR-004 deterministic core · ADR-005 optional Redis/Celery · ADR-006 research processing |

---

## 13. Known limitations

Genuinely absent or unverified — see
[`docs/LIMITATIONS_AND_ROADMAP.md`](docs/LIMITATIONS_AND_ROADMAP.md) for the full
list and reasoning.

- **Retrieval is lexical, not vector search.** Records store a 96-dimension
  hashing bag-of-words embedding as JSON and are ranked with cosine similarity in
  Python. `pgvector` is enabled in the Postgres image but **no** `vector` column,
  ANN index or SQL-side similarity query exists.
- **Live mode uses provider snippets.** There is no HTML fetch/boilerplate-strip
  stage: a live record's text is the search result snippet. Demo mode uses the
  synthetic corpus. Full-page extraction is roadmap work.
- **Duplicate records are suppressed, not stored.** `evidence_records.duplicate_of`
  and `duplicate_status` exist, but ingestion skips near-duplicates instead of
  persisting them as duplicates, so `duplicate_of` is always `null` today.
- **CI runs tests only.** `.github/workflows/ci.yml` executes pytest, Vitest,
  `tsc -b`/build and Playwright, but there is no coverage gate, no
  dependency/secret scanning, no PostgreSQL service and no deployment job.
- **Single-revision migration history.** One Alembic revision
  (`e57b23e93738`, initial schema); it was exercised on SQLite only.
- **Scheduling is not automated.** A `monitoring.tick` Celery task exists but no
  beat schedule is configured, and monitoring reports `execution_mode: manual`
  unless a live provider is configured.
- **Rate limiting is per process.** The limiter is an in-memory dict, so limits
  are per worker instance and reset on restart.
- **Two settings are declared but unused**: `RESEARCH_MAX_QUERIES`
  (mode profiles govern query counts) and `MAX_UPLOAD_BYTES` (no upload endpoint
  exists).
- **Not verified here:** Docker Compose execution, PostgreSQL-specific DDL,
  live Tavily/Brave/Gemini calls, browser accessibility audit, measured p95
  latency or concurrency benchmarks.
- Sentiment is a lexicon model, not a trained classifier: sarcasm, negation beyond
  a 3-token window and domain jargon can be misread. The simulator is a
  stated-assumption qualitative model, not a forecast.

---

## 14. Future roadmap

Planned, **not implemented**. Nothing here exists in the current codebase.

| Area | Intent |
| --- | --- |
| Retrieval | Replace hashing/cosine with a real embedding provider and a `pgvector` column + HNSW index, behind the existing `retrieve()` interface |
| Collection | Fetch and extract page text with boilerplate removal, per-domain rate limits and robots awareness; persist rejected sources with reasons |
| Duplicates | Store near-duplicates with `duplicate_of` populated and a reviewer merge action |
| Scheduling | Celery beat (or a platform cron) driving `monitoring.tick`, with idempotent run keys |
| Quality gates | Coverage reporting with a floor, `pip-audit`/`npm audit` and an ESLint gate added to the existing CI workflow |
| Analysis | Multi-language sentiment, trained classifier option alongside the lexicon, and topic extraction beyond keyword matching |
| Scale | Materialised analytics/report snapshots per report version; index review after profiling real workloads |
| Security | Distributed rate limiter (Redis), refresh/rotation tokens, structured secret rotation runbook |

---

## Project layout

```
backend/
  app/
    api/          routers: auth (incl. meta/dashboard), projects, analysis, outputs, ops
    agents/       LLM provider abstraction (Gemini) + prompt guardrails
    core/         settings, security, structured logging, rate limiting
    db/           engine/session/Base, SQLite pragmas
    models/       SQLAlchemy 2 typed models (22 tables)
    research/     taxonomy (topics, modes, stages), search providers, demo corpus
    schemas/      Pydantic request/response contracts
    services/     orchestrator, analysis engine, analytics, graph, report,
                  simulator, assistant, monitoring, demo seed
    workers/      Celery app + tasks, inline runner
  migrations/     Alembic environment + initial revision
  tests/          pytest: health/auth, engines, full project flow
frontend/
  src/
    pages/        landing, auth, dashboard, research studio, 11 analysis surfaces
    components/   UI primitives, layout, charts, marketing
    features/     studio steps, evidence list, assistant panel
    hooks/        auth, theme, project data queries
    lib/          API client, formatting
  e2e/            Playwright analyst journey
docs/             architecture, database, pipeline, AI, API, security,
                  deployment, testing, performance, ADRs, images
infrastructure/   Postgres init (pgvector extension)
.github/
  workflows/ci.yml  pytest, Vitest + build, Playwright journey
```

---

## License

MIT — see [`LICENSE`](LICENSE).
