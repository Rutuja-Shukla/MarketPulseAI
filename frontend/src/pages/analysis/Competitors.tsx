import { Badge, SentimentBadge } from "@/components/ui/Badge";
import { Panel, SectionHeading } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useCompetitors } from "@/hooks/useProjectData";
import { formatDate, percent } from "@/lib/utils";

export default function Competitors() {
  const { project } = useAnalysisContext();
  const query = useCompetitors(project.id);
  const data = query.data;

  if (query.isLoading) return <LoadingBlock label="Loading competitor intelligence" rows={4} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  if (!data) return null;

  if (!data.competitors.length) {
    return (
      <div className="space-y-8">
        <SectionHeading
          eyebrow="Competitor intelligence"
          title="Competitor benchmarking"
          description="Comparisons are only drawn from records that name each competitor."
        />
        <Panel>
          <EmptyState
            title="No competitor evidence collected"
            description="Add competitors to a project, or run a deeper analysis so competitor names appear in the collected sources."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <SectionHeading
        eyebrow="Competitor intelligence"
        title="How you compare, where the evidence allows"
        description="Scores are derived from sentiment in records that mention each company. Empty cells mean there is insufficient evidence — no score is invented."
      />

      <Panel className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">Company</th>
              {data.matrix.dimensions.map((dimension) => (
                <th key={dimension.key} className="px-3 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                  {dimension.label}
                </th>
              ))}
              <th className="px-3 py-3 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-muted">Mentions</th>
            </tr>
          </thead>
          <tbody>
            {data.matrix.rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-4">
                  <div className="text-[12.5px] text-ink">{row.name}</div>
                  {row.is_primary ? <span className="mono text-[9px] uppercase tracking-[0.08em] text-muted">primary</span> : null}
                </td>
                {data.matrix.dimensions.map((dimension) => {
                  const score = row.scores[dimension.key];
                  return (
                    <td key={dimension.key} className="px-3 py-4">
                      {score === null ? (
                        <span className="mono text-[9px] uppercase tracking-[0.06em] text-muted">insufficient</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-14 bg-subtle">
                            <div
                              className={score >= 55 ? "h-full bg-positive" : score >= 40 ? "h-full bg-warning" : "h-full bg-negative"}
                              style={{ width: `${Math.max(4, score)}%` }}
                            />
                          </div>
                          <span className="mono text-[10px] text-muted">{Math.round(score)}</span>
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="mono px-3 py-4 text-right text-[11px] text-muted">{row.evidence_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-3 text-[10.5px] leading-relaxed text-muted">
          Scores are 0–100 sentiment indices computed from public records mentioning each company. Coverage is not
          equal across vendors, so no overall superiority score is assigned.
        </p>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {data.competitors.map((competitor) => (
          <Panel key={competitor.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] leading-snug">{competitor.name}</h3>
                <div className="mono mt-1 text-[9.5px] uppercase tracking-[0.1em] text-muted">
                  {competitor.mention_count} mentions · {competitor.source_count} source categories
                </div>
              </div>
              {competitor.sentiment_score !== null ? (
                <Badge tone={competitor.sentiment_score > 0.1 ? "positive" : competitor.sentiment_score < -0.1 ? "negative" : "neutral"}>
                  {competitor.sentiment_score.toFixed(2)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">{competitor.positioning}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="eyebrow mb-1.5">Strengths</div>
                <ul className="space-y-1">
                  {competitor.strengths.length ? (
                    competitor.strengths.map((strength) => (
                      <li key={strength} className="text-[11px] leading-snug text-muted">+ {strength}</li>
                    ))
                  ) : (
                    <li className="text-[11px] text-muted">Not evidenced</li>
                  )}
                </ul>
              </div>
              <div>
                <div className="eyebrow mb-1.5">Weaknesses</div>
                <ul className="space-y-1">
                  {competitor.weaknesses.length ? (
                    competitor.weaknesses.map((weakness) => (
                      <li key={weakness} className="text-[11px] leading-snug text-muted">− {weakness}</li>
                    ))
                  ) : (
                    <li className="text-[11px] text-muted">Not evidenced</li>
                  )}
                </ul>
              </div>
            </div>
            {competitor.website ? (
              <a
                href={competitor.website}
                target="_blank"
                rel="noreferrer"
                className="link-underline mt-4 inline-flex text-[11px] text-navy"
              >
                {competitor.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </Panel>
        ))}
      </div>

      <section>
        <SectionHeading eyebrow="Public pricing" title="Pricing evidence" description="Listed only where reliable public information was collected." />
        <Panel className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">Company</th>
                <th className="px-4 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-muted">Public pricing evidence</th>
                <th className="px-4 py-3 text-right text-[10px] font-medium uppercase tracking-[0.1em] text-muted">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {data.pricing.map((row) => (
                <tr key={row.name} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 text-[12px] text-ink">{row.name}</td>
                  <td className="px-4 py-3 text-[11.5px] leading-relaxed text-muted">
                    {row.pricing_summary ?? "No public pricing evidence collected."}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge tone={row.reliable ? "positive" : "neutral"}>
                      {row.reliable ? "reliable" : "limited"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </section>

      <section>
        <SectionHeading eyebrow="Signals" title="Competitor mentions over time" />
        <Panel className="mt-4">
          {data.timeline.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-muted">No dated competitor mentions were collected.</p>
          ) : (
            <div className="divide-y divide-line">
              {data.timeline.slice(0, 12).map((item, index) => (
                <div key={`${item.competitor}-${index}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] text-ink">{item.competitor}</span>
                      <SentimentBadge sentiment={item.sentiment} />
                    </div>
                    <p className="mt-1 line-clamp-2 max-w-[70ch] text-[11px] leading-relaxed text-muted">{item.title}</p>
                  </div>
                  <div className="mono shrink-0 text-right text-[9.5px] uppercase tracking-[0.08em] text-muted">
                    <div>{formatDate(item.date)}</div>
                    <div>{item.source}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section>
        <SectionHeading eyebrow="AI-generated insights" title="Competitive reading" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {data.insights.map((insight) => (
            <Panel key={insight.competitor} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-ink">{insight.competitor}</span>
                <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-muted">
                  {insight.mentions} mentions · {percent(insight.sentiment_score ?? 0, 1)}% tone
                </span>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{insight.note}</p>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
