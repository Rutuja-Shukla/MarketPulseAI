# Testing and quality engineering

> All results in §7 were produced by running the suites in this repository on
> 2026-11-16 (Windows, Python 3.12 venv, Node 20). Nothing here is estimated.
> The same commands run in CI (`.github/workflows/ci.yml`, §9); that workflow was
> authored and syntax-checked, but has not been executed on GitHub yet.

---

## 1. Test inventory

| Suite | Location | Tooling | Files | Tests |
| --- | --- | --- | --- | --- |
| Backend unit + API integration | `backend/tests/` | pytest 8, FastAPI `TestClient` (httpx), SQLAlchemy, multiple SQLite engines | 3 | **23** |
| Frontend unit + component | `frontend/src/__tests__/` | Vitest 3, Testing Library (react, user-event, jest-dom), jsdom, `vi.mock` | 8 | **30** |
| End-to-end | `frontend/e2e/marketpulse.spec.ts` | Playwright 1.49 (Chromium) | 1 | **5** |

Counts are the discovered tests, not assertions. No `pytest` plugin beyond the core
package is used (no `pytest-cov`, no `pytest-asyncio`, no `responses`).

| Backend file | Tests | Focus |
| --- | --- | --- |
| `test_health_auth.py` | 7 | Health, public catalog, register/login/me, duplicate email, wrong password, protected routes, password policy |
| `test_engines.py` | 9 | Sentiment labels + negation, topic classification, near-duplicate detection, embedding determinism, credibility prior, ingestion dedupe, evidence-derived findings, empty payload |
| `test_project_flow.py` | 7 | Brief validation (country, market scope, period), full demo pipeline end-to-end through the API, cross-user isolation, live-mode refusal without a provider, cascade delete |

| Frontend file | Focus |
| --- | --- |
| `analytics.test.tsx` | Analytics page renders chart sections from mocked API data (ECharts mocked) |
| `api-client.test.ts` | `ApiError` shape, 401 token clearing, 204 handling, non-JSON responses, network failure message |
| `country-picker.test.tsx` | Market selection behaviour and accessibility labels |
| `dashboard.test.tsx` | Metric cards, demo banner, project list rendering |
| `landing.test.tsx` | Positioning copy and primary calls to action |
| `login.test.tsx` | Demo credential hint, failed sign-in handled without navigation |
| `studio-schema.test.ts` | The zod studio schema: 8 validation cases |
| `theme.test.tsx` | Light default, toggle, persistence |

---

## 2. Test organisation and isolation

### Backend

```python
# backend/tests/conftest.py — runs before app import
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE_URL", f"sqlite:///./test-{uuid.uuid4().hex}.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-marketpulse-tests-0001")
os.environ.setdefault("SEED_DEMO_ON_STARTUP", "false")
os.environ.setdefault("DEMO_MODE", "true")
os.environ.setdefault("RATE_LIMIT_AI_PER_HOUR", "500")
```

- **Fresh database per test session** — a randomly named SQLite file, so a run never
  touches the development database and cannot inherit its rows. Files are git-ignored by
  `backend/*.db`.
- **Session-scoped app fixture** — `TestClient(app)` is created as a context manager, so
  the real `lifespan` runs (logging configuration, `init_db`, demo-seeding logic — which
  is disabled by the env var above).
- **Per-test user** — `auth_headers` registers a random address and returns
  `(headers, email)`, so tests never share an account; the isolation test registers a
  second account inside the test.
- **Engine tests get their own database** — `test_engines.py` builds
  `sqlite:///:memory:` with `Base.metadata.create_all` per test, so analysis code is
  exercised without HTTP and without the session database.
- **Rate limiter neutralised** — the 500/hour budget prevents the full-flow test from
  tripping 429s; consequently the limiter itself is untested (§8).
- **No external network** — every backend test uses demonstration mode, so no search or
  LLM call is attempted. The live path is asserted only at its guard: a live project
  without a provider must return 409.

### Frontend

- `src/test/setup.ts` extends `expect` with jest-dom and resets state between tests.
- `src/test/utils.tsx::mockApi(routes)` stubs global `fetch` with a `vi.fn` that matches
  URL substrings, returns real `Response` objects (so the actual `lib/api.ts` parsing,
  status handling and error mapping are exercised), records calls, and allows per-route
  status codes for failure cases.
- `renderWithProviders` wraps a component in `ThemeProvider`, a fresh `QueryClient`
  (`retry: false`, `gcTime: 0`), `AuthProvider` and `MemoryRouter`.
- Charts are mocked (`vi.mock("echarts", …)`) because jsdom has no canvas; the wrapper
  contract (setOption/resize/dispose) is therefore not asserted.
- Router future-flag warnings and jsdom `act(...)` warnings appear in output; they are
  pre-existing and non-fatal.

### End-to-end

- Serial mode (`test.describe.configure({ mode: "serial" })`), one worker, no retries,
  1440×960 viewport, trace + screenshot on failure.
- `webServer` reuses the running Vite dev server (`reuseExistingServer: true`) or starts
  one; the API must already be running on `:8000`.
- The journey registers a fresh analyst, completes the seven studio steps, waits for the
  pipeline to finish (up to 120 s), and walks the analysis sections plus dark-mode
  persistence. It **writes to the local development database** (one account, one
  project) — run it against a disposable database if that matters.

---

## 3. What the backend tests actually prove

| Claim | Test |
| --- | --- |
| Sentiment produces positive/negative/neutral labels on clear input | `test_sentiment_labels` |
| Negation flips polarity and lowers the score | `test_negation_flips_sentiment` |
| Keyword topic classification detects pricing + support in one record | `test_topic_classification` |
| 5-gram Jaccard distinguishes near-duplicates from unrelated text | `test_near_duplicate_detection` |
| The 96-dim embedding is deterministic and L2-normalised | `test_embeddings_are_normalised_and_stable` |
| Credibility prefers primary research over forum posts | `test_credibility_prefers_primary_research` |
| Ingestion deduplicates near-identical records and marks demo rows | `test_ingest_deduplicates_and_classifies` |
| Findings are evidence-derived: non-empty `evidence_ids`, bounded confidence, valid severity, `is_estimate` set, quadrant rule respected, roadmap has success metrics, report has ≥ 8 sections | `test_findings_are_derived_from_evidence` |
| Empty ingest is a no-op | `test_ingest_handles_empty_payload` |
| Auth: register → login → me, duplicate email 409, wrong password 401, protected routes 401, short password 422 with a field name | `test_register_login_and_me`, `test_duplicate_registration_is_rejected`, `test_wrong_password_is_rejected`, `test_protected_routes_require_auth`, `test_short_password_is_rejected` |
| Pipeline runs end-to-end through the API and every artefact is reachable: detail, evidence, failures, opportunities, customer voice (+ filters), competitors, graph + node evidence, analytics keys, report + HTML export, roadmap + patch + export, simulate, compare, chat with citations, monitoring, notifications, dashboard, filtered list | `test_full_demo_research_flow` |
| A second user gets 404 on detail/evidence and an empty list | `test_project_isolation_between_users` |
| Live mode without a provider fails loudly with an actionable message | `test_live_research_without_provider_is_explicit` |
| Deleting a project removes its children | `test_delete_project_removes_children` |
| Brief validation rejects unknown country codes, empty market scope and inverted periods | `test_create_project_validates_country`, `test_create_project_requires_market_scope`, `test_create_project_rejects_inverted_period` |

---

## 4. What the frontend tests actually prove

| Claim | Test file |
| --- | --- |
| The API client maps HTTP failures, clears tokens on 401, handles 204 and non-JSON bodies, and reports an unreachable API | `api-client.test.ts` |
| The dashboard renders metrics, demo labelling and project rows from API data | `dashboard.test.tsx` |
| The analytics surface renders its sections with mocked chart data | `analytics.test.tsx` |
| Market selection is operable and labelled | `country-picker.test.tsx` |
| The landing page keeps its positioning and CTAs | `landing.test.tsx` |
| A failed sign-in stays on the page and shows the error; demo credentials are advertised | `login.test.tsx` |
| Studio validation enforces required company/market fields and the depth/source rules | `studio-schema.test.ts` |
| Theme defaults to light, toggles, and persists to `localStorage` | `theme.test.tsx` |

These are **component tests**, not visual regression tests. No screenshot comparison,
accessibility audit or Lighthouse run exists.

---

## 5. External API mocking strategy

| Dependency | In backend tests | In frontend tests | In E2E |
| --- | --- | --- | --- |
| Tavily / Brave | never called (demo mode) | — | never called |
| Gemini | never called (demo mode + no key) | — | never called |
| `fetch` | — | stubbed via `mockApi` (URL-substring routing) | real HTTP to the dev API |
| ECharts | — | module mocked | real |
| Database | SQLite file / in-memory | — | real SQLite dev database |

Consequence: the deterministic and fallback paths are tested; the **happy paths of the
live provider and LLM integrations are not**. No `responses`/`respx`/`nock`-style HTTP
interception exists, so adding provider tests means introducing that tooling (or
extracting the HTTP call behind a seam — `SearchProvider` and `LLMProvider` already
provide one).

---

## 6. Database testing

- Engine-level tests use per-test in-memory SQLite: fast, isolated, no teardown races.
- API tests use a per-session SQLite file with `PRAGMA foreign_keys=ON` (set in
  `db/session.py`), so cascade assertions are meaningful.
- PostgreSQL behaviour (JSONB, `NULLS LAST`, batch DDL) is **not** covered by any test.
- No test asserts an index is used, a query plan, or a migration round-trip.

---

## 7. Verified results (2026-11-16)

```bash
cd backend && python -m pytest -q
# ....................... [100%]
# 23 passed
# exit status 0

cd frontend && npm test
# Test Files  8 passed (8)
#      Tests  30 passed (30)
#   Duration  8.33s
# exit status 0

cd frontend && npm run build
# tsc -b && vite build → succeeded
# exit status 0

cd frontend && npx playwright install chromium   # one-off, this machine
cd frontend && npx playwright test
# Running 5 tests using 1 worker
#   ok 1 landing page introduces the product and light theme is default (8.1s)
#   ok 2 a new analyst can register (843ms)
#   ok 3 the research studio creates and runs an analysis (3.4s)
#   ok 4 analysis sections render real findings (2.7s)
#   ok 5 dark mode can be enabled and persists (1.2s)
#   5 passed (17.2s)
# exit status 0
```

| Metric | Value |
| --- | --- |
| Backend tests discovered | 23 |
| Backend passed / failed / skipped | 23 / 0 / 0 |
| Frontend tests discovered | 30 (8 files) |
| Frontend passed / failed / skipped | 30 / 0 / 0 |
| Playwright tests discovered | 5 |
| Playwright passed / failed / skipped | 5 / 0 / 0 |
| Frontend production build | passed |
| Coverage | **not measured** — no coverage tool or threshold configured |
| Lint / static analysis | none configured (no ESLint, Ruff or mypy config) |
| CI workflow | `.github/workflows/ci.yml` — backend, frontend + build, Playwright (authored, not yet run on GitHub) |

### Warnings observed (pre-existing, non-fatal)

- `StarletteDeprecationWarning`: `httpx` + `TestClient` usage, and the deprecated
  `HTTP_422_UNPROCESSABLE_ENTITY` constant (4 validation tests).
- React Router "Future Flag Warning" for `v7_startTransition` and
  `v7_relativeSplatPath` (frontend console).
- jsdom `act(...)` warnings from `login.test.tsx` (async state update outside `act`).

None of these are test failures; fixing them is cleanup work, not a defect.

---

## 8. Untested areas (explicit)

| Area | Why it is untested | Risk |
| --- | --- | --- |
| Live search provider success path | needs a key and network | medium — parsing/response-shape bugs would only appear in live mode |
| Gemini success path, retry, JSON repair | needs a key | medium |
| Celery dispatch and worker execution | needs Redis | low while the inline runner is the default |
| Rate limiting (429) | limiter is set to 500/hour in tests | low — but the limiter is a documented security control |
| Token expiry and malformed-token variants | only a garbage-token 401 is asserted | low |
| Monitoring interval arithmetic and `monitoring.tick` | no test | low |
| Reports with zero findings / zero competitors | not asserted | medium — degenerate-project output is unverified |
| Very large projects (perf) | no load test | high for scaling claims |
| PostgreSQL-specific behaviour | no service in CI | medium |
| Migrations (upgrade/downgrade) | not part of the suite | medium |
| Accessibility, visual regression, i18n | no tooling | low for correctness, medium for claims |
| Frontend analysis pages other than analytics/dashboard | not covered by unit tests (E2E touches a few) | medium — most surfaces rely on E2E only |

---

## 9. CI/CD

`.github/workflows/ci.yml` runs on every push, every pull request and on manual
dispatch. Three jobs, all on `ubuntu-latest`:

| Job | Runtime | Steps |
| --- | --- | --- |
| `backend` | Python 3.12, pip cache | `pip install -r backend/requirements.txt` → `python -m pytest -q` |
| `frontend` | Node 20, npm cache | `npm ci` → `npm test` → `npm run build` (`tsc -b && vite build`) |
| `e2e` | needs both | installs API requirements, starts `uvicorn` on SQLite, waits for `/health`, `npx playwright install --with-deps chromium`, `npx playwright test`, uploads `frontend/test-results` on failure |

Design notes:

- **No secrets are needed.** The e2e job sets `SEARCH_PROVIDER=none`,
  `LLM_PROVIDER=none`, `DEMO_MODE=true`, a throwaway `SECRET_KEY` and a SQLite
  `DATABASE_URL`, so no provider key can leak and no external API is called.
- The API is started as a background process and the job polls `GET /health` up to 60
  times before running Playwright, so a slow import cannot produce a flaky failure.
- `concurrency` cancels superseded runs on the same ref.
- The Playwright config starts the Vite dev server itself (`npm run dev`) because
  `E2E_BASE_URL` is unset, and Vite proxies `/api` to `127.0.0.1:8000`.

What CI deliberately does **not** do yet:

| Missing gate | Consequence |
| --- | --- |
| Coverage measurement / threshold | A drop in coverage is invisible |
| `npm audit` / `pip-audit` | Vulnerable dependencies are not flagged |
| ESLint / Ruff / mypy | Style and type regressions outside `tsc -b` are not caught |
| PostgreSQL service container | PostgreSQL DDL stays unverified (§8) |
| Deployment job | CI never publishes anything; releases are manual |

The workflow mirrors the commands verified locally in §7. It has not yet been
observed running on GitHub, so pipeline green is still unconfirmed.

---

## 10. Quality recommendations

| Priority | Action | Reason |
| --- | --- | --- |
| 1 | Add coverage reporting with a floor to the existing workflow | Tests run in CI, but no coverage is measured |
| 2 | Add coverage reporting with a modest floor | Reference counts exist, but not coverage |
| 3 | Provider/LLM contract tests via `respx`/`responses` against `SearchProvider`/`LLMProvider` | The two integrations with real failure modes are untested |
| 4 | Add a rate-limit test with a low configured budget | Verifies a security control |
| 5 | Add a migration test (SQLite + PostgreSQL service) | One revision was never round-tripped in CI |
| 6 | Add degenerate-project tests (no findings, no competitors, one record) | Empty-state correctness is unverified |
| 7 | Add accessibility assertions (`jest-axe`) and a Playwright smoke across all 11 analysis surfaces | Only some surfaces are exercised today |
| 8 | Introduce linting/typing gates (ESLint, `ruff`, `mypy`) | No static analysis configuration exists |

---

## Related documents

- What was and was not run in deployment: [`DEPLOYMENT.md`](DEPLOYMENT.md) §9
- Algorithm fixtures used by `test_engines.py`: [`RESEARCH_PIPELINE.md`](RESEARCH_PIPELINE.md) §7
- Untested risk in context: [`LIMITATIONS_AND_ROADMAP.md`](LIMITATIONS_AND_ROADMAP.md)
