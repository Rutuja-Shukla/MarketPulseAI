import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionHeading } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useRoadmap } from "@/hooks/useProjectData";
import { api, downloadAuthenticated } from "@/lib/api";
import { cn, percent, titleCase } from "@/lib/utils";
import type { RoadmapItem } from "@/types";

const HORIZONS = [
  { key: "immediate", label: "Immediate priorities", caption: "Critical weaknesses with corroborated evidence" },
  { key: "short_term", label: "Short-term improvements", caption: "High severity or quick-win opportunities" },
  { key: "medium_term", label: "Medium-term initiatives", caption: "Strategic investments and medium severity" },
  { key: "long_term", label: "Long-term strategic investments", caption: "Larger efforts and lower-priority signals" },
];

const PRIORITIES = ["critical", "high", "medium", "low"];
const STATUSES = ["planned", "in_progress", "completed", "parked"];

export default function Roadmap() {
  const { project } = useAnalysisContext();
  const query = useRoadmap(project.id);
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [exportError, setExportError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: (input: { id: string; patch: Record<string, unknown> }) =>
      api.patch<RoadmapItem>(`/projects/${project.id}/roadmap/${input.id}`, input.patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["roadmap", project.id] });
    },
  });

  if (query.isLoading) return <LoadingBlock label="Loading roadmap" rows={4} />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  const items = query.data ?? [];

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Product roadmap"
        title="From evidence to sequence"
        description="Generated from findings, then editable. Every item links back to the finding it came from and carries the metric worth monitoring."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<Download className="h-3.5 w-3.5" />}
              disabled={items.length === 0}
              onClick={async () => {
                setExportError(null);
                try {
                  await downloadAuthenticated(`/projects/${project.id}/roadmap/export`, "marketpulse-roadmap.md");
                } catch (error) {
                  setExportError(error instanceof Error ? error.message : "Export failed");
                }
              }}
            >
              Export roadmap
            </Button>
          </div>
        }
      />
      {exportError ? <p className="text-[11.5px] text-negative">{exportError}</p> : null}

      {items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<ListChecks className="h-4 w-4" />}
            title="No roadmap items yet"
            description="The roadmap is generated from weakness and opportunity findings. Run an analysis first."
          />
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 border-y border-line py-3 text-[11px] text-muted">
            {STATUSES.map((status) => (
              <span key={status} className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    status === "completed"
                      ? "bg-positive"
                      : status === "in_progress"
                        ? "bg-accent"
                        : status === "parked"
                          ? "bg-warning"
                          : "bg-muted",
                  )}
                />
                {titleCase(status)}: {items.filter((item) => item.status === status).length}
              </span>
            ))}
            <span className="ml-auto">
              Completion {percent(items.filter((item) => item.status === "completed").length, items.length)}%
            </span>
          </div>

          <div className="space-y-10">
            {HORIZONS.map((horizon) => {
              const subset = items.filter((item) => item.horizon === horizon.key);
              if (subset.length === 0) return null;
              return (
                <section key={horizon.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
                    <h3 className="text-[18px]">{horizon.label}</h3>
                    <span className="text-[10.5px] text-muted">{horizon.caption}</span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {subset.map((item) => (
                      <Panel key={item.id} className="p-5">
                        <div className="grid gap-5 lg:grid-cols-12">
                          <div className="lg:col-span-8">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={item.finding_type === "failure" ? "negative" : "positive"}>
                                {item.finding_type === "failure" ? "Weakness" : "Opportunity"}
                              </Badge>
                              <Badge tone="outline">{item.complexity} complexity</Badge>
                              <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                                confidence {percent(item.confidence, 1)}%
                              </span>
                            </div>
                            <h4 className="mt-3 text-[17px] leading-snug">{item.title}</h4>
                            {item.problem ? (
                              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
                                <span className="text-ink">Problem.</span> {item.problem}
                              </p>
                            ) : null}
                            {item.improvement ? (
                              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                                <span className="text-ink">Proposed improvement.</span> {item.improvement}
                              </p>
                            ) : null}
                            {item.expected_impact ? (
                              <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                                <span className="text-ink">Expected impact.</span> {item.expected_impact}
                              </p>
                            ) : null}
                            {item.success_metrics.length ? (
                              <div className="mt-3">
                                <div className="eyebrow mb-1">Success metrics</div>
                                <ul className="space-y-1">
                                  {item.success_metrics.map((metric) => (
                                    <li key={metric} className="text-[11px] text-muted">· {metric}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-3 lg:col-span-4">
                            <label className="block">
                              <span className="eyebrow mb-1 block">Priority</span>
                              <select
                                value={item.priority}
                                onChange={(event) => update.mutate({ id: item.id, patch: { priority: event.target.value } })}
                                className="w-full border border-line bg-paper px-2 py-1.5 text-[11.5px]"
                              >
                                {PRIORITIES.map((priority) => (
                                  <option key={priority} value={priority}>{titleCase(priority)}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className="eyebrow mb-1 block">Status</span>
                              <select
                                value={item.status}
                                onChange={(event) => update.mutate({ id: item.id, patch: { status: event.target.value } })}
                                className="w-full border border-line bg-paper px-2 py-1.5 text-[11.5px]"
                              >
                                {STATUSES.map((status) => (
                                  <option key={status} value={status}>{titleCase(status)}</option>
                                ))}
                              </select>
                            </label>
                            <div>
                              <span className="eyebrow mb-1 block">Notes</span>
                              <Textarea
                                rows={2}
                                value={notes[item.id] ?? item.notes ?? ""}
                                onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })}
                                placeholder="Owner, decision, dependency…"
                                className="text-[11.5px]"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-1.5"
                                disabled={notes[item.id] === undefined || notes[item.id] === (item.notes ?? "")}
                                onClick={() =>
                                  update.mutate({ id: item.id, patch: { notes: notes[item.id] ?? "" } })
                                }
                              >
                                Save note
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Panel>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
