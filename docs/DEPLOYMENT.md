# Deployment

## 1. Docker Compose (recommended, single host)

```bash
cp .env.example .env
# edit SECRET_KEY at minimum
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

What the stack runs:

| Container | Image | Role |
| --- | --- | --- |
| `postgres` | `pgvector/pgvector:pg16` | Database, `vector` extension enabled on init |
| `redis` | `redis:7-alpine` | Celery broker/result backend, AOF persistence |
| `backend` | built from `backend/Dockerfile` | Migrates, then serves FastAPI on `:8000` |
| `worker` | same image | Celery worker for pipeline jobs |
| `frontend` | built from `frontend/Dockerfile` | nginx on `:8080`, proxies `/api` → backend |

Startup order is enforced with health checks: Postgres and Redis must be healthy
before the backend starts; the frontend waits for a healthy backend. The backend
command runs `alembic upgrade head` before `uvicorn`, so schema changes apply
automatically.

Backend health: `GET /health` (also used by `HEALTHCHECK`).
Frontend health: nginx serves `/` and proxies `/health`.

### Before exposing it

1. Set a strong `SECRET_KEY` (32+ random characters). The default is insecure.
2. Set `CORS_ORIGINS` to your real origin(s).
3. Set `ENVIRONMENT=production`; change the demo password or disable
   `DEMO_MODE`/`SEED_DEMO_ON_STARTUP`.
4. Terminate TLS in front of nginx (Caddy, Traefik, Cloudflare, or a load
   balancer). The container serves plain HTTP.
5. Set `POSTGRES_PASSWORD` and keep port 5432 unpublished if not needed.
6. Back up the `pgdata` volume; it holds all accounts, evidence and reports.

```bash
docker compose exec postgres pg_dump -U marketpulse marketpulse > backup.sql
```

## 2. Managed / split deployment

The app is stateless apart from the database, so components can be split.

| Component | Suitable hosts | Notes |
| --- | --- | --- |
| Frontend | Cloudflare Pages, Netlify, Vercel, nginx | Static `dist/`; set `VITE_API_BASE_URL` to the API origin |
| API + worker | Render, Railway, Fly.io, ECS, Kubernetes | Python 3.12 container; run migrations on release |
| Database | Neon, Supabase, RDS, Cloud SQL | Requires PostgreSQL 14+; `pgvector` optional |
| Redis | Upstash, ElastiCache | Only needed for the Celery runner |

Build the frontend with the API origin baked in:

```bash
cd frontend
VITE_API_BASE_URL=https://api.example.com/api npm run build
```

Set backend CORS to the frontend origin and configure provider keys as secrets in
the host's secret manager — never in the repository.

If the platform runs only web processes (no worker), set `JOB_RUNNER=inline`.
Analysis then runs in the API process; keep instance timeouts above the pipeline
duration for deep mode.

## 3. Database migrations

```bash
cd backend
alembic upgrade head          # apply
alembic downgrade -1          # roll back one revision
alembic current               # inspect
```

The initial revision creates all 22 tables with portable types: `Uuid` and
`JSON` with a `JSONB` variant on PostgreSQL. It was tested with upgrade and
downgrade against SQLite; PostgreSQL execution was not possible in the build
environment (no Docker), so validate with `alembic upgrade head` against a
staging Postgres before production.

Alembic reads `DATABASE_URL` through `app.core.config.settings`, not from
`alembic.ini`, so the container and CLI share one source of truth.

## 4. Scaling and performance

- The API is horizontally scalable; sessions are per-request and auth is JWT.
- Move to `JOB_RUNNER=celery` and scale workers independently for concurrent
  research. Deep mode is the heaviest workload.
- Evidence listing is paginated and indexed on `project_id`, `country`,
  `sentiment`, `source_category` and `published_at`.
- Derived views (analytics, graph, report) are computed per request from stored
  rows; for very large projects add materialised snapshots keyed by report
  version.
- nginx gzips text assets and caches hashed bundles for 7 days. HTML is not
  cached, so deployments take effect immediately.

## 5. Observability

- Structured logs to stdout with a request id and latency; collect with your
  platform's log driver.
- `/health` is safe for liveness; it performs a trivial database check.
- Pipeline failures are persisted in `research_tasks` with error text and
  surfaced in the UI, so incidents are diagnosable without log access.
- `scripts/seed_demo.py` is idempotent and safe to run after deploys.

## 6. Security checklist

- [ ] `SECRET_KEY` rotated, not the default
- [ ] `CORS_ORIGINS` restricted to real origins
- [ ] TLS terminated before the app
- [ ] Postgres port not publicly exposed; strong password
- [ ] Demo credentials changed or demo seeding disabled
- [ ] Provider keys stored as secrets, not env files in git
- [ ] Backups scheduled and restore tested
- [ ] Rate limit tuned to expected assistant usage
- [ ] Container images rebuilt for base-image security updates

## 7. Cost and free-tier reality

A fully free, permanently available deployment is not guaranteed by any host.
Free tiers typically sleep after inactivity (cold starts of 30–60s), cap monthly
hours, expire databases, or limit Redis connections. For a reliable demo, use a
single small always-on host with the Compose stack and a managed Postgres free
tier, and expect to pay a few dollars a month once the free allowance ends. Live
research also consumes provider credits: Tavily/Brave and Gemini have their own
quotas. Demo mode requires no paid keys at all.

## 8. What was verified here

| Check | Result |
| --- | --- |
| Backend pytest | Passed locally (SQLite) |
| Frontend unit/component tests | Passed locally |
| Frontend production build | Passed locally |
| Alembic upgrade/downgrade | Passed locally (SQLite) |
| Playwright E2E | Passed locally against the running API (5/5 journey tests) |
| `docker compose up --build` | **Not executed** — Docker unavailable on the build machine |
| PostgreSQL-specific DDL | **Not executed** — no Docker/Postgres available |
| Live Tavily/Brave/Gemini calls | **Not executed** — no API keys used |
