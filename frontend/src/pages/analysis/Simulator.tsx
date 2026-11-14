import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, GitCompare, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionHeading } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { Textarea } from "@/components/ui/Field";
import { EvidenceList } from "@/features/evidence/EvidenceList";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useScenarios } from "@/hooks/useProjectData";
import { api } from "@/lib/api";
import { formatRelative, percent } from "@/lib/utils";
import type { Scenario } from "@/types";

const PRESETS = [
  "What if we reduce subscription prices by 10%?",
  "What if we enter the New Zealand market?",
  "What if we launch a scheduled reporting feature?",
  "What if we improve customer support response times?",
  "What if we target a different customer segment?",
];

export default function Simulator() {
  const { project } = useAnalysisContext();
  const queryClient = useQueryClient();
  const scenarios = useScenarios(project.id);
  const [prompt, setPrompt] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [comparePrompts, setComparePrompts] = useState<string[]>([PRESETS[0], PRESETS[3]]);
  const [error, setError] = useState<string | null>(null);

  const simulate = useMutation({
    mutationFn: (text: string) =>
      api.post<Scenario>(`/projects/${project.id}/simulate`, { prompt: text }),
    onSuccess: () => {
      setPrompt("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["scenarios", project.id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Scenario failed"),
  });

  const compare = useMutation({
    mutationFn: (prompts: string[]) =>
      api.post<Scenario[]>(`/projects/${project.id}/simulate/compare`, {
        scenarios: prompts.map((text) => ({ prompt: text })),
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["scenarios", project.id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Comparison failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${project.id}/scenarios/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["scenarios", project.id] }),
  });

  const latest = scenarios.data ?? [];
  const comparisonSet = latest.slice(0, Math.min(3, latest.length));

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Strategy simulator"
        title="Test the decision before you make it"
        description="Ask a what-if question and the simulator reasons over the stored findings. Outcomes are qualitative hypotheses with stated assumptions — never a financial forecast."
        actions={<Badge tone="warning">Hypothetical analysis</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Scenario input</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCompareMode(false)}
                className={compareMode ? "px-2 py-1 text-[10.5px] text-muted" : "border border-navy/30 bg-navy/[0.05] px-2 py-1 text-[10.5px] text-navy"}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setCompareMode(true)}
                className={compareMode ? "border border-navy/30 bg-navy/[0.05] px-2 py-1 text-[10.5px] text-navy" : "px-2 py-1 text-[10.5px] text-muted"}
              >
                Compare
              </button>
            </div>
          </div>

          {compareMode ? (
            <div className="mt-4 space-y-3">
              {comparePrompts.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="mono mt-2 w-4 text-[10px] text-muted">{index + 1}</span>
                  <Textarea
                    rows={2}
                    value={item}
                    onChange={(event) =>
                      setComparePrompts(comparePrompts.map((value, i) => (i === index ? event.target.value : value)))
                    }
                    aria-label={`Scenario ${index + 1}`}
                  />
                  {comparePrompts.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => setComparePrompts(comparePrompts.filter((_, i) => i !== index))}
                      className="mt-2 text-muted hover:text-negative"
                      aria-label="Remove scenario"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                {comparePrompts.length < 4 ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={() => setComparePrompts([...comparePrompts, ""])}
                  >
                    Add scenario
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  loading={compare.isPending}
                  disabled={comparePrompts.some((item) => item.trim().length < 8)}
                  icon={<GitCompare className="h-3.5 w-3.5" />}
                  onClick={() => compare.mutate(comparePrompts.filter((item) => item.trim()))}
                >
                  Compare {comparePrompts.length} scenarios
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Textarea
                rows={3}
                className="mt-4"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="What if we reduce subscription prices by 10%?"
                aria-label="Scenario question"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  loading={simulate.isPending}
                  disabled={prompt.trim().length < 8}
                  onClick={() => simulate.mutate(prompt.trim())}
                  icon={<ArrowRight className="h-3.5 w-3.5" />}
                >
                  Run scenario
                </Button>
                <span className="text-[10px] text-muted">Minimum 8 characters.</span>
              </div>
            </>
          )}
          {error ? <p className="mt-3 text-[11.5px] text-negative">{error}</p> : null}
        </Panel>

        <div className="lg:col-span-5">
          <div className="eyebrow mb-2">Starting points</div>
          <div className="space-y-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  if (compareMode) setComparePrompts([...comparePrompts.slice(0, 3), preset]);
                  else setPrompt(preset);
                }}
                className="block w-full border border-line px-3 py-2 text-left text-[11.5px] text-muted transition-colors hover:border-muted/40 hover:text-ink"
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[10.5px] leading-relaxed text-muted">
            The simulator uses public evidence and stated assumptions. It does not model your costs, margins or
            internal sales data, so treat outcomes as directional hypotheses.
          </p>
        </div>
      </div>

      {compareMode && comparisonSet.length >= 2 ? (
        <section>
          <SectionHeading eyebrow="Comparison" title="Scenarios side by side" />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {comparisonSet.map((scenario) => (
              <Panel key={scenario.id} className="p-5">
                <div className="eyebrow">Scenario</div>
                <h4 className="mt-2 text-[15px] leading-snug">{scenario.prompt}</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="outline">confidence {percent(scenario.confidence, 1)}%</Badge>
                  <Badge tone="neutral">{scenario.provider}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <div className="eyebrow mb-1 text-positive">Advantages</div>
                    <ul className="space-y-1">
                      {scenario.advantages.slice(0, 3).map((item) => (
                        <li key={item} className="text-[11px] leading-snug text-muted">+ {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="eyebrow mb-1 text-negative">Disadvantages</div>
                    <ul className="space-y-1">
                      {scenario.disadvantages.slice(0, 3).map((item) => (
                        <li key={item} className="text-[11px] leading-snug text-muted">− {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading eyebrow="History" title="Scenario record" />
        {scenarios.isLoading ? (
          <LoadingBlock label="Loading scenarios" rows={2} />
        ) : scenarios.isError ? (
          <ErrorState message={(scenarios.error as Error).message} onRetry={() => scenarios.refetch()} />
        ) : latest.length === 0 ? (
          <Panel className="mt-4">
            <EmptyState
              title="No scenarios yet"
              description="Run a what-if question to create the first scenario. Each one is stored with its assumptions and evidence links."
            />
          </Panel>
        ) : (
          <div className="mt-4 space-y-4">
            {latest.map((scenario) => (
              <Panel key={scenario.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="navy">Scenario</Badge>
                      <Badge tone="outline">{scenario.provider}</Badge>
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
                        confidence {percent(scenario.confidence, 1)}% · {formatRelative(scenario.created_at)}
                      </span>
                    </div>
                    <h4 className="mt-2 max-w-[70ch] text-[16px] leading-snug">{scenario.prompt}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove.mutate(scenario.id)}
                    className="text-muted hover:text-negative"
                    aria-label="Delete scenario"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-4 grid gap-5 lg:grid-cols-3">
                  <div>
                    <div className="eyebrow mb-1.5">Potential advantages</div>
                    <ul className="space-y-1.5">
                      {scenario.advantages.map((item) => (
                        <li key={item} className="text-[11.5px] leading-relaxed text-muted">+ {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">Potential disadvantages</div>
                    <ul className="space-y-1.5">
                      {scenario.disadvantages.map((item) => (
                        <li key={item} className="text-[11.5px] leading-relaxed text-muted">− {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5">Competitive response</div>
                    <ul className="space-y-1.5">
                      {scenario.competitor_responses.length ? (
                        scenario.competitor_responses.map((item) => (
                          <li key={item} className="text-[11.5px] leading-relaxed text-muted">{item}</li>
                        ))
                      ) : (
                        <li className="text-[11.5px] text-muted">No competitor response evidenced.</li>
                      )}
                    </ul>
                    {scenario.risks.length ? (
                      <div className="mt-4 border border-warning/30 bg-warning/[0.05] p-3">
                        <div className="eyebrow mb-1 text-warning">Risks</div>
                        {scenario.risks.map((risk) => (
                          <p key={risk} className="text-[11px] leading-relaxed text-muted">{risk}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <details className="mt-4 border-t border-line pt-3">
                  <summary className="cursor-pointer text-[10.5px] uppercase tracking-[0.1em] text-muted">
                    Assumptions and evidence ({scenario.evidence_ids.length} records)
                  </summary>
                  <div className="mt-3 grid gap-5 lg:grid-cols-2">
                    <ul className="space-y-1.5">
                      {scenario.assumptions.map((assumption) => (
                        <li key={assumption} className="text-[11px] leading-relaxed text-muted">· {assumption}</li>
                      ))}
                    </ul>
                    <EvidenceList projectId={project.id} ids={scenario.evidence_ids} enabled={false} />
                  </div>
                </details>
              </Panel>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
