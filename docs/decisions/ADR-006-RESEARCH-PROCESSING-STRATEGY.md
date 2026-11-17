# ADR-006 — Staged, persisted research processing with mode profiles

| | |
| --- | --- |
| Status | Accepted (implemented) |
| Date | Recorded retrospectively |
| Related | [ADR-004](ADR-004-DETERMINISTIC-ANALYSIS-AND-LLM-ENRICHMENT.md), [ADR-005](ADR-005-OPTIONAL-REDIS-CELERY.md) |

## Basis

Derived from `research/taxonomy.py` (`MODE_PROFILES`, `STAGE_LABELS`),
`services/orchestrator.py` (`prepare`, `run`, `_stage_*`, `_finalise`),
`models/research.py` (`ResearchTask`) and `api/routes_projects.py`
(`/run`, `/status`). Rationale is inferred from the observable structure.

## Context

A research run is not one computation: it collects, normalises, classifies, aggregates
and writes a document. Different questions need different depth (a directional read vs
a defensible assessment), and runs can take long enough that the user needs to see
what is happening and to diagnose failures without server log access. The quality of the
output depends on the brief (market scope, objectives, source categories), which must be
captured before any collection starts.

## Problem

How should the work be decomposed, ordered and exposed so that (a) partial failure is
explainable, (b) depth is configurable without duplicating pipeline code, and (c) the UI
can display honest progress?

## Decision

Use a **linear pipeline of named stages**, driven by a per-mode stage list, with a
**persisted task row per stage**:

1. `MODE_PROFILES` (`quick` 10 / `standard` 15 / `deep` 18 stages) defines the stage
   order, query budget, evidence target and competitor cap. It is served to the client
   by `GET /api/meta/catalog`, so the UI never hard-codes stages.
2. `prepare()` recreates one `research_tasks` row per stage (`pending`, `order_index`,
   `agent`, `name`).
3. `run()` iterates the rows, marking each `running`/`completed` with timings,
   `result_count` and a human-readable `detail`; the first exception marks that task and
   the project `failed` and stops the loop.
4. Handlers are resolved by convention (`_stage_<name>`), so a stage without a handler
   reports "Stage not implemented" instead of crashing.
5. `_finalise()` guarantees the artefacts exist (roadmap, relationships, report), sets
   `completed`, and writes a notification.
6. Progress is a persisted calculation over the ledger
   (`(completed + 0.5 × running) / total`), polled by the client every 1.5 s.

All analysis is performed in-process against the session; stages share the project
aggregate rather than messaging each other.

## Alternatives considered

| Alternative | Why it was not chosen |
| --- | --- |
| One monolithic function | No partial progress, no per-stage failure attribution, and depth would require branching inside one giant routine. |
| Event-driven stages over a queue (choreography) | Correct at scale, but adds broker choreography, idempotency keys and correlation for a linear pipeline with one consumer. |
| Dagster/Prefect/Airflow | Real orchestration, with a scheduler and metadata service to run and operate; disproportionate for one linear pipeline. |
| LLM agent loop ("let the model plan the research") | Non-deterministic cost, ordering and outputs; impossible to test; contradicts ADR-004. |
| Separate microservice per agent (`market_research`, `sentiment`, …) | The `agent` field groups work for display; splitting into services would multiply deployments for no isolation benefit. |
| In-memory progress only | Lost on restart, invisible to a second client, no audit trail. |

## Advantages

- **Failure explains itself:** the ledger names the failing stage, the message, and what
  completed before it. Partial evidence stays queryable.
- Depth is data, not code: adding a mode or reordering stages is a taxonomy change.
- The same ledger powers the UI, the API status endpoint and post-hoc diagnosis — a
  single source of truth for "what happened".
- Convention-based handlers keep the orchestrator readable (~600 lines, one method per
  stage).
- Deterministic ordering makes runs reproducible in structure even when inputs vary.

## Disadvantages

- **Linear, not a DAG.** Stages cannot run in parallel even when independent
  (e.g. competitor positioning and opportunity detection), so a deep run is the sum of
  its parts plus serial provider latency.
- Some stages are reporting-only (`deduplicate`, `evidence_validation`,
  `contradiction_analysis`): the real work happened in `ingest()`. The ledger is honest
  about counts but a reader could over-read the granularity. Documented explicitly in
  [`../RESEARCH_PIPELINE.md`](../RESEARCH_PIPELINE.md) §7.
- No resumability: a failure means a full re-run from collection
  (`prepare()` deletes the ledger).
- No retry per stage and no backoff; a transient provider error fails the run.
- Stage list must stay in sync with handlers; a mismatch is only discovered at runtime
  (mitigated by the "not implemented" fallback rather than an exception).
- Demo mode adds `sleep(0.12)` per stage purely for legibility, which lengthens demo runs
  slightly.

## Trade-offs

| Gained | Given up |
| --- | --- |
| Explainable progress and failures | Parallel stage execution and resumability |
| Simple mental model and testable ordering | DAG semantics, conditional branches, retries |
| Persisted audit trail | Storage churn: the ledger is rewritten on every run |

## Consequences

- The API contract includes a first-class status resource with stage detail, which the
  UI depends on; changing the ledger shape is a breaking UI change.
- Improving throughput means either parallelising independent stages inside one run or
  moving to a DAG — both are architectural changes, not tweaks (see
  [`../PERFORMANCE.md`](../PERFORMANCE.md) §12).
- Because progress is computed, not reported by the worker, a crashed run leaves
  `running` rows behind; a startup reconciler is the missing piece.
- Any new analytical capability must be expressible as a named stage with a persisted
  row so the product's core claim ("the pipeline shows its working") holds.
