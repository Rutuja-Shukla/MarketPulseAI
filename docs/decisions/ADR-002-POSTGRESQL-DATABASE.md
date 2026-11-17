# ADR-002 — PostgreSQL as the target database (SQLite for development and tests)

| | |
| --- | --- |
| Status | Accepted (implemented) |
| Date | Recorded retrospectively |
| Related | [ADR-003](ADR-003-SQLALCHEMY-AND-ALEMBIC.md), [ADR-001](ADR-001-FASTAPI-BACKEND.md) |

## Basis

Derived from `docker-compose.yml` (`pgvector/pgvector:pg16`),
`backend/app/db/session.py`, `models/base.py` (`JSONType`, `Uuid`) and
`infrastructure/docker/postgres-init.sql`. Rationale not recorded at the time is
marked **inferred**.

## Context

The persistence layer must store:

- relational structure with clear ownership (users → companies → projects → findings);
- semi-structured payloads (topics, evidence-id lists, report sections, retrieval
  traces);
- UUID identifiers exposed in URLs;
- timezone-aware timestamps;
- text of moderate length (evidence excerpts, report bodies);
- a per-record numeric embedding vector (96 floats) for lexical retrieval.

The project must also be runnable by a reviewer with no cloud account and no Docker
daemon, and tests must run fast and isolated.

## Problem

Which database engine should the deployed configuration target, and should
development/tests use the same engine?

## Decision

**PostgreSQL 16** is the deployed target (Compose uses the `pgvector/pgvector:pg16`
image and enables the `vector` + `uuid-ossp` extensions on init). **SQLite** is the
default for local development and tests, with the same SQLAlchemy metadata, using:

```python
JSONType = JSON().with_variant(JSONB, "postgresql")
id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
```

SQLite connections set `PRAGMA foreign_keys=ON` and `journal_mode=WAL` so cascade and
concurrency behaviour are closer to PostgreSQL than the SQLite defaults.

## Alternatives considered

| Alternative | Why it was not chosen |
| --- | --- |
| PostgreSQL only (no SQLite) | Every reviewer and every test run would require a running server; `git clone` → run would stop being true. |
| SQLite only | No concurrent writers, weak JSON support, no real production story, no path to `pgvector`. |
| MySQL/MariaDB | No advantage here; JSON support and UUID handling are weaker, and the pgvector option disappears. |
| Document store (MongoDB) | The domain is relational (ownership, cascade, joins for project scoping); JSON columns already cover the document-shaped parts. |
| Vector database (Pinecone/Qdrant) | Adds an external service for a retrieval step that is currently lexical and deterministic; see ADR-004 and the AI doc. |

## Advantages

- Relational integrity with real foreign keys and cascade rules for a deeply nested
  aggregate.
- `JSONB` gives indexed-ready semi-structured storage where needed, while typed columns
  remain the norm.
- Native `uuid` and `timestamptz`, matching the API's UUID contract.
- Managed PostgreSQL is available on every relevant host; it is the least exotic
  production dependency possible.
- SQLite keeps the project runnable anywhere and makes tests fast and independent (each
  test session gets its own throwaway database file or `:memory:` engine).
- `with_variant` means one model set, one migration script, no dialect-specific code in
  services.

## Disadvantages

- **Two dialects means two behaviours.** Anything relying on PostgreSQL-specific SQL
  cannot be tested locally, and CI runs on SQLite only, so PostgreSQL DDL is unverified
  in this environment.
- SQLite's JSON type has no operators, so no query can use JSON containment — array
  filtering happens in Python (a performance consequence documented in
  [`../PERFORMANCE.md`](../PERFORMANCE.md)).
- The `pgvector` extension is enabled but unused: there is no `vector` column, so the
  image choice currently buys only future optionality. This is a small, honest
  inconsistency.
- Tangible-but-unmeasured risk: `batch_alter_table` DDL, `NULLS LAST` ordering and
  timezone handling can differ subtly between the two engines.

## Trade-offs

| Gained | Given up |
| --- | --- |
| Zero-setup local run and fast tests | Guaranteed parity between test and production engines |
| Portable schema via SQLAlchemy types | Dialect-specific optimisation (partial indexes, GIN, `vector`) |
| Simple single-container deployment (SQLite) | Concurrent write throughput in that mode |

## Consequences

- Schema changes must be expressed portably (no `ALTER … USING`, no dialect-only
  defaults) or guarded by dialect checks.
- PostgreSQL-specific DDL and the migration must be validated on a real PostgreSQL
  instance before any production claim — this is listed as an open item in
  [`../DEPLOYMENT.md`](../DEPLOYMENT.md) §9 and
  [`../LIMITATIONS_AND_ROADMAP.md`](../LIMITATIONS_AND_ROADMAP.md).
- Retrieval cannot be pushed into SQL today; if it moves to `pgvector`, this ADR's
  "unused extension" note becomes the seed of that change.
- SQLite is explicitly a development convenience, not a production recommendation.
