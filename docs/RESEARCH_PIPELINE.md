# Research pipeline

## Principles

1. **Collect, then verify, then interpret.** No finding is produced before its
   evidence exists.
2. **Every stage is observable.** Each stage writes a `ResearchTask` with status,
   start/finish time, item counts and an error message when it fails.
3. **Deterministic where it matters.** Severity, confidence and aggregates are
   computed by code. The model may improve phrasing, never the numbers.
4. **Fail loudly, degrade visibly.** Missing keys disable a capability and the UI
   says so; a failed stage marks the project failed with a readable reason.

## Modes

| Mode | Stages | Intended use |
| --- | --- | --- |
| Quick scan | 15 | A directional read in a few minutes |
| Standard | 15 | Default: balanced breadth and depth |
| Deep dive | 18 | Adds assumption testing, scenario modelling and extended graph work |

The exact stage list per mode lives in `backend/app/research/taxonomy.py` and is
returned by `GET /api/meta/catalog`, so the UI always reflects the backend.

## Stages (standard)

1. **Frame brief** — normalise company, product, market, objectives, assumptions
   and competitor set into a research plan.
2. **Plan queries** — derive source-specific queries (reviews, forums, support,
   release notes, comparison pages, job posts) bounded by
   `RESEARCH_MAX_QUERIES`.
3. **Discover sources** — call the configured provider (Tavily/Brave) or load the
   demo corpus. Results carry URL, title, snippet, published date, domain.
4. **Fetch & extract** — retrieve text, strip boilerplate, keep the passage that
   answers a query. Unreachable or empty sources are dropped, with the reason
   recorded.
5. **Validate evidence** — enforce: real URL, allowed scheme, non-trivial text,
   dedupe by content hash and canonical URL, publication date sanity.
6. **Normalise records** — map to `EvidenceRecord` with source category, country,
   language, author handle and rating where published.
7. **Sentiment** — lexicon scoring with negation, intensifiers, rating priors and
   mixed-signal detection; stores score in [-1, 1] plus a label.
8. **Topic assignment** — match each record against the 11-topic taxonomy
   (pricing, onboarding, reliability, support, performance, integrations,
   reporting, mobile, security, billing, documentation).
9. **Cluster & corroborate** — group records per topic, count distinct sources,
   detect contradictions between clusters.
10. **Failure detection** — a topic becomes a weakness only when negative volume
    and source diversity cross documented thresholds; severity is
    `count ≥ 7 and sources ≥ 2 → critical`, `≥ 4 → high`, `≥ 2 → medium`,
    otherwise `low`.
11. **Opportunity detection** — unmet needs and competitor gaps scored on impact,
    effort and confidence, with the evidence that implies them.
12. **Competitor analysis** — per-competitor mention volume, sentiment, strengths,
    weaknesses and observed pricing/positioning claims.
13. **Strategic graph** — nodes for complaints, risks, opportunities and actions;
    edges typed as `causes`, `amplifies`, `enables`, `mitigates`, each carrying
    evidence IDs.
14. **Assumption testing** — each brief assumption gets a verdict
    (`supported`, `contradicted`, `inconclusive`) from the evidence.
15. **Roadmap & report** — prioritised actions, then a versioned report document
    with references, metrics and limitations.

Deep dive adds: extended corroboration across countries, scenario seeds for the
simulator, and a second-pass contradiction review.

## Evidence validation rules

A record is accepted only if all hold:

- URL parses and uses `http`/`https` (demo records use the synthetic host);
- extracted text is at least ~40 characters after boilerplate removal;
- content hash is not a duplicate of an accepted record;
- canonical URL is not already present for the same project;
- publication date is not in the future (allowing clock skew).

Rejected records are logged with a reason, never silently promoted.

## Sentiment model

- Base lexicon of positive/negative terms with weights.
- Negation window flips polarity for the next few tokens.
- Intensifiers scale weights.
- Star ratings act as a prior when present.
- Mixed detection: strong positive and negative signals in one record yield
  `mixed` rather than an average that hides conflict.
- Thresholds are deliberately conservative so that neutral reporting ("the plan
  costs $29") is not counted as a complaint. The demo corpus produces roughly
  21 negative, 11 mixed, 9 neutral and 6 positive records.

## LLM usage (optional)

When `GEMINI_API_KEY` is present and `LLM_PROVIDER=gemini`:

- **Used for**: summarising clusters, naming themes, drafting recommendation
  language, answering the grounded assistant.
- **Not used for**: counting records, assigning severity, inventing sources,
  computing confidence.
- **Guards**: 60s timeout, bounded retries, JSON schema validation, retrieved text
  wrapped as data with an explicit instruction to ignore embedded commands,
  response rejected if it cites a URL not in the evidence set.
- **Fallback**: any error leaves deterministic output intact and labels the report
  with the non-LLM provider.

## RAG assistant

1. Embed/retrieve by lexical relevance over the project's own evidence (topic,
   phrase and source overlap).
2. Build a context window of the top records with IDs.
3. Answer with citations to those IDs; refuse when retrieval is empty.
4. Without an LLM, return a **retrieval brief** (`retrieval-v1`): the strongest
   matching passages plus counts, explicitly labelled as retrieval, not analysis.

## Monitoring

Each check compares current stored evidence with the last check:

- sentiment share overall vs the most recent third;
- new records since the previous run;
- complaint and opportunity watches;
- the latest observed signal.

`execution_mode` is `automated` only when a live provider is configured;
otherwise it is `manual` and the response includes a notice explaining that no
continuous collection is happening. Scheduled delivery is out of scope for the
single-container deployment; the compose stack runs the worker but scheduling is
explicitly user-triggered.

## Failure handling

- A stage exception marks the task `failed` with the message, the project
  `failed`, and a notification is created.
- Partial evidence remains queryable — the UI can still show what was collected.
- Retrying a project resets tasks and re-runs from collection.
