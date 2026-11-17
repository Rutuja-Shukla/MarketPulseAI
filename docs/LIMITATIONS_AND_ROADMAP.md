# Limitations and roadmap

> Two hard rules for this document: **current limitations are facts about the code**,
> and **roadmap items are explicitly not implemented**. Nothing in §7 exists today.

---

## 1. Current functional limitations

| # | Limitation | Evidence | Impact |
| --- | --- | --- | --- |
| 1 | **Live records contain only the search snippet.** There is no page fetch, boilerplate removal or full-text extraction. | `orchestrator._live_record()` maps `result.snippet` into `text` | Live analysis reasons over short passages; long reviews are only partially represented |
| 2 | **Retrieval is lexical, not semantic.** 96-dim hashing bag-of-words + cosine in Python. | `text_analysis.embedding/cosine`, `assistant.retrieve` | Paraphrase without shared vocabulary is missed; O(n) scan per question |
| 3 | **No vector store.** `pgvector` is enabled in the image but no `vector` column/index/query exists. | `infrastructure/docker/postgres-init.sql` only | No ANN search path today |
| 4 | **Duplicates are discarded, not recorded.** `duplicate_of`/`duplicate_status` exist but ingestion skips near-duplicates. | `AnalysisEngine.ingest()` `continue` on Jaccard ≥ 0.72 | No "N duplicates merged" provenance; `duplicate_status` is always `unique` |
| 5 | **Source validation is minimal.** No URL scheme/format check, no future-date check, no minimum length beyond "non-empty", no canonical-URL dedupe, no rejection log. | `ingest()` | Weak records can enter the corpus; credibility is a label, not a gate |
| 6 | **Sentiment is a lexicon.** No sarcasm, no negation beyond a 3-token window, English only. | `text_analysis.NEGATORS/INTENSIFIERS` | Known misreads; documented in the report's own limitations |
| 7 | **Topic assignment is keyword substring matching** over 11 topics. | `classify_topics` | Novel themes cannot be discovered; multi-topic records double-count per topic |
| 8 | **Competitor matching is a substring test on the excerpt**; no entity resolution. | `build_competitors`, `competitors` route | "Orbit" matches "Orbital"; a name appearing only in the title is missed |
| 9 | **No pricing extraction.** `pricing_summary` is only populated by the demo corpus; live runs render "No reliable public pricing evidence collected." | `_replace_observations` | Competitor pricing comparison is effectively demo-only |
| 10 | **Impact/effort are curated constants** adjusted by volume. | `OPPORTUNITY_TEMPLATES` | Comparable within a project, not across markets |
| 11 | **Some stages are reporting-only**: `deduplicate`, `evidence_validation`, `contradiction_analysis` summarise work done during ingest. | `orchestrator._stage_*` | The ledger is honest about counts but the granularity can be over-read |
| 12 | **No resumability, retry or per-stage backoff.** A failure restarts from collection. | `run()`, `prepare()` | Transient provider errors cost a full run |
| 13 | **A crash can leave a project stuck in `running`.** No reconciler. | `workers/jobs.py` | Manual re-run required |
| 14 | **No notifications on failure.** Only `_finalise()` notifies. | `_notify_completion` | A failed run is visible on the project page, not in the bell |
| 15 | **No sharing or teams.** The tenant is a single user. | `users` → projects ownership | Colleagues cannot share a project |
| 16 | **Simulation is qualitative.** No numeric forecast, confidence < 1, assumptions stated. | `services/simulator.py` | Deliberately not a forecast — also a limitation |
| 17 | **Reports export as printable HTML only.** No server-side PDF generation. | `report/export` returns `text/html` | PDF depends on the browser |
| 18 | **No i18n.** English UI and English analysis. | — | — |
| 19 | **Two settings are inert**: `RESEARCH_MAX_QUERIES`, `MAX_UPLOAD_BYTES`. | `core/config.py`, no consumers | Misleading configuration surface |
| 20 | **Vestigial column**: `simulation_scenarios.created_at_index` is never written. | `models/findings.py` | Schema noise |

---

## 2. Deployment and verification limitations

| # | Limitation | Status |
| --- | --- | --- |
| 1 | **No deployment exists.** No public URL, no Vercel/Render/Cloudflare manifest, no infrastructure-as-code. | Not implemented |
| 2 | **Docker Compose was never executed here** (no Docker daemon on the development machine). Images, health checks and nginx config are reviewed, not proven. | Not verified |
| 3 | **PostgreSQL-specific DDL was never executed.** The single Alembic revision was exercised on SQLite only. | Not verified |
| 4 | **Live Tavily/Brave/Gemini calls were never made** in this environment. Only the deterministic and fallback paths are tested. | Not verified |
| 5 | **CI runs tests only.** `.github/workflows/ci.yml` runs pytest, Vitest, `tsc -b`/build and Playwright on push/PR; there is no coverage gate, no dependency or secret scanning, no PostgreSQL service and no deployment job. | Partial |
| 6 | **No coverage measurement.** No coverage tool or threshold configured; no percentage is claimed anywhere. | Not implemented |
| 7 | **No observability backend.** No metrics, tracing, APM, dashboards or alerts; only structured stdout logs and `/health`. | Not implemented |
| 8 | **No backup automation.** The docs describe `pg_dump`; nothing schedules it. | Not implemented |
| 9 | **No container image scanning** or dependency-vulnerability gate. | Not implemented |
| 10 | **TLS is not configured.** Containers serve HTTP; termination is a documented operator responsibility. | Not implemented |

---

## 3. AI limitations

1. **No evaluation harness** — no golden set, rubric, LLM-as-judge or prompt regression
   test. Prompt changes are unmeasured.
2. **Model output is parse-and-check, not schema-validated by Pydantic.** Unknown keys
   are ignored, so a partially malformed response silently degrades.
3. **Citations are assembled, not verified.** The answer's own `[n]` markers are never
   checked against the citation list.
4. **Prompt injection is mitigated, not solved.** Text-only defences: guardrail system
   instruction, delimiter sanitisation, JSON-only output. No output-side detector, no
   domain allow-list.
5. **The model cannot improve substance** — it cannot add a finding, raise a severity or
   propose a metric. Quality is bounded by the deterministic engine.
6. **Character-based truncation** (600–900 chars per record) rather than token budgets;
   no token accounting, cost tracking or rate-limit awareness from the provider side.
7. **Synchronous calls** — no streaming; a slow model delays the HTTP response or the
   running stage.
8. **Demo mode never calls the model**, so the AI path cannot be demonstrated from the
   seeded workspace.
9. **Single provider.** Gemini only; the abstraction exists but no second vendor is
   implemented.
10. **Competitor suggestions cannot fall back** — without a model the endpoint returns
    `409`; on model failure, `502`.

---

## 4. Research data limitations

- Public reviews and forum posts are **self-selected**; the corpus is not a
  representative sample of any customer base. The report states this in its limitations.
- **Complaint volume is not revenue impact.** No churn, ARR, sales or support-ticket data
  is ingested or modelled.
- **Source coverage is provider-dependent**: whatever the search API returns for the
  generated queries, capped at 14 queries / 44 records per run.
- **Date coverage is not filtered by the configured research period** at ingestion: the
  study window is recorded in the configuration and printed in the report, but records
  are not dropped for falling outside it. This is a real gap between the brief and the
  data.
- **No language coverage beyond English**; non-English sources would be classified by
  English keywords and produce empty topics.
- **Demo data is synthetic** — a fictional company and competitors; URLs point at
  `demo.marketpulse.ai`, which does not publish those articles.
- **Contradictions are topic-level** (≥ 2 negative and ≥ 2 positive records), not
  claim-level.

---

## 5. Scalability limitations

| Limit | Cause | Symptom beyond the current scale |
| --- | --- | --- |
| Ingest is O(n²) | pairwise shingle Jaccard + pairwise corroboration | run time grows quadratically if the evidence cap rises |
| Aggregation in Python | analytics/graph/customer-voice load all rows | per-page-view latency grows linearly with project size |
| Evidence search in Python | substring scan per request | large projects make the evidence centre slow |
| Sequential provider calls | one search at a time | deep runs dominated by provider latency |
| 3-thread inline runner | `ThreadPoolExecutor(max_workers=3)` | multiple concurrent deep runs contend for CPU |
| Per-process rate limiter | in-memory `deque` | limits multiply with instances |
| No caching of derived views or LLM answers | recomputed per request | repeated views repeat work |
| No virtualised lists | full render of 100-row pages | heavy DOM on the evidence surface |
| No pagination outside `/evidence` | whole collections returned | project list / findings grow unbounded per response |

No benchmark supports a specific concurrency number; see
[`PERFORMANCE.md`](PERFORMANCE.md) §11 for how to measure before optimising.

---

## 6. Security improvements (highest value first)

| Priority | Improvement | Why |
| --- | --- | --- |
| 1 | Require a non-default `SECRET_KEY` at startup (refuse to boot in production) | The app currently starts happily with a public default |
| 2 | Rotate any provider keys that have ever been committed; purge from history | A template file shipped with live-looking keys (now blanked) |
| 3 | Rate-limit and lock out repeated failed logins | Auth endpoints are unmetered and there is no lockout |
| 4 | Move the token out of `localStorage` (httpOnly cookie or short-lived token + refresh) and add revocation | XSS-reachable; 7-day tokens cannot be invalidated |
| 5 | Add CSP, HSTS and a Permissions-Policy at the edge | Only nosniff/referrer/XFO are set today |
| 6 | Enforce TLS and database `sslmode` in the deployment procedure | Containers serve plain HTTP |
| 7 | Add dependency and secret scanning to CI | No scanning exists |
| 8 | Audit-log authentication and project deletion events | No security audit trail |
| 9 | Redis-backed distributed rate limiter | Correct budgets across instances |
| 10 | Verify model citations against the retrieved set | Closes the "assembled, not verified" gap |

Full threat model: [`SECURITY.md`](SECURITY.md) §15.

---

## 7. Planned enhancements (not implemented)

### Near term — quality of the evidence

1. **Page fetching and extraction**: retrieve URLs, strip boilerplate, keep the passage
   that answers the query, record rejections with reasons.
2. **Real source validation**: URL scheme/host checks, canonicalisation, publication-date
   sanity, minimum length, and a persisted rejection table.
3. **Filter by research period** at ingestion, not just in the report text.
4. **Persist duplicates** with `duplicate_of` and expose a merge/review action.
5. **Domain-aware extraction** (rating tables, competitor pricing blocks) so
   `pricing_summary` can be filled from evidence.

### Near term — engineering hygiene

6. **Extend CI**: coverage reporting with a floor, `npm audit`/`pip-audit` and
   ESLint/Ruff gates on top of the existing workflow.
7. **PostgreSQL migration verification** in CI (service container) and a second Alembic
   revision to prove the workflow.
8. **Startup reconciler** marking stale `running` projects as `failed` with a reason.
9. **Failure notifications** so a failed run reaches the bell like a success does.
10. **Remove or wire the inert settings** (`RESEARCH_MAX_QUERIES`, `MAX_UPLOAD_BYTES`)
    and the vestigial `created_at_index` column.

### Medium term — retrieval and analysis

11. **Embedding provider abstraction** with a deterministic default and an optional
    hosted model; `pgvector` column + HNSW index behind the existing `retrieve()`
    seam; keep citations and the retrieval trace unchanged.
12. **Trained sentiment option** alongside `lexicon-v1` (stored per record via
    `sentiment_records.provider`), with an offline comparison report.
13. **Claim-level contradiction detection** instead of topic-level grouping.
14. **Multi-language support** (lexicons, stop words, prompts).
15. **Parallel stage execution** for independent analysis stages (needs a DAG, not the
    linear runner).

### Medium term — operations and scale

16. **Materialised analytics/graph snapshots** keyed by report version.
17. **Scheduled monitoring** via Celery beat with idempotent run keys (the
    `monitoring.tick` task exists; no schedule does).
18. **Metrics and tracing** (OpenTelemetry + Prometheus endpoint), plus alerting on run
    failure rate and provider latency.
19. **Server-side evidence search** (`tsvector`/trigram) and composite indexes.
20. **Real PDF generation** for reports (server-side), with the printable HTML kept as
    a fallback.

### Longer term — product

21. **Team workspaces** with roles and project sharing (changes the tenancy model, so it
    needs its own ADR).
22. **Bring-your-own-source uploads** (CSV of reviews, support exports) with the same
    evidence contract — this is where `MAX_UPLOAD_BYTES` would finally matter.
23. **Alerting on tracked topics** ("tell me when reliability complaints double").

---

## 8. What will *not* be claimed

For the avoidance of doubt, this project does not and should not claim:

- production readiness, high availability or horizontal scale;
- semantic/vector search, RAG over embeddings served by a vector database;
- a trained classifier or measured model accuracy;
- financial forecasting, revenue impact or ROI modelling;
- full-page web scraping, robots compliance or content licensing;
- penetration testing, a security audit or compliance certification;
- benchmarked latency, throughput or cost figures.

---

## Related documents

- Why the current choices were made: [`decisions/`](decisions/)
- What is verified: [`DEPLOYMENT.md`](DEPLOYMENT.md) §9, [`TESTING.md`](TESTING.md)
- Performance work items with measurement plans: [`PERFORMANCE.md`](PERFORMANCE.md) §11–12
- Security gaps and priorities: [`SECURITY.md`](SECURITY.md) §16
