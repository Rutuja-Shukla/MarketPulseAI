# ADR-001 — FastAPI as the backend framework

| | |
| --- | --- |
| Status | Accepted (implemented) |
| Date | Recorded retrospectively — see "Basis" |
| Deciders | Project author |
| Related | [ADR-002](ADR-002-POSTGRESQL-DATABASE.md), [ADR-003](ADR-003-SQLALCHEMY-AND-ALEMBIC.md), [ADR-004](ADR-004-DETERMINISTIC-ANALYSIS-AND-LLM-ENRICHMENT.md) |

## Basis

This ADR was written after the fact, from the code that exists
(`backend/app/main.py`, `app/api/*`, `app/schemas/*`). The *decision* is evidenced;
the *discussion that produced it* is not recorded anywhere, so rationale marked
**inferred** is a reconstruction from architectural consequences, not a historical
quotation.

## Context

MarketPulse AI needs one HTTP service that:

- exposes ~30 JSON endpoints across auth, projects, analysis, outputs and operations;
- owns all business logic and persistence (no separate worker service is required to
  run the product);
- validates a large, nested research brief (company, market, situation, objectives,
  assumptions, competitors, configuration);
- talks to optional third-party HTTP APIs (Tavily, Brave, Gemini);
- runs synchronously with SQLAlchemy sessions, and can also dispatch background jobs;
- is small enough that one person maintains it, and legible enough that a reviewer can
  read the whole API surface quickly.

## Problem

Choose a Python HTTP framework and API contract mechanism that gives strong request
validation, generated documentation, and a small amount of glue code — without a
heavyweight framework or an extra schema layer (GraphQL/protobuf) to maintain.

## Decision

Use **FastAPI** with **Pydantic v2** models as the single contract layer, mounted under
`/api`, with:

- one `APIRouter` per domain (`routes_auth`, `routes_projects`, `routes_analysis`,
  `routes_outputs`, `routes_ops`) composed in `api/router.py`;
- dependencies (`get_db`, `get_current_user`, `get_project`) for cross-cutting
  concerns instead of middleware or decorators;
- explicit `response_model` on routes so `/openapi.json` is the authoritative
  contract;
- exception handlers mapping validation errors to a field-level `422` envelope;
- a synchronous SQLAlchemy session per request (no async ORM), and a thread-pool job
  runner for background work.

## Alternatives considered

| Alternative | Why it was not chosen |
| --- | --- |
| Django + DRF | Batteries included, but brings an admin, template engine, settings layout and ORM conventions that this project does not need; the explicit Pydantic contract would be replaced by serializers with more boilerplate for a 30-endpoint API. |
| Flask + Marshmallow | Workable, but OpenAPI generation, dependency injection and validation would be assembled from several extensions; FastAPI ships those in the framework. |
| Litestar | Comparable feature set; smaller ecosystem, and no benefit for this scope. |
| GraphQL | The UI reads whole, well-defined aggregates per page; GraphQL would add schema/resolver/authorisation complexity for no query-shape benefit. |
| Node/Express or NestJS | Would split the language boundary from the Python analysis engine (lexicon, hashing embeddings, report builder), requiring a second runtime or a port. |
| Async SQLAlchemy + asyncpg | The workload is CPU-bound in Python (analysis) and low-QPS; async ORM adds session-management complexity without removing the CPU cost. |

## Advantages

- Request/response validation and OpenAPI are generated from the same Pydantic models
  used at runtime — one source of truth, no drift between docs and code.
- Dependency injection makes ownership enforcement a single declaration
  (`Depends(get_project)`), which is why IDOR resistance is uniform across ~25 project
  routes.
- Synchronous handlers match the synchronous analysis code and SQLAlchemy 2 style;
  blocking work is pushed to a thread pool instead of infecting every function with
  `async`.
- Small framework surface: `main.py` is 142 lines including middleware, handlers and
  the health check.
- Fast local iteration: `uvicorn --reload` plus `/docs` makes manual API verification
  cheap.

## Disadvantages

- Synchronous ORM + CPU-bound services mean request latency is tied to Python compute;
  a heavy aggregation blocks its thread (mitigated, not eliminated, by the thread pool
  and by the fact that aggregations are small at current scale).
- No built-in pagination, filtering, caching or rate limiting — each had to be written
  by hand, and only evidence got real pagination.
- No admin/scaffolding: every operational action is a code change.
- Field-level validation messages are FastAPI's shape; the frontend has to know the
  `{detail, errors[]}` envelope rather than a standard problem+json document.
- Background jobs needed a bespoke runner (see ADR-005) because the framework has no
  task system.

## Trade-offs

| Gained | Given up |
| --- | --- |
| Type-safe contracts and generated docs | Async I/O throughout; the pipeline is sync by design |
| Uniform dependency-based authorisation | A framework that provides admin, auth, permissions, caching out of the box |
| Minimal glue code | A conventional "batteries" structure that large teams already know |

## Consequences

- Every new endpoint is: schema → route → service → serializer. Business logic in a
  route is a review finding.
- The OpenAPI schema is generated, so API documentation can be checked against it
  (`docs/API_DOCUMENTATION.md` was written that way).
- Because there is no auth framework, security is explicit and small: PBKDF2 + HS256
  JWT + ownership dependency (documented in [`../SECURITY.md`](../SECURITY.md)).
- Because there is no task framework, `JOB_RUNNER` with an inline default and an
  optional Celery path exists (ADR-005).
- Because there is no built-in pagination, unbounded collections remain a known
  performance limitation ([`../PERFORMANCE.md`](../PERFORMANCE.md) §3).
