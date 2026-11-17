# Performance and scalability

> **No benchmark numbers are reported in this document because none were measured.**
> There is no load-testing harness, no APM, no query timing instrumentation and no
> stored baseline in the repository. Everything below is a cost analysis derived from
> reading the code, plus clearly-labelled proposals for how to measure it.

---

## 1. Workload character

MarketPulse AI is an **analyst-driven, low-QPS, write-heavy-then-read** application:

| Workload | Shape |
| --- | --- |
| Research run | Bursty and CPU-bound in Python; produces tens to low hundreds of rows; seconds to tens of seconds |
| Analysis reads | Low frequency, "many rows per request" (aggregations over all of a project's evidence) |
| Assistant | Low frequency; O(records) scan per question |
| Dashboard / lists | Frequent, small, cheap |
| Ingestion | Super-linear in record count (pairwise similarity) |

Concurrency expectation: a handful of analysts, one or two runs at a time. The design
optimises for that, not for thousands of concurrent users.

---

## 2. Database access patterns

| Operation | Queries | Cost driver |
| --- | --- | --- |
| `GET /projects` | 1 + joined company | rows per user |
| `GET /projects/{id}` | ~5 (project + config + tasks + sources + competitors) | stages and competitors |
| `GET .../evidence` | 2 + 1 finding-map pass | **all** records of the project loaded, filtered in Python, then sliced for the page |
| `GET .../analytics` | 5 collections | all records, all clusters, all findings; aggregation in Python |
| `GET .../graph` | 5 collections | findings + opportunities + clusters + competitors + relationships |
| `GET .../graph/node/{id}/evidence` | 1–2 | for `topic:` nodes, a full record scan with substring match |
| `GET .../report` | 1 | single row (JSON payload can be large) |
| `POST .../chat` | all records + 3 collections | O(records) cosine scoring in Python |
| `GET /dashboard` | 1 list + 3 point queries **per completed project** | small N, but a per-project loop |
| `POST .../run` | heavy write path | see §5 |

**Observation:** reads are implemented as "load the project's rows, aggregate in
Python". That is simple, portable (SQLite + PostgreSQL), unit-testable and precise —
and it is the main scalability limit. The database does the filtering it is indexed
for (project scope, status, severity); it does not do the text search, the JSON array
filtering or the chart aggregation.

---

## 3. Query optimisation and indexing

Implemented:

- Indexes on every ownership and scoping column (`user_id`, `project_id`) plus
  `status`, `is_demo`, `severity`, `source_category`, `country`, `sentiment`,
  `published_at` (see [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) §8).
- PostgreSQL connection pool: `pool_size=10`, `max_overflow=20`,
  `pool_recycle=1800`, `pool_pre_ping=True` — reused across requests, avoids
  reconnect cost after idle periods (relevant on free tiers that drop idle
  connections).
- `expire_on_commit=False`, so serialising after `commit()` does not trigger a reload.
- `ResearchProject.company` uses `lazy="joined"`, avoiding an N+1 on project lists.
- Pagination on the one table that grows without bound per project (evidence).
- `select(Model.id)` (not full entities) in the dashboard counting loops.

Not implemented:

- Server-side text search (`ILIKE`, `tsvector`, trigram) — evidence search is a Python
  substring scan.
- Composite indexes such as `(project_id, published_at DESC)` for the evidence
  ordering, or `(project_id, severity)` on `failure_findings`.
- JSON-path indexing (`topics`, `evidence_ids`) — no GIN indexes exist.
- `EXPLAIN`-driven tuning, `pg_stat_statements`, slow-query logging.
- Keyset pagination (evidence uses `LIMIT/OFFSET` semantics via slicing).
- Eager loading for `research_tasks`, `competitors` and `sources` on the detail route.

---

## 4. Caching

| Layer | Status |
| --- | --- |
| Server-side response cache | **none** |
| Redis cache | **none** — Redis is only a Celery broker in the Compose profile |
| Derived-view snapshots (analytics/graph) | **none** — recomputed per request |
| Report artefact | effectively cached: a report is a stored row and is only rebuilt on demand or in a run |
| Client cache | TanStack Query; per-hook `staleTime`, `refetchInterval` 1500 ms while a run is active, `staleTime: Infinity` for `/meta/catalog` |
| Static assets | nginx: 7-day cache for hashed files, gzip for text, HTML uncached |
| LLM responses | **not cached** — the same question costs another call |

The absence of server-side caching is a deliberate trade: aggregates must never be
stale relative to evidence, and a cache would need invalidation on every ingest.
Snapshots keyed by report version are the natural first step (§12).

---

## 5. Research pipeline cost model

Per run, with `N` records ingested, `T` topics (11) and `S` stages:

| Phase | Complexity | Notes |
| --- | --- | --- |
| Query generation | O(Q) | Q ≤ 14 |
| Discovery (live) | O(Q) HTTP calls | 6 results per query, provider latency dominates |
| Ingestion | **O(N²)** pairwise shingle comparison | plus O(N) embedding and sentiment |
| Corroboration | **O(N²)** pairwise comparison | second quadratic pass over the project |
| Contradiction flagging | O(N × T) | |
| Topic clustering | O(N × T) | recreates all clusters per run |
| Failures | O(N × T) | |
| Opportunities | O(N) + O(competitors × N) mention matching | substring scans |
| Competitors | O(C × N) | substring scans per competitor |
| Relationships | O(F × C × E) in the worst case | competitor × failure × evidence-id membership |
| Report | O(N) + section assembly | |
| **Total** | dominated by O(N²) at ingest for large N | acceptable at the current scale |

With the mode caps (`evidence_target` 14 / 32 / 44) the quadratic term is bounded —
44 records means ~1,900 shingle comparisons, which is negligible. The cap is what keeps
the design viable; it would need to change before the corpus per project grows by an
order of magnitude.

Additional per-stage overhead: `time.sleep(0.12)` in demo mode only, to keep stage
transitions legible in the UI. It is not present in live runs and is not a work
simulation.

---

## 6. Background processing

| Aspect | Inline | Celery |
| --- | --- | --- |
| Throughput | 3 concurrent runs per API process | 2 concurrent tasks per worker container, horizontally scalable |
| Latency to first stage | immediate (thread) | broker round trip |
| Durability | in-flight run lost on restart; project can stay `running` with no reconciler | task survives API restart (worker must stay up) |
| Blocking risk | the orchestrator is sync; run work happens in threads, so the event loop is not blocked, but CPU is shared with request handling | isolated from request path |
| Scheduling | none | `monitoring.tick` exists, **no beat schedule configured** |

For a single analyst doing one run at a time, the inline runner is not a bottleneck.
For several concurrent deep runs on a small container, CPU contention is the limit —
Celery with a dedicated worker is the correct response, not more threads.

---

## 7. External API latency

| Call | Timeout | Retry | Impact |
| --- | --- | --- | --- |
| Tavily / Brave search | 25 s | none | serial per query; Q searches gate the discovery stage |
| Gemini `generateContent` | 60 s | 2 attempts on 429/5xx | assistant/simulation block the HTTP response; report enrichment blocks the run |
| PostgreSQL | driver default | connection pool | — |

Searches are issued **sequentially** inside `_discover_and_collect`. A deep run issues
up to 14 searches, so provider latency multiplies by Q in the worst case. Parallelising
with a bounded thread pool is the obvious improvement (§12) and is not implemented.

---

## 8. Frontend rendering

| Decision | Effect |
| --- | --- |
| Route-level `React.lazy` for all 11 analysis surfaces | initial bundle excludes analysis code |
| One `EChart` wrapper with `dispose()` on unmount | no leaked chart instances when switching tabs |
| TanStack Query dedupe + `staleTime` | navigating between analysis tabs does not refetch resolved data |
| `AnalysisLayout` loads project/status once and shares via outlet context | avoids duplicate requests per child page |
| `refetchInterval` disabled unless a run is active | no background polling at rest |
| `chunkSizeWarningLimit: 1200`, `sourcemap: false` | build output split by route; no source maps shipped |
| Evidence list pagination (25 default, 100 max) | bounded DOM size per page |
| **No virtualisation** | a 100-row evidence page renders fully; a very long report page renders every section |
| ECharts initialises on mount | first paint of the analytics page waits for the API response (loading state shown) |

No bundle size, Lighthouse score, LCP/INP measurement or memory profile exists in the
repository — treat any such figure as unverified unless it is produced by the
methodology in §11.

---

## 9. Large reports and exports

- A report is a single JSON document; the 20 most recent records are embedded in the
  `references` section and up to 40 IDs in `reference_ids`. Payload size therefore
  grows with evidence text length, not with record count beyond those caps.
- `GET /report/export` builds an HTML string in memory and returns it as
  `text/html` for printing — no headless browser, no PDF library, no temporary files.
- `GET /roadmap/export` builds Markdown the same way.
- The frontend prints via the browser (`Print / Save as PDF`); very large reports are
  therefore limited by the browser's pagination, not by the server.
- No streaming response is used, so the full document is materialised before the
  first byte.

---

## 10. Current bottlenecks (ranked)

1. **Ingest is quadratic in project size.** Fine at ≤ 44 records; the first thing to
   break if the evidence cap rises or imports are added.
2. **All aggregation happens in Python per request.** `analytics`, `graph` and
   `customer-voice` load every record of a project. At 47 records this is trivial; at
   5,000 it would be visible per page view.
3. **Sequential external calls.** 14 searches × provider latency defines the deep-run
   duration far more than local compute.
4. **`GET /evidence` filters in Python.** With `page_size` capping the response, the
   cost is in loading and filtering all rows to compute `total` and facets.
5. **Dashboard per-project counting loop.** 3 small queries per completed project; a
   problem only for users with many projects.
6. **No caching of derived views or LLM answers.** Repeated page views repeat work.
7. **In-process rate limiter and thread pool.** Both are per process; scaling out
   means each instance has its own budget and its own 3 worker slots.

---

## 11. Proposed measurement plan (future work, nothing implemented)

| What | How | Why it matters |
| --- | --- | --- |
| Ingest cost | time `ingest()` for N = 50 / 250 / 1,000 synthetic records | Confirms the quadratic term and the point where indexing becomes necessary |
| Endpoint latency | `pytest-benchmark` or `locust` against `/analytics`, `/evidence`, `/chat`, `/graph` with 0.1k / 1k / 5k records | Establishes the real cost of Python-side aggregation |
| SQL timing | enable `pg_stat_statements`, log `EXPLAIN (ANALYZE, BUFFERS)` for the five heaviest endpoints | Decides whether composite indexes or query rewrites pay |
| Provider latency | record wall time per `search()` call in `research_tasks.detail` | Distinguishes our compute from provider wait |
| Run duration | derive from already-stored `started_at`/`finished_at` in `research_tasks` | Free baseline — the ledger already holds the data, it just is not aggregated |
| Frontend | Lighthouse + Web Vitals on the dashboard/analytics routes, bundle analysis of `vite build` | Current frontend claims are qualitative only |
| Load | concurrent runs on a 1 vCPU container, inline vs Celery | Validates the runner trade-off |

Until these exist, no speedup may be claimed for any change.

---

## 12. Realistic improvements (planned, not implemented)

| Priority | Change | Rationale |
| --- | --- | --- |
| 1 | Blocking-based or LSH dedupe instead of full pairwise comparison | Removes the only super-linear term in the hot path |
| 2 | Persist analytics/graph snapshots keyed by report version, refresh on ingest | Turns per-request aggregation into a read |
| 3 | Parallelise provider searches with a bounded pool (e.g. 4 workers) | Deep runs are dominated by serial provider latency |
| 4 | Server-side evidence search (`tsvector` or trigram) + composite index `(project_id, published_at DESC)` | Pushes filtering and ordering into the database |
| 5 | Cache LLM answers per (project, question hash) with an explicit invalidation on new ingest | Saves quota and latency for repeated questions |
| 6 | Redis-backed rate limiter and a proper distributed counter | Correct budgets once more than one API instance runs |
| 7 | Streaming or chunked report export for very large projects | Avoids materialising the document |
| 8 | Connection-pool and worker tuning per host size (documented, not guessed) | Free-tier instances need smaller pools |
| 9 | Virtualise long evidence lists in the UI | Keeps 100-row pages cheap |
| 10 | Add cache headers for immutable assets and `ETag`/`If-None-Match` for reports | Bandwidth, not CPU |

---

## Related documents

- Where the cost comes from: [`RESEARCH_PIPELINE.md`](RESEARCH_PIPELINE.md) §7
- Index inventory: [`DATABASE_DESIGN.md`](DATABASE_DESIGN.md) §8
- Runner trade-offs: [`ARCHITECTURE.md`](ARCHITECTURE.md) §10 · [`DEPLOYMENT.md`](DEPLOYMENT.md) §8
- Measurements to run before optimising: §11 above
