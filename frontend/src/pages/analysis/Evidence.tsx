import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Library, Search, ShieldCheck, X } from "lucide-react";
import { Badge, SentimentBadge } from "@/components/ui/Badge";
import { Panel, SectionHeading, Stat } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { Input, Select } from "@/components/ui/Field";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useEvidence } from "@/hooks/useProjectData";
import { cn, formatDate, titleCase } from "@/lib/utils";

export default function EvidencePage() {
  const { project } = useAnalysisContext();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [source, setSource] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [country, setCountry] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [contradictions, setContradictions] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    if (source) params.set("source", source);
    if (sentiment) params.set("sentiment", sentiment);
    if (country) params.set("country", country);
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    if (contradictions) params.set("contradictions_only", "true");
    params.set("page_size", "20");
    return params.toString();
  }, [debounced, source, sentiment, country, from, to, contradictions]);

  const evidence = useEvidence(project.id, query, page);
  const data = evidence.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Evidence & trust centre"
        title="Every claim has a record"
        description="Directly observed evidence, AI interpretation, strategic hypothesis and recommended action are kept distinct. This is the library of directly observed evidence."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="outline">{data?.total ?? 0} records</Badge>
            {data ? <Badge tone="warning">{data.contradiction_count} conflicting</Badge> : null}
          </div>
        }
      />

      {project.is_demo ? (
        <div className="border border-warning/30 bg-warning/[0.05] px-4 py-2.5 text-[11.5px] text-muted">
          <span className="mono mr-2 text-[9.5px] uppercase tracking-[0.12em] text-warning">Demo data</span>
          Every record below is synthetic. Source links point to a demonstration host and are not real publications.
        </div>
      ) : null}

      <Panel className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search evidence text, source or phrase"
              aria-label="Search evidence"
              className="pl-9"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Select
            value={source}
            onChange={(event) => {
              setSource(event.target.value);
              setPage(1);
            }}
            aria-label="Source category"
            className="w-auto"
          >
            <option value="">All sources</option>
            {(data?.facets.sources ?? []).map((facet) => (
              <option key={facet.value} value={facet.value}>
                {titleCase(facet.value)} ({facet.count})
              </option>
            ))}
          </Select>
          <Select
            value={sentiment}
            onChange={(event) => {
              setSentiment(event.target.value);
              setPage(1);
            }}
            aria-label="Sentiment"
            className="w-auto"
          >
            <option value="">All sentiment</option>
            {["positive", "negative", "neutral", "mixed"].map((item) => (
              <option key={item} value={item}>{titleCase(item)}</option>
            ))}
          </Select>
          <Select
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              setPage(1);
            }}
            aria-label="Country"
            className="w-auto"
          >
            <option value="">All countries</option>
            {(data?.facets.countries ?? []).map((facet) => (
              <option key={facet.value} value={facet.value}>{facet.value} ({facet.count})</option>
            ))}
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            aria-label="From date"
            className="w-auto"
          />
          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            aria-label="To date"
            className="w-auto"
          />
          <label className="flex items-center gap-2 pb-2 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={contradictions}
              onChange={(event) => {
                setContradictions(event.target.checked);
                setPage(1);
              }}
              className="accent-[var(--mp-navy)]"
            />
            Conflicting only
          </label>
        </div>
      </Panel>

      {evidence.isLoading ? (
        <LoadingBlock label="Loading evidence" rows={5} />
      ) : evidence.isError ? (
        <ErrorState message={(evidence.error as Error).message} onRetry={() => evidence.refetch()} />
      ) : data && data.items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Library className="h-4 w-4" />}
            title="No evidence matches"
            description="Adjust the filters or run the analysis to collect records for this project."
          />
        </Panel>
      ) : data ? (
        <>
          <div className="divide-y divide-line border-y border-line">
            {data.items.map((record) => {
              const open = expanded === record.id;
              return (
                <div key={record.id} className="py-4">
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpanded(open ? null : record.id)}
                    aria-expanded={open}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                            {titleCase(record.source_category)}
                          </span>
                          <span className="text-[11.5px] text-ink">{record.source_name}</span>
                          <SentimentBadge sentiment={record.sentiment} />
                          <Badge tone="outline">{record.country ?? "global"}</Badge>
                          {record.contradiction_group ? <Badge tone="warning">conflicting evidence</Badge> : null}
                          {record.is_demo ? <Badge tone="warning">synthetic</Badge> : null}
                        </div>
                        {record.title ? (
                          <div className="mt-1.5 text-[13px] text-ink">{record.title}</div>
                        ) : null}
                        <p className={cn("mt-1 text-[11.5px] leading-relaxed text-muted", !open && "line-clamp-2")}>
                          {record.excerpt}
                        </p>
                      </div>
                      <div className="mono shrink-0 text-right text-[9.5px] uppercase tracking-[0.08em] text-muted">
                        <div>{formatDate(record.published_at)}</div>
                        <div>{record.sentiment_score.toFixed(2)}</div>
                      </div>
                    </div>
                  </button>

                  {open ? (
                    <div className="mt-4 grid gap-6 border-t border-line pt-4 lg:grid-cols-12">
                      <div className="lg:col-span-8">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Stat label="Credibility" value={record.credibility_score} hint={record.credibility_label} />
                            <Stat label="Corroboration" value={record.corroboration_count} hint="overlapping records" />
                          </div>
                          <div className="space-y-2">
                            <Stat label="Sentiment score" value={record.sentiment_score.toFixed(2)} hint="−1 to +1" />
                            <Stat label="Rating" value={record.rating ?? "—"} hint="where published" />
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="eyebrow mb-1.5">Topics detected</div>
                          <div className="flex flex-wrap gap-1.5">
                            {record.topics.length ? (
                              record.topics.map((topic) => (
                                <Badge key={topic} tone="outline">{titleCase(topic)}</Badge>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted">No topic matched</span>
                            )}
                          </div>
                        </div>
                        <div className="mt-4">
                          <div className="eyebrow mb-1.5">Related findings</div>
                          {record.finding_ids.length ? (
                            <ul className="space-y-1">
                              {record.finding_ids.map((finding) => (
                                <li key={`${finding.type}-${finding.id}`} className="text-[11.5px] text-muted">
                                  <span className="mono mr-2 text-[9px] uppercase tracking-[0.08em]">
                                    {finding.type === "failure" ? "weakness" : "opportunity"}
                                  </span>
                                  {finding.title}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[11px] text-muted">
                              This record informs aggregate sentiment but is not quoted by a specific finding.
                            </p>
                          )}
                        </div>
                        <div className="mt-4 border border-line bg-subtle/40 p-3">
                          <div className="eyebrow mb-1.5 flex items-center gap-1.5">
                            <ShieldCheck className="h-3 w-3" /> Provenance
                          </div>
                          <dl className="space-y-1 text-[10.5px] text-muted">
                            <div className="flex justify-between gap-3">
                              <dt>Collected</dt>
                              <dd>{formatDate(record.collected_at)}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt>Duplicate status</dt>
                              <dd>{record.duplicate_status}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt>Author</dt>
                              <dd>{record.author_handle ?? "not published"}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                      <div className="lg:col-span-4">
                        <div className="eyebrow mb-2">Source</div>
                        <p className="text-[11.5px] leading-relaxed text-muted">{record.source_name}</p>
                        {record.source_url ? (
                          record.is_demo ? (
                            <p className="mt-2 border border-warning/30 bg-warning/[0.05] px-2 py-1.5 text-[10.5px] text-warning">
                              Synthetic demonstration source — no real publication exists at this URL.
                            </p>
                          ) : (
                            <a
                              href={record.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="link-underline mt-2 inline-flex items-center gap-1 text-[11.5px] text-navy"
                            >
                              Open original source <ExternalLink className="h-3 w-3" />
                            </a>
                          )
                        ) : (
                          <p className="mt-2 text-[10.5px] text-muted">No public URL recorded.</p>
                        )}
                        <div className="mt-4">
                          <div className="eyebrow mb-1.5">Key phrases</div>
                          <div className="flex flex-wrap gap-1.5">
                            {record.key_phrases.slice(0, 6).map((phrase) => (
                              <span key={phrase} className="border border-line px-1.5 py-0.5 text-[10px] text-muted">
                                {phrase}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted">
              Page {data.page} of {totalPages} · {data.total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 border border-line px-2.5 py-1.5 text-[11px] text-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-3 w-3" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 border border-line px-2.5 py-1.5 text-[11px] text-muted disabled:opacity-40"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
