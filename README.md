# MarketPulse AI

Market intelligence that shows its working. MarketPulse AI turns scattered public
signal — reviews, discussions, support threads, releases, comparisons — into a
structured, evidence-traceable view of where a product is failing, where the
market is moving, and what to do next.

The interface is editorial rather than dashboard-generic: warm ivory paper, navy
ink, serif display type, monospaced figures, and a strict separation between
**observed evidence**, **interpretation**, **hypothesis** and **recommendation**.

![Stack](https://img.shields.io/badge/stack-FastAPI%20%C2%B7%20React%20%C2%B7%20PostgreSQL-1b2a41)

---

## What it does

| Surface | What it answers |
| --- | --- |
| Overview | What did we find, how strong is the evidence, what should we do? |
| Failure Radar | Where is the product underperforming, how severe, based on what? |
| Opportunity Radar | Where could the business move, and is it impact or effort? |
| Customer Voice | What did customers actually say, and how representative is it? |
| Competitor Intelligence | How do we compare, on which dimensions, with which sources? |
| Intelligence Graph | Which complaint connects to which risk and which opportunity? |
| Simulator | What happens if we act — modelled, with stated assumptions |
| Roadmap | Sequenced actions, owned and prioritised, editable |
| Analytics | Sentiment over time, topics, geography, sources, severity |
| Evidence & Trust Centre | Every record, its provenance, confidence and contradictions |
| Report | A print-ready executive deliverable with references and limitations |
| Market Monitor | Recurring checks with an explicit automated/manual label |

---

## Quick start (Docker)

```bash
cp .env.example .env          # safe development defaults; no paid keys needed
docker compose up --build
```

| Service | URL |
| --- | --- |
| Web app | http://localhost:8080 |
| API docs (OpenAPI) | http://localhost:8000/docs |
| API health | http://localhost:8000/health |
| PostgreSQL | localhost:5432 |
| Redis | internal only |

The first start runs Alembic migrations, seeds a demonstration workspace, and
brings up the API, a Celery worker and an nginx-served frontend.

**Demo sign-in:** `demo@marketpulse.ai` / `DemoPass123!` — or press
*Enter the demonstration workspace* on the login screen.

> Demo mode is clearly labelled everywhere: **DEMO DATA — Illustrative findings,
> not live market research.** The corpus is synthetic (fictional company
> *Lumenly*, fictional competitors) and demo source URLs point at
> `demo.marketpulse.ai`, a host that does not publish those articles. Nothing in
> demo mode is presented as a real quotation or a real statistic.

---

## Quick start (no Docker)

Requirements: Python 3.11+, Node 20+, npm.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r backend/requirements.txt

cd backend
alembic upgrade head                       # SQLite by default
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev                                # http://127.0.0.1:5173
```

Vite proxies `/api` to `http://127.0.0.1:8000`. The backend seeds the demo
workspace on first start (`SEED_DEMO_ON_STARTUP=true`).

To point at PostgreSQL locally, set:

```env
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/marketpulse
```

---

## Live research vs demonstration

The app is honest about which mode it is in, and refuses to fabricate data.

| Configuration | Behaviour |
| --- | --- |
| No search provider | Live collection disabled. Demo corpus, or projects that run as **demo** with a warning. |
| Search provider + LLM | Full pipeline: real retrieval, extraction, then deterministic verification. |
| Search provider, no LLM | Retrieval and deterministic analysis still run; the report labels the provider as heuristic. |

```env
SEARCH_PROVIDER=tavily            # none | tavily | brave
TAVILY_API_KEY=...                # or BRAVE_API_KEY with SEARCH_PROVIDER=brave
LLM_PROVIDER=gemini               # gemini | none
GEMINI_API_KEY=...                # optional enrichment
GEMINI_MODEL=gemini-2.0-flash
```

A research project is only marked complete in live mode when evidence passed
validation: the record must carry a real URL, a fetchable source and enough
text to quote. Findings without evidence are dropped rather than embellished.

---

## Architecture at a glance

```
React 18 + TypeScript + Vite
        │  TanStack Query, RHF + zod, ECharts, React Flow
        ▼
FastAPI  ──  JWT auth (PBKDF2), rate limits, structured logging
        │
        ├── Research orchestrator ── stage tasks recorded per project
        │      ├── search providers (Tavily / Brave / demo corpus)
        │      ├── deterministic analysis engine (sentiment, topics, findings)
        │      ├── optional Gemini enrichment (guarded, schema-validated)
        │      └── report + roadmap + graph builders
        │
        ├── PostgreSQL (+ pgvector image) ── SQLAlchemy 2, Alembic
        └── Redis + Celery worker (or in-process thread runner)
```

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ·
[`docs/RESEARCH_PIPELINE.md`](docs/RESEARCH_PIPELINE.md) ·
[`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) ·
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Project layout

```
backend/
  app/
    api/          routers: auth, projects, analysis, outputs, ops
    core/         settings, security, logging
    db/           engine, session, Base
    models/       SQLAlchemy models (22 tables)
    research/     taxonomy, search providers, demo corpus, prompt guards
    schemas/      Pydantic request/response contracts
    services/     orchestrator, analysis engine, report, analytics, graph,
                  simulator, RAG assistant, monitoring, demo seed
    workers/      Celery app + tasks, inline runner
  migrations/     Alembic environment and initial revision
  tests/          pytest: auth, project flow, engines
frontend/
  src/
    pages/        landing, auth, dashboard, research studio, analysis suite
    components/   editorial UI primitives, layout, charts
    features/     research studio steps, validation schema
    hooks/        auth, theme, project data queries
    lib/          API client, formatting, utilities
  e2e/            Playwright journey
docs/             architecture, pipeline, API, deployment
infrastructure/   Postgres init (pgvector)
```

---

## Tests

```bash
# Backend
cd backend
pytest -q

# Frontend unit / component
cd frontend
npm test

# Production build
npm run build

# End-to-end (requires the backend running on :8000 and a Chromium install)
npx playwright install chromium
npm run e2e
```

The Playwright journey registers a fresh analyst, builds a research brief through
all seven studio steps, waits for the pipeline, and walks the analysis sections
plus dark-mode persistence.

---

## Configuration reference

| Variable | Default | Purpose |
| --- | --- | --- |
| `SECRET_KEY` | dev value | JWT signing — **replace in any real deployment** |
| `DATABASE_URL` | `sqlite:///./marketpulse.db` | SQLAlchemy URL; Compose injects Postgres |
| `CORS_ORIGINS` | localhost dev ports | Comma-separated allowed origins |
| `DEMO_MODE` | `true` | Enables the demo workspace and synthetic corpus |
| `SEED_DEMO_ON_STARTUP` | `true` | Seed the demo user and project idempotently |
| `SEARCH_PROVIDER` | `none` | `tavily` or `brave` enables live collection |
| `LLM_PROVIDER` | `gemini` | `none` disables model enrichment |
| `JOB_RUNNER` | `inline` | `celery` uses Redis + worker |
| `RATE_LIMIT_AI_PER_HOUR` | `60` | Per-user assistant/simulation budget |
| `VITE_API_BASE_URL` | `/api` in Docker | Frontend API base at build time |

---

## Design decisions worth knowing

- **Deterministic core.** Sentiment, topic assignment, failure/opportunity
  detection and severity are computed from the evidence with a documented
  lexicon and topic taxonomy. The LLM enriches language; it does not invent
  findings.
- **No fake citations.** A finding keeps the IDs of the records that support it.
  Aggregates state their evidence count. Demo references are marked synthetic.
- **Confidence is explicit.** Every record carries credibility, corroboration,
  sentiment and a contradiction group when records disagree.
- **Jobs are observable.** Each pipeline stage is persisted with status, timing
  and error text, so a failed run explains itself.
- **Degradation is visible.** Without keys the UI states which capability is
  unavailable instead of silently producing weaker output.
- **Auth is self-contained.** PBKDF2-SHA256 password hashing and HS256 JWTs, no
  third-party identity dependency.

---

## Known limitations

- **Docker Compose was authored but not executed in this environment** (Docker
  was unavailable). The Dockerfiles, Compose file, health checks and nginx proxy
  are provided as written; verify them on a Docker host.
- Migrations were generated and exercised (upgrade + downgrade) against SQLite.
  PostgreSQL-specific behaviour relies on SQLAlchemy's `Uuid` and `JSONB`
  variants and was not executed here.
- Live search/LLM paths are implemented against the documented Tavily, Brave and
  Gemini HTTP APIs but were **not exercised** with real keys here.
- Sentiment is lexicon-based, not a trained classifier; it is transparent and
  reproducible but intentionally simple.
- The simulator is a stated-assumption model, not a forecast.
- Accessibility was implemented (labels, focus styles, reduced motion, contrast)
  but no automated audit was run.

## License

MIT — see [`LICENSE`](LICENSE).
