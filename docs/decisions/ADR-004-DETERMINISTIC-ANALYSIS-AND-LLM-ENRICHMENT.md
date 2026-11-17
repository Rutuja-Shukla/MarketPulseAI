# ADR-004 — Deterministic analysis core with optional LLM enrichment

| | |
| --- | --- |
| Status | Accepted (implemented) |
| Date | Recorded retrospectively |
| Related | [ADR-006](ADR-006-RESEARCH-PROCESSING-STRATEGY.md), [ADR-005](ADR-005-OPTIONAL-REDIS-CELERY.md) |

## Basis

Derived from `services/text_analysis.py`, `services/analysis_engine.py`,
`agents/llm.py`, `services/orchestrator.py` and `services/assistant.py`. The rationale
below is inferred from how the boundary is enforced in code (for example, every LLM
call site is guarded by `try_get_llm()` and every numeric field is written by Python),
not from a recorded design discussion.

## Context

The product's value proposition is *trust*: a market assessment a product leader can
defend in a meeting. Source text is noisy, contradictory and adversarial (marketing
copy, competitor pages, prompt-injection attempts). An LLM can produce fluent analysis
but also invented statistics, unstable labels between runs and unverifiable claims. A
purely hand-written analytical engine is reproducible and testable, but its prose reads
mechanically and its language understanding is shallow.

## Problem

Where is the boundary between "computed" and "generated", given that both quality and
defensibility matter and the same codebase must work with **no** API key?

## Decision

The **analysis core is deterministic**; the LLM is an **optional language layer**:

| Concern | Owner |
| --- | --- |
| Sentiment, topics, credibility, corroboration, contradictions | `text_analysis.py` lexicon/rules |
| Clusters, weaknesses, severity, confidence, opportunities, impact/effort, roadmap, graph | `analysis_engine.py` |
| Retrieval ranking and citation set | `assistant.retrieve()` (hashing embedding + cosine + topic bonus) |
| Report structure, numbers, references, limitations | `report_builder.py` |
| Wording of a summary, an assistant answer, a scenario, question proposals, competitor suggestions | Gemini — only when configured, never in demo mode |

Enforced by construction:

- every call site resolves the provider through `try_get_llm()` and keeps its
  deterministic value when `None`;
- the model is never asked for a count, score, percentage or date, and cannot write a
  stored metric;
- LLM responses are JSON-parsed, key-checked and length-capped; failures fall back;
- provider labels (`demo-dataset+heuristic-v1`, `search+heuristic-v1`,
  `gemini+template-v1`, `retrieval-v1`, `gemini-rag-v1`) record which path produced the
  text;
- `project.is_demo` disables all model calls.

## Alternatives considered

| Alternative | Why it was not chosen |
| --- | --- |
| LLM-first pipeline (model produces findings) | Not reproducible, not testable without network, invents numbers, and would make the "traceable evidence" claim false. |
| LLM with strict schemas but LLM-computed scores | Still non-deterministic and unauditable; severity would change between runs on identical evidence. |
| Deterministic only (no LLM) | Honest and cheap, but summaries/answers read mechanically and the project would not demonstrate AI engineering at all. |
| Fine-tuned classifier instead of a lexicon | Requires labelled data and a training pipeline that do not exist; a lexicon can be explained token by token, which suits the trust narrative. |
| Separate microservice for AI | Operational overhead for a single-model integration; a provider abstraction inside the same process is enough. |

## Advantages

- Identical evidence produces identical findings, severities and scores — a
  precondition for testing and for an analyst defending a number.
- The application is fully functional with zero paid keys; a reviewer can run it
  offline and see real output.
- Failures degrade predictably: a model outage changes wording, not conclusions.
- Injection exposure is bounded: the model can only influence prose in stored fields.
- Every claim can be traced to `evidence_ids`, which is what the graph, report and
  evidence centre rely on.

## Disadvantages

- **Language understanding is shallow.** Keyword topic matching and a lexicon miss
  sarcasm, paraphrase and non-English text; a semantically obvious complaint can be
  unclassified if its vocabulary is absent from the taxonomy.
- Findings inherit the taxonomy's judgement: impact/effort constants, severity
  thresholds and business implications are curated, not learned. Two very different
  markets are scored with the same constants (adjusted only by volume).
- The LLM adds less value than a model-first design would; it cannot discover a theme
  the engine missed.
- Two code paths to maintain and test (deterministic + fallback), and quality
  differences between live and demo output can confuse evaluators if the labels are
  ignored.
- Determinism is at the *algorithm* level; inputs still vary because search results
  vary.

## Trade-offs

| Gained | Given up |
| --- | --- |
| Reproducibility, auditability, offline operation | Depth of language understanding and novel insight generation |
| Small, testable surface for the LLM | A "the model does the analysis" narrative |
| Cheap to run (no tokens for the core) | Curated constants that do not adapt per market |

## Consequences

- Testing strategy follows directly: the engine is unit-tested against in-memory
  SQLite with synthetic records and no network (`tests/test_engines.py`).
- Any future move to a trained classifier should be additive — insert a new provider
  alongside `lexicon-v1` and compare, rather than replacing the transparent path.
- Product messaging must stay accurate: the LLM "enriches language", it does not
  "analyse the market". `docs/AI_ENGINEERING.md` and the README state this explicitly.
- If embeddings move to a hosted model, retrieval becomes non-deterministic across
  model versions — that would be a new ADR, not a tweak to this one.
