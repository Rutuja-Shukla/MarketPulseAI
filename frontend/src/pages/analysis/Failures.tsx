import { useMemo, useState } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { Panel, SectionHeading, Stat } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { EvidenceList } from "@/features/evidence/EvidenceList";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useFailures } from "@/hooks/useProjectData";
import { cn, formatDate, percent, titleCase } from "@/lib/utils";
import { SEVERITY_ORDER } from "@/lib/utils";

export default function Failures() {
  const { project } = useAnalysisContext();
  const query = useFailures(project.id);
  const [severity, setSeverity] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);

  const failures = query.data ?? [];
  const filtered = useMemo(
    () => (severity === "all" ? failures : failures.filter((failure) => failure.severity === severity)),
    [failures, severity],
  );
  const counts = useMemo(
    () =>
      SEVERITY_ORDER.reduce<Record<string, number>>((acc, key) => {
        acc[key] = failures.filter((failure) => failure.severity === key).length;
        return acc;
      }, {}),
    [failures],
  );

  if (query.isLoading) return <LoadingBlock label="Loading failure findings" rows={4} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Failure radar"
        title="Where the product is underperforming"
        description="Each finding separates the observed complaint from its business interpretation. Severity reflects volume, source diversity and corroboration — not revenue impact."
        actions={
          <div className="hidden gap-2 sm:flex">
            {SEVERITY_ORDER.map((key) => (
              <Badge key={key} tone={key === "critical" ? "negative" : key === "high" ? "warning" : "neutral"}>
                {counts[key] ?? 0} {key}
              </Badge>
            ))}
          </div>
        }
      />

      {failures.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CircleAlert className="h-4 w-4" />}
            title="No weakness findings yet"
            description="Failure findings require at least one negative evidence record. Run a standard or deep analysis to populate the radar."
          />
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", ...SEVERITY_ORDER].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSeverity(key)}
                className={cn(
                  "border px-3 py-1.5 text-[11.5px] transition-colors",
                  severity === key
                    ? "border-navy bg-navy/[0.05] text-navy"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                {key === "all" ? `All findings (${failures.length})` : `${titleCase(key)} (${counts[key] ?? 0})`}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {filtered.map((failure) => {
              const expanded = open === failure.id;
              return (
                <Panel key={failure.id} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : failure.id)}
                    aria-expanded={expanded}
                    className="w-full px-5 py-5 text-left transition-colors hover:bg-subtle/40 md:px-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <SeverityBadge severity={failure.severity} />
                          <Badge tone="outline">{titleCase(failure.category)}</Badge>
                          <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                            confidence {percent(failure.confidence, 1)}%
                          </span>
                        </div>
                        <h3 className="mt-3 text-[19px] leading-snug">{failure.title}</h3>
                        <p className="mt-2 max-w-[72ch] text-[12.5px] leading-relaxed text-muted">
                          {failure.summary}
                        </p>
                        <div className="mono mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9.5px] uppercase tracking-[0.1em] text-muted">
                          <span>{failure.evidence_count} records</span>
                          <span>{failure.source_count} source categories</span>
                          <span>first seen {formatDate(failure.first_observed)}</span>
                          <span>latest {formatDate(failure.last_observed)}</span>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")}
                        aria-hidden
                      />
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-line px-5 py-5 md:px-6">
                      <div className="grid gap-8 lg:grid-cols-12">
                        <div className="space-y-6 lg:col-span-7">
                          <div>
                            <div className="eyebrow mb-2">Representative customer feedback</div>
                            <blockquote className="border-l-2 border-negative/40 pl-4 text-[12.5px] italic leading-relaxed text-ink">
                              “{failure.representative_quote ?? failure.observed_complaint}”
                            </blockquote>
                            <p className="mt-2 text-[10px] text-muted">
                              A single record is illustrative. The finding is based on {failure.evidence_count} records
                              across {failure.source_count} source categories.
                            </p>
                          </div>

                          <div>
                            <div className="eyebrow mb-2">AI interpretation</div>
                            <p className="text-[12.5px] leading-relaxed text-muted">{failure.interpretation}</p>
                            <p className="mt-2 border border-line bg-subtle/50 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
                              This is an interpretation of public language, not a measured business failure.
                              No revenue, churn or sales data is used.
                            </p>
                          </div>

                          <div>
                            <div className="eyebrow mb-2">Possible business implications</div>
                            <p className="text-[12.5px] leading-relaxed text-muted">{failure.business_implications}</p>
                          </div>

                          <div>
                            <div className="eyebrow mb-2">Recommended corrective actions</div>
                            <ol className="space-y-1.5">
                              {failure.recommended_actions.map((action, index) => (
                                <li key={action} className="flex gap-3 text-[12.5px] leading-relaxed text-muted">
                                  <span className="mono text-[10px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                                  {action}
                                </li>
                              ))}
                            </ol>
                          </div>

                          <div className="flex flex-wrap gap-6 border-t border-line pt-4">
                            <Stat label="Confidence" value={`${percent(failure.confidence, 1)}%`} hint={failure.confidence_label} />
                            <Stat label="Sentiment" value={failure.sentiment_score.toFixed(2)} hint="mean score (−1 to 1)" />
                            <Stat label="Evidence" value={failure.evidence_count} hint="negative records" />
                          </div>
                        </div>

                        <div className="lg:col-span-5">
                          <div className="eyebrow mb-2">Supporting sources</div>
                          <EvidenceList projectId={project.id} ids={failure.evidence_ids} enabled={expanded} />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
