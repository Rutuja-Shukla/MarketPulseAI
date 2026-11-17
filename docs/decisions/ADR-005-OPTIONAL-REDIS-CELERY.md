# ADR-005 — Optional Redis/Celery with an inline runner as the default

| | |
| --- | --- |
| Status | Accepted (implemented) |
| Date | Recorded retrospectively |
| Related | [ADR-006](ADR-006-RESEARCH-PROCESSING-STRATEGY.md), [ADR-001](ADR-001-FASTAPI-BACKEND.md) |

## Basis

Derived from `core/config.py` (`job_runner`, `redis_url`), `workers/jobs.py`
(`enqueue_analysis`, `ThreadPoolExecutor(max_workers=3)`), `workers/celery_app.py`,
`docker-compose.yml` (`JOB_RUNNER: celery` for backend and worker, `redis:7-alpine`)
and the README quick start (no Docker required). Rationale is inferred.

## Context

A research run is long relative to an HTTP request: cheap local work plus up to 14
sequential search calls and an optional model call. `POST /projects/{id}/run` must
return immediately (202) and the UI must be able to poll progress. The project also has
to be runnable by a reviewer with no infrastructure, and deployed by its author without
paying for a queue.

Two constraints pull in opposite directions:

- correctness/durability wants an out-of-process queue with retries and restart
  survival;
- cost/simplicity wants `docker compose up` (or `uvicorn`) to be sufficient.

## Problem

How should background research execution be dispatched so that the product works
without Redis, yet can use a real queue when one is available?

## Decision

Make job execution **pluggable behind one function**, with an in-process default:

```python
def enqueue_analysis(project_id, demo) -> str:      # returns "celery" | "inline"
    if settings.job_runner == "celery":
        try:
            celery_app.send_task("research.run_project", args=[str(project_id), demo])
            return "celery"
        except Exception:
            logger.warning("celery_dispatch_failed", ...)      # fall through
    _executor.submit(run_project_analysis, project_id, demo)
    return "inline"
```

- Both paths call the **same** entry point (`run_project_analysis` →
  `ResearchOrchestrator.run()`), so behaviour is identical.
- `JOB_RUNNER` defaults to `inline`; the Compose stack sets `celery` for both the API
  and the worker service.
- A Celery dispatch failure degrades to the inline pool rather than losing the job.
- Progress is persisted per stage in `research_tasks`; the client polls
  `GET /projects/{id}/status`. No websocket, no result backend read in the API.

## Alternatives considered

| Alternative | Why it was not chosen |
| --- | --- |
| Celery required | Breaks the "clone and run" story and makes Redis a hard dependency of a demo. |
| FastAPI `BackgroundTasks` | Tied to the request lifecycle and single-process; no concurrency limit, no retry, no visibility; worse than an explicit executor. |
| `asyncio.create_task` | Long CPU-bound work on the event loop; would require rewriting the pipeline as async for no gain. |
| RQ / Dramatiq / arq | Equivalent role to Celery; Celery is the most familiar and integrates with the existing Compose shape. |
| Cloud queue (SQS/Cloud Tasks) | Vendor lock-in and credentials for an optional feature; contradicts the no-account default. |
| Synchronous run inside the request | 202/polling UX disappears; request timeouts on deep runs; provider latency would block workers. |
| Dedicated always-on worker only | Doubles the deployment cost of a demo app whose runs are user-triggered. |

## Advantages

- Zero-dependency default: `uvicorn app.main:app` produces a fully working product.
- One dispatch seam; the orchestrator has no knowledge of the runner.
- Graceful degradation: a misconfigured broker weakens durability, not correctness.
- Observable either way, because progress lives in the database rather than in the
  runner.
- Compose demonstrates the production-grade path (worker container, Redis AOF, health
  gating) without forcing it on every environment.

## Disadvantages

- **Durability gap in the default mode:** an API restart loses in-flight runs. There is
  no reconciler that marks `running` projects as failed, so a project can remain
  `running` indefinitely after a crash.
- Concurrency is capped at 3 threads per API process; several deep runs compete with
  request handling for CPU.
- `celery` dispatch is fire-and-forget: no task id is stored, no retry policy, no
  dead-letter handling, and `task_track_started` results are not surfaced in the API.
- Two execution modes mean two operational behaviours to document and test — and only
  the inline mode is exercised by the test suite.
- The rate limiter is also per process, so scaling out multiplies both worker slots and
  budgets.

## Trade-offs

| Gained | Given up |
| --- | --- |
| Runs anywhere with no queue | Restart durability and independent scaling by default |
| Identical pipeline for both runners | Queue features (retries, priorities, routing, DLQ) |
| Cheap single-container deployment | Horizontal scale-out without extra configuration |

## Consequences

- A deployment that runs multiple API replicas **must** either set
  `JOB_RUNNER=celery` with a worker, or accept per-replica concurrency and per-replica
  rate limits.
- Failure visibility relies on the stage ledger; that is why every stage writes a row
  and why the UI shows a stage list instead of a spinner.
- `monitoring.tick` exists as a Celery task but has no beat schedule, so scheduling is
  not automated in either mode (documented in
  [`../DEPLOYMENT.md`](../DEPLOYMENT.md) §8 and
  [`../LIMITATIONS_AND_ROADMAP.md`](../LIMITATIONS_AND_ROADMAP.md)).
- If durability becomes a requirement, the correct next step is Celery with a stored
  task id, retry policy and a startup reconciler — not a larger thread pool.
