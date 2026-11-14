import { useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { ChevronDown, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionHeading, Stat } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { EChart, useChartPalette } from "@/components/charts/EChart";
import { EvidenceList } from "@/features/evidence/EvidenceList";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useOpportunities } from "@/hooks/useProjectData";
import { cn, percent, titleCase } from "@/lib/utils";

const QUADRANTS = [
  { key: "quick_win", label: "Quick wins", hint: "High impact, low effort", tone: "positive" as const },
  { key: "strategic_investment", label: "Strategic investments", hint: "High impact, higher effort", tone: "navy" as const },
  { key: "long_term", label: "Long-term opportunities", hint: "Lower impact, higher effort", tone: "warning" as const },
  { key: "low_priority", label: "Low priority", hint: "Lower impact, low effort", tone: "neutral" as const },
];

export default function Opportunities() {
  const { project } = useAnalysisContext();
  const query = useOpportunities(project.id);
  const [open, setOpen] = useState<string | null>(null);
  const palette = useChartPalette();
  const opportunities = query.data ?? [];

  const counts = useMemo(
    () =>
      QUADRANTS.reduce<Record<string, number>>((acc, quadrant) => {
        acc[quadrant.key] = opportunities.filter((item) => item.quadrant === quadrant.key).length;
        return acc;
      }, {}),
    [opportunities],
  );

  const option = useMemo<EChartsOption>(() => {
    const colour = {
      quick_win: palette.positive,
      strategic_investment: palette.accent,
      long_term: palette.warning,
      low_priority: palette.muted,
    } as Record<string, string>;
    return {
      grid: { left: 48, right: 24, top: 28, bottom: 46 },
      tooltip: {
        trigger: "item",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        textStyle: { color: palette.text, fontSize: 11 },
        formatter: (params: unknown) => {
          const item = params as { data: { name: string; value: [number, number]; quadrant: string; confidence: number } };
          return `<strong>${item.data.name}</strong><br/>Effort ${item.data.value[0]} · Impact ${item.data.value[1]}<br/>${titleCase(
            item.data.quadrant,
          )} · confidence ${Math.round(item.data.confidence * 100)}%`;
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        name: "Implementation effort →",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { color: palette.muted, fontSize: 10 },
        axisLine: { lineStyle: { color: palette.border } },
        axisLabel: { color: palette.muted, fontSize: 9 },
        splitLine: { lineStyle: { color: palette.border, type: "dashed" } },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        name: "Potential impact →",
        nameLocation: "middle",
        nameGap: 36,
        nameTextStyle: { color: palette.muted, fontSize: 10 },
        axisLine: { lineStyle: { color: palette.border } },
        axisLabel: { color: palette.muted, fontSize: 9 },
        splitLine: { lineStyle: { color: palette.border, type: "dashed" } },
      },
      series: [
        {
          type: "scatter",
          symbolSize: (value: number[]) => 12 + Math.min(20, value[2] ?? 0),
          data: opportunities.map((item) => ({
            name: item.title,
            value: [item.effort_score, item.impact_score, item.evidence_count],
            quadrant: item.quadrant,
            confidence: item.confidence,
            itemStyle: { color: colour[item.quadrant], opacity: 0.85 },
          })),
          markLine: {
            silent: true,
            symbol: "none",
            lineStyle: { color: palette.border, type: "dashed" },
            data: [{ xAxis: 50 }, { yAxis: 50 }],
            label: { show: false },
          },
        },
      ],
    };
  }, [opportunities, palette]);

  if (query.isLoading) return <LoadingBlock label="Loading opportunities" rows={4} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Opportunity radar"
        title="Where the business could move"
        description="Opportunities come from unmet needs, requested capabilities, competitor gaps and regional sentiment. Impact and effort are AI-assisted assessments for prioritisation — not measured business outcomes."
        actions={<Badge tone="warning">AI-assisted estimates</Badge>}
      />

      {opportunities.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Lightbulb className="h-4 w-4" />}
            title="No opportunities identified yet"
            description="Run a standard or deep analysis. Opportunities need at least two supporting records before they are surfaced."
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {QUADRANTS.map((quadrant) => (
              <div key={quadrant.key} className="bg-paper px-4 py-4">
                <Stat
                  label={quadrant.label}
                  value={counts[quadrant.key] ?? 0}
                  hint={quadrant.hint}
                  tone={
                    quadrant.tone === "positive" || quadrant.tone === "warning"
                      ? quadrant.tone
                      : "default"
                  }
                />
              </div>
            ))}
          </div>

          <Panel className="p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="eyebrow">Prioritisation matrix</div>
              <div className="flex flex-wrap items-center gap-3">
                {QUADRANTS.map((quadrant) => (
                  <span key={quadrant.key} className="flex items-center gap-1.5 text-[10px] text-muted">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        quadrant.key === "quick_win"
                          ? "bg-positive"
                          : quadrant.key === "strategic_investment"
                            ? "bg-accent"
                            : quadrant.key === "long_term"
                              ? "bg-warning"
                              : "bg-muted",
                      )}
                    />
                    {quadrant.label}
                  </span>
                ))}
              </div>
            </div>
            <EChart
              option={option}
              height={360}
              ariaLabel="Scatter chart plotting opportunities by implementation effort and potential impact"
              className="mt-2"
            />
            <p className="mt-2 text-[10.5px] text-muted">
              Bubble size reflects the number of supporting evidence records. Hover for details.
            </p>
          </Panel>

          <div className="space-y-4">
            {opportunities.map((opportunity) => {
              const expanded = open === opportunity.id;
              return (
                <Panel key={opportunity.id}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : opportunity.id)}
                    className="w-full px-5 py-5 text-left transition-colors hover:bg-subtle/40 md:px-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="navy">{titleCase(opportunity.quadrant)}</Badge>
                          <Badge tone="outline">{opportunity.category}</Badge>
                          <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                            {opportunity.evidence_count} supporting records
                          </span>
                        </div>
                        <h3 className="mt-3 text-[19px] leading-snug">{opportunity.title}</h3>
                        <p className="mt-2 max-w-[74ch] text-[12.5px] leading-relaxed text-muted">
                          {opportunity.description}
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-6">
                          <div className="min-w-[140px] flex-1">
                            <div className="mono mb-1 flex justify-between text-[9px] uppercase tracking-[0.1em] text-muted">
                              <span>Impact</span>
                              <span>{Math.round(opportunity.impact_score)}</span>
                            </div>
                            <div className="h-1 w-full bg-subtle">
                              <div className="h-full bg-positive" style={{ width: `${opportunity.impact_score}%` }} />
                            </div>
                          </div>
                          <div className="min-w-[140px] flex-1">
                            <div className="mono mb-1 flex justify-between text-[9px] uppercase tracking-[0.1em] text-muted">
                              <span>Effort</span>
                              <span>{Math.round(opportunity.effort_score)}</span>
                            </div>
                            <div className="h-1 w-full bg-subtle">
                              <div className="h-full bg-warning" style={{ width: `${opportunity.effort_score}%` }} />
                            </div>
                          </div>
                          <div className="mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                            confidence {percent(opportunity.confidence, 1)}%
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-line px-5 py-5 md:px-6">
                      <div className="grid gap-8 lg:grid-cols-12">
                        <div className="space-y-5 lg:col-span-7">
                          <div>
                            <div className="eyebrow mb-2">Customer demand signal</div>
                            <blockquote className="border-l-2 border-positive/40 pl-4 text-[12.5px] italic leading-relaxed text-ink">
                              “{opportunity.demand_signal ?? "No representative excerpt available."}”
                            </blockquote>
                          </div>
                          {opportunity.competitor_comparison ? (
                            <div>
                              <div className="eyebrow mb-2">Competitor comparison</div>
                              <p className="text-[12.5px] leading-relaxed text-muted">
                                {opportunity.competitor_comparison}
                              </p>
                            </div>
                          ) : null}
                          <div>
                            <div className="eyebrow mb-2">Strategic relevance</div>
                            <p className="text-[12.5px] leading-relaxed text-muted">
                              {opportunity.strategic_relevance}
                            </p>
                          </div>
                          <div className="border border-line bg-subtle/40 p-3">
                            <div className="eyebrow mb-1.5">Recommended next action</div>
                            <p className="text-[12.5px] leading-relaxed text-ink">{opportunity.next_action}</p>
                          </div>
                          <p className="text-[10.5px] leading-relaxed text-muted">
                            Impact, effort and confidence are qualitative estimates derived from the volume and
                            nature of supporting evidence. They are not financial forecasts.
                          </p>
                        </div>
                        <div className="lg:col-span-5">
                          <div className="eyebrow mb-2">Supporting market evidence</div>
                          <EvidenceList projectId={project.id} ids={opportunity.evidence_ids} enabled={expanded} />
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
