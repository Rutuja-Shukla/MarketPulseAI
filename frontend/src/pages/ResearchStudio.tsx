import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, Check, Play, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Card";
import { ErrorState, LoadingBlock, ProgressBar } from "@/components/ui/Feedback";
import {
  AssumptionsStep,
  CompanyStep,
  CompetitorsStep,
  ConfigStep,
  MarketStep,
  ObjectivesStep,
  SituationStep,
} from "@/features/research/StudioSteps";
import {
  defaultStudioValues,
  STEPS,
  STEP_FIELDS,
  studioSchema,
  type StudioForm,
} from "@/features/research/schema";
import { api, ApiError } from "@/lib/api";
import { cn, countryName, titleCase } from "@/lib/utils";
import type { Capabilities, Catalog, Project } from "@/types";

export function ResearchStudioPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ field: string; message: string }[]>([]);
  const [starting, setStarting] = useState(false);

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => api.get<Catalog>("/meta/catalog") });
  const capabilities = useQuery({
    queryKey: ["capabilities"],
    queryFn: () => api.get<Capabilities>("/meta/capabilities"),
  });

  const form = useForm<StudioForm>({
    resolver: zodResolver(studioSchema),
    defaultValues: defaultStudioValues,
    mode: "onBlur",
  });

  const requestedMode = params.get("mode");
  useEffect(() => {
    if (requestedMode === "quick" || requestedMode === "standard" || requestedMode === "deep") {
      form.setValue("depth", requestedMode);
    }
  }, [requestedMode, form]);

  useEffect(() => {
    if (capabilities.data && !capabilities.data.live_research_available) {
      form.setValue("run_mode", "demo");
    }
  }, [capabilities.data, form]);

  const values = form.watch();
  const countriesLabel = useMemo(() => {
    if (values.market.global_scope) return "Global market";
    if (values.market.countries.length === 0) return "No countries selected";
    return values.market.countries
      .map((code) => countryName(code, catalog.data?.countries ?? []))
      .join(", ");
  }, [values.market, catalog.data]);

  const stepProps = {
    form,
    catalog: catalog.data ?? {
      countries: [],
      regions: [],
      source_categories: [],
      objectives: [],
      situations: [],
      modes: [],
      topics: [],
      monitoring_tracks: [],
    },
    capabilities: capabilities.data ?? null,
  };

  async function next() {
    const fields = STEP_FIELDS[step] ?? [];
    const valid = await form.trigger(fields as never, { shouldFocus: true });
    if (!valid) return;
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startAnalysis() {
    const valid = await form.trigger(undefined, { shouldFocus: true });
    if (!valid) {
      setSubmitError("Some fields still need attention. Review the steps marked in the rail.");
      return;
    }
    setStarting(true);
    setSubmitError(null);
    setFieldErrors([]);
    const data = form.getValues();
    const payload = {
      name: data.name.trim(),
      company: {
        name: data.company.name.trim(),
        website: data.company.website?.trim() || null,
        industry: data.company.industry?.trim() || null,
        product_name: data.company.product_name?.trim() || null,
        description: data.company.description?.trim() || null,
        target_audience: data.company.target_audience?.trim() || null,
      },
      market: {
        global_scope: data.market.global_scope,
        countries: data.market.global_scope ? [] : data.market.countries,
        regions: data.market.regions,
        comparison_pairs: data.market.comparison_pairs,
      },
      situation: {
        key: data.situation_key || null,
        description: data.situation_description?.trim() || null,
      },
      objectives: data.objectives,
      assumptions: data.assumptions.map((item) => item.text.trim()).filter(Boolean),
      competitors: data.competitors
        .filter((item) => item.name.trim())
        .map((item) => ({ name: item.name.trim(), website: item.website?.trim() || null })),
      config: {
        research_period_start: data.period_start || null,
        research_period_end: data.period_end || null,
        source_categories: data.source_categories,
        depth: data.depth,
        competitor_target: data.competitor_target,
        analysis_preferences: data.preferences,
        notes: data.notes?.trim() || null,
      },
      demo_mode: data.run_mode === "demo",
    };

    try {
      const project = await api.post<Project>("/projects", payload);
      try {
        await api.post(`/projects/${project.id}/run`);
      } catch (error) {
        const message = error instanceof ApiError ? error.detail : "Research could not be queued";
        navigate(`/analysis/${project.id}/overview`, { state: { queueError: message } });
        return;
      }
      navigate(`/analysis/${project.id}/overview?started=1`);
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.detail);
        setFieldErrors(error.fieldErrors);
      } else {
        setSubmitError("Unable to create the research project.");
      }
    } finally {
      setStarting(false);
    }
  }

  const isLastStep = step === STEPS.length - 1;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow">Research studio</div>
          <h1 className="headline mt-3">Frame the question.</h1>
          <p className="mt-3 max-w-[58ch] text-[13.5px] leading-relaxed text-muted">
            Seven steps turn a business question into a structured investigation. Depth changes the
            pipeline: quick runs a single pass, deep adds trend and contradiction analysis.
          </p>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Badge tone="outline">{titleCase(values.depth)}</Badge>
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted">Step {step + 1} of {STEPS.length}</span>
        </div>
      </div>

      {catalog.isLoading ? (
        <div className="mt-10">
          <LoadingBlock label="Loading studio" rows={4} />
        </div>
      ) : catalog.isError ? (
        <div className="mt-10">
          <ErrorState message={(catalog.error as Error).message} onRetry={() => catalog.refetch()} />
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="sticky top-24">
              <ProgressBar value={progress} className="mb-4" />
              <ol className="space-y-0.5">
                {STEPS.map((item, index) => {
                  const active = index === step;
                  const done = index < step;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => setStep(index)}
                        className={cn(
                          "flex w-full items-baseline gap-3 border-l-2 py-2.5 pl-3 text-left transition-colors",
                          active
                            ? "border-navy bg-navy/[0.03]"
                            : "border-transparent hover:border-line",
                        )}
                      >
                        <span className="mono w-4 text-[10px] text-muted">
                          {done ? <Check className="h-3 w-3 text-positive" /> : String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <span className={cn("block text-[12.5px]", active ? "text-ink" : "text-muted")}>
                            {item.title}
                          </span>
                          <span className="block text-[10.5px] text-muted">{item.caption}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-6 border-t border-line pt-4">
                <div className="eyebrow mb-2">Running brief</div>
                <div className="space-y-1.5 text-[11px] leading-relaxed text-muted">
                  <div className="truncate">{values.company.name || "Company not set"}</div>
                  <div className="truncate">{countriesLabel}</div>
                  <div>{values.objectives.length} objectives · {values.assumptions.filter((item) => item.text).length} assumptions</div>
                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        values.run_mode === "demo" ? "bg-warning" : "bg-positive",
                      )}
                    />
                    {values.run_mode === "demo" ? "Demonstration corpus" : "Live provider"}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-9">
            <Panel className="p-6 md:p-8">
              <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="eyebrow">{STEPS[step].caption}</div>
                  <h2 className="mt-2 font-serif text-[24px] leading-tight">{STEPS[step].title}</h2>
                </div>
                <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                </span>
              </div>

              {step === 0 ? <CompanyStep {...stepProps} /> : null}
              {step === 1 ? <MarketStep {...stepProps} /> : null}
              {step === 2 ? <SituationStep {...stepProps} /> : null}
              {step === 3 ? <ObjectivesStep {...stepProps} /> : null}
              {step === 4 ? <AssumptionsStep {...stepProps} /> : null}
              {step === 5 ? <CompetitorsStep {...stepProps} /> : null}
              {step === 6 ? <ConfigStep {...stepProps} /> : null}

              {isLastStep ? (
                <div className="mt-8 border-t border-line pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="eyebrow">Research summary</div>
                    {values.run_mode === "demo" ? <Badge tone="warning">Demo data</Badge> : <Badge tone="positive">Live</Badge>}
                  </div>
                  <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                    {[
                      ["Company", values.company.name || "—"],
                      ["Product", values.company.product_name || "—"],
                      ["Markets", countriesLabel],
                      ["Depth", titleCase(values.depth)],
                      ["Objectives", `${values.objectives.length} selected`],
                      ["Assumptions", `${values.assumptions.filter((item) => item.text.trim()).length} to validate`],
                      ["Competitors", values.competitors.filter((item) => item.name.trim()).length ? values.competitors.map((item) => item.name).join(", ") : "Discovered from evidence"],
                      ["Sources", `${values.source_categories.length} categories`],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                        <dt className="text-[10px] uppercase tracking-[0.1em] text-muted">{label}</dt>
                        <dd className="truncate text-right text-[12px] text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {values.assumptions.some((item) => item.text.trim()) && values.objectives.length === 0 ? (
                    <p className="mt-4 text-[11.5px] text-warning">
                      No objectives selected — the run will still collect sentiment and weaknesses.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {submitError ? (
                <div className="mt-6 border border-negative/30 bg-negative/[0.04] p-4">
                  <p className="text-[12px] text-negative">{submitError}</p>
                  {fieldErrors.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {fieldErrors.map((error) => (
                        <li key={`${error.field}-${error.message}`} className="text-[11px] text-negative">
                          {error.field}: {error.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={back}
                  disabled={step === 0}
                  icon={<ArrowLeft className="h-4 w-4" />}
                >
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  {!isLastStep ? (
                    <Button type="button" onClick={next} icon={<ArrowRight className="h-4 w-4" />}>
                      Continue
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={startAnalysis}
                      loading={starting}
                      icon={<Play className="h-4 w-4" />}
                    >
                      Start intelligence analysis
                    </Button>
                  )}
                </div>
              </div>
            </Panel>

            <div className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Research runs in the background with staged progress. Findings are derived only from stored
                evidence records; the pipeline never invents sources or statistics.
              </span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
