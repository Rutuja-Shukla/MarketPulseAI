# ADR-003 — SQLAlchemy 2 typed ORM with Alembic migrations

| | |
| --- | --- |
| Status | Accepted (implemented) |
| Date | Recorded retrospectively |
| Related | [ADR-002](ADR-002-POSTGRESQL-DATABASE.md), [ADR-001](ADR-001-FASTAPI-BACKEND.md) |

## Basis

Derived from `backend/app/models/*` (typed `Mapped[...]` / `mapped_column`),
`app/db/session.py` (engine fabrication, `SessionLocal`, `get_db`, `init_db`),
`backend/migrations/env.py` and `versions/e57b23e93738_initial_schema.py`.

## Context

The domain has **22 tables** with a deep ownership graph, cascade deletes, JSON
columns, UUID keys and a strict per-user scoping rule. The team is one person. The
project must run against both SQLite and PostgreSQL (ADR-002). Every query in the API
must be scoped to an owner, so the data layer cannot be a thin string-SQL wrapper that
invites ad-hoc queries.

## Problem

Choose a persistence approach that (a) keeps schema and code in step, (b) supports
cascading deletes for the project aggregate, (c) allows JSON and UUID portability, and
(d) produces reviewable, reproducible schema changes.

## Decision

**SQLAlchemy 2.0 typed declarative ORM**, one module per domain
(`user`, `research`, `evidence`, `findings`, `reporting`, `chat`) registered by
`models/__init__.py`, with:

- `UUIDMixin` / `TimestampMixin` shared primitives;
- `JSONType = JSON().with_variant(JSONB, "postgresql")`;
- relationships with `cascade="all, delete-orphan"` for aggregate children;
- one `Session` per request via the `get_db` generator dependency;
- **Alembic** as the only schema-change mechanism for a real database, with
  `env.py` reading `DATABASE_URL` from application settings and emitting
  `batch_alter_table` DDL for portability;
- `Base.metadata.create_all` retained only as a development convenience in
  `init_db()`.

## Alternatives considered

| Alternative | Why it was not chosen |
| --- | --- |
| Raw SQL / `databases` + hand-written queries | Maximum control, but every relationship, cascade and scoping predicate would be hand-written and hand-audited; the IDOR-resistance property depends on uniform query construction. |
| SQLModel | Nice ergonomics, but it merges the API schema and the table model, which would couple the public contract to the physical schema — the project deliberately keeps `schemas/` separate from `models/`. |
| Django ORM | Requires adopting Django (ADR-001). |
| Tortoise/Peewee | Smaller ecosystems; no benefit over SQLAlchemy for sync usage. |
| `create_all` only (no migrations) | No way to evolve a deployed database; acceptable for a demo, not for a project that advertises deployment. |
| Hand-rolled migration runner | Reinvents versioning, downgrade and revision bookkeeping. |

## Advantages

- One metadata definition drives both engines and produces the Alembic revision, so
  the schema cannot silently diverge from the models in a way a reviewer cannot see.
- Typed `Mapped[...]` attributes give editor/type-checker support on every column, which
  catches several classes of mistake (wrong type, missing nullable) before runtime.
- Cascade rules live next to the relationships, so deleting a project is a single
  `db.delete(project)` with documented consequences.
- Sessions are explicit (`db: Session`), not a global; services are testable against an
  in-memory SQLite engine (`tests/test_engines.py` does exactly that).
- Alembic with settings-sourced URL means the CLI, the container command and the app
  always target the same database.

## Disadvantages

- ORM aggregation is weaker than SQL: most analytics and graph views load all rows and
  aggregate in Python, because SQLite portability discourages JSON/`GROUP BY`
  gymnastics.
- `create_all` + Alembic coexistence is a foot-gun: a developer who forgets
  `alembic upgrade head` on an existing database gets no error, only a stale schema.
- `expire_on_commit=False` (chosen to avoid reloads after commit) means stale identity
  map state is possible if a service mutates an object after commit without refresh.
- Batch-mode DDL is more verbose and can mask dialect-specific problems.
- One revision exists, so the migration history itself demonstrates nothing about
  multi-step evolution.

## Trade-offs

| Gained | Given up |
| --- | --- |
| Schema/code coherence and reviewable migrations | Aggregation pushed into SQL and database-side analytics |
| Portable models across two engines | Engine-specific features (window functions, GIN, `tsvector`, `vector`) |
| Explicit sessions and testable services | Convenience of implicit unit-of-work frameworks |

## Consequences

- New columns require a new Alembic revision; model edits alone are incomplete changes.
- Because aggregation is in Python, performance work must target service code first
  (see [`../PERFORMANCE.md`](../PERFORMANCE.md) §2).
- Because there is one revision, the next schema change is the first real test of the
  migration workflow against PostgreSQL — an explicit open item.
- The separation of `models/` (physical) and `schemas/` (contract) must be preserved:
  leaking an ORM object into a response bypasses validation and can expose columns the
  UI should never see.
