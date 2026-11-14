import { useState } from "react";
import { Controller, useFieldArray, type UseFormReturn } from "react-hook-form";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { CountryPicker } from "@/features/research/CountryPicker";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldShell, Input, OptionCard, Select, Textarea, TextField, Toggle } from "@/components/ui/Field";
import {
  exampleBrief,
  type StudioForm,
} from "@/features/research/schema";
import { api, ApiError } from "@/lib/api";
import { countryName } from "@/lib/utils";
import type { Capabilities, Catalog } from "@/types";

type StepProps = {
  form: UseFormReturn<StudioForm>;
  catalog: Catalog;
  capabilities: Capabilities | null;
};

export function CompanyStep({ form }: StepProps) {
  const { register, formState } = form;
  const errors = formState.errors;
  return (
    <div className="space-y-6">
      <TextField
        label="Research project name"
        required
        placeholder="Acme Signals — ANZ market position"
        error={errors.name?.message}
        {...register("name")}
        hint="Internal label for this investigation"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Company name"
          required
          placeholder="Northwind Analytics"
          error={errors.company?.name?.message}
          {...register("company.name")}
        />
        <TextField
          label="Company website"
          placeholder="example.com"
          error={errors.company?.website?.message}
          {...register("company.website")}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Product or service name"
          placeholder="Northwind Signals"
          {...register("company.product_name")}
        />
        <TextField
          label="Industry"
          placeholder="B2B SaaS — analytics"
          {...register("company.industry")}
        />
      </div>
      <FieldShell label="Product description" hint="What it does, who it serves">
        <Textarea
          rows={3}
          placeholder="Describe the product in two or three sentences."
          {...register("company.description")}
        />
      </FieldShell>
      <FieldShell label="Target audience">
        <Textarea
          rows={2}
          placeholder="e.g. Heads of Growth at D2C brands with 10–500 employees"
          {...register("company.target_audience")}
        />
      </FieldShell>
      <ExamplePrompt form={form} />
    </div>
  );
}

function ExamplePrompt({ form }: { form: UseFormReturn<StudioForm> }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-line pt-4">
      <p className="max-w-[52ch] text-[11.5px] leading-relaxed text-muted">
        No real research yet? Load an example brief (fictional company) to explore the workflow. It runs on
        the synthetic demonstration corpus.
      </p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        icon={<Wand2 className="h-3.5 w-3.5" />}
        onClick={() => {
          form.reset({
            ...form.getValues(),
            ...exampleBrief,
            company: { ...form.getValues().company, ...exampleBrief.company },
            market: exampleBrief.market ?? form.getValues().market,
            assumptions: exampleBrief.assumptions ?? form.getValues().assumptions,
            competitors: exampleBrief.competitors ?? form.getValues().competitors,
          } as StudioForm);
        }}
      >
        Use example brief
      </Button>
    </div>
  );
}

export function MarketStep({ form, catalog }: StepProps) {
  const { control, watch, setValue, formState } = form;
  const market = watch("market");
  return (
    <div className="space-y-6">
      <Controller
        control={control}
        name="market.global_scope"
        render={({ field }) => (
          <Toggle
            checked={field.value}
            onChange={(next) => {
              field.onChange(next);
              if (next) setValue("market.countries", []);
            }}
            label="Global market"
            description="Research the category globally rather than in selected countries."
          />
        )}
      />

      {!market.global_scope ? (
        <>
          <FieldShell
            label="Countries"
            required
            hint={`${market.countries.length} selected`}
            error={formState.errors.market?.countries?.message as string | undefined}
          >
            <Controller
              control={control}
              name="market.countries"
              render={({ field }) => (
                <CountryPicker
                  countries={catalog.countries}
                  selected={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </FieldShell>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-ink">Regions</span>
              <span className="text-[11px] text-muted">Selecting a region adds none automatically — countries are explicit</span>
            </div>
            <Controller
              control={control}
              name="market.regions"
              render={({ field }) => (
                <div className="flex flex-wrap gap-1.5">
                  {catalog.regions.map((region) => {
                    const active = field.value.includes(region);
                    return (
                      <button
                        key={region}
                        type="button"
                        onClick={() =>
                          field.onChange(
                            active ? field.value.filter((item: string) => item !== region) : [...field.value, region],
                          )
                        }
                        aria-pressed={active}
                        className={
                          active
                            ? "rounded-sm border border-navy/30 bg-navy/[0.06] px-2.5 py-1 text-[11.5px] text-navy"
                            : "rounded-sm border border-line px-2.5 py-1 text-[11.5px] text-muted hover:text-ink"
                        }
                      >
                        {region}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-ink">Geographical comparisons</span>
              <span className="text-[11px] text-muted">Compare two selected markets</span>
            </div>
            <Controller
              control={control}
              name="market.comparison_pairs"
              render={({ field }) => (
                <div className="space-y-2">
                  {field.value.length === 0 ? (
                    <p className="text-[11.5px] text-muted">No comparison configured.</p>
                  ) : (
                    field.value.map((pair, index) => (
                      <div key={`${pair.join("-")}-${index}`} className="flex items-center gap-2">
                        <span className="mono text-[10px] uppercase text-muted">
                          {countryName(pair[0], catalog.countries)} vs {countryName(pair[1], catalog.countries)}
                        </span>
                        <button
                          type="button"
                          onClick={() => field.onChange(field.value.filter((_, i) => i !== index))}
                          className="text-muted hover:text-negative"
                          aria-label="Remove comparison"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                  <ComparisonAdder
                    countries={catalog.countries}
                    selected={market.countries}
                    onAdd={(pair) => field.onChange([...field.value, pair])}
                  />
                </div>
              )}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function ComparisonAdder({
  countries,
  selected,
  onAdd,
}: {
  countries: Catalog["countries"];
  selected: string[];
  onAdd: (pair: string[]) => void;
}) {
  const [left, setLeft] = useState(selected[0] ?? "");
  const [right, setRight] = useState(selected[1] ?? "");
  const options = countries.filter((country) => selected.includes(country.code));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={left}
        onChange={(event) => setLeft(event.target.value)}
        aria-label="First comparison market"
        className="w-auto min-w-[140px] py-1.5 text-[12px]"
      >
        <option value="">Market A</option>
        {options.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </Select>
      <span className="text-[11px] text-muted">vs</span>
      <Select
        value={right}
        onChange={(event) => setRight(event.target.value)}
        aria-label="Second comparison market"
        className="w-auto min-w-[140px] py-1.5 text-[12px]"
      >
        <option value="">Market B</option>
        {options.map((country) => (
          <option key={country.code} value={country.code}>
            {country.name}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!left || !right || left === right}
        onClick={() => {
          onAdd([left, right]);
          setLeft("");
          setRight("");
        }}
      >
        Add
      </Button>
    </div>
  );
}

export function SituationStep({ form, catalog }: StepProps) {
  const { control, register } = form;
  return (
    <div className="space-y-6">
      <Controller
        control={control}
        name="situation_key"
        render={({ field }) => (
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.situations.map((situation) => (
              <OptionCard
                key={situation.key}
                selected={field.value === situation.key}
                onClick={() => field.onChange(situation.key)}
                title={situation.label}
              />
            ))}
          </div>
        )}
      />
      <FieldShell label="Describe the situation" hint="Optional, but it sharpens the questions">
        <Textarea
          rows={5}
          placeholder="What changed? What are you hearing from customers or sales?"
          {...register("situation_description")}
        />
      </FieldShell>
    </div>
  );
}

export function ObjectivesStep({ form, catalog }: StepProps) {
  const { control } = form;
  return (
    <Controller
      control={control}
      name="objectives"
      render={({ field }) => (
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.objectives.map((objective) => {
            const active = field.value.includes(objective.key);
            return (
              <button
                key={objective.key}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  field.onChange(
                    active ? field.value.filter((item: string) => item !== objective.key) : [...field.value, objective.key],
                  )
                }
                className={
                  active
                    ? "flex items-center justify-between gap-3 border border-navy bg-navy/[0.04] px-4 py-3 text-left"
                    : "flex items-center justify-between gap-3 border border-line px-4 py-3 text-left hover:border-muted/40"
                }
              >
                <span className="text-[12.5px] text-ink">{objective.label}</span>
                <span
                  className={
                    active
                      ? "h-2 w-2 rounded-full bg-navy"
                      : "h-2 w-2 rounded-full border border-line"
                  }
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      )}
    />
  );
}

export function AssumptionsStep({ form }: StepProps) {
  const { control, register } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "assumptions" });
  const examples = [
    "We believe customers are switching because our subscription pricing is too expensive.",
    "We believe support response times are a primary driver of cancellations.",
    "We believe the product lacks the reporting flexibility competitors offer.",
    "We believe our brand is less known in the India market than in Australia.",
  ];
  return (
    <div className="space-y-5">
      <p className="max-w-[60ch] text-[12.5px] leading-relaxed text-muted">
        Each assumption is tested against the collected evidence and classified as supported, partially
        supported, contradicted or insufficient evidence. Write them as beliefs, not as facts.
      </p>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1">
              <Textarea
                rows={2}
                placeholder="We believe…"
                {...register(`assumptions.${index}.text` as const)}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              className="mt-2 text-muted hover:text-negative"
              aria-label="Remove assumption"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<Plus className="h-3.5 w-3.5" />}
        onClick={() => append({ text: "" })}
      >
        Add assumption
      </Button>
      <div>
        <div className="eyebrow mb-2">Examples</div>
        <div className="space-y-1.5">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => append({ text: example })}
              className="block text-left text-[11.5px] leading-relaxed text-muted hover:text-navy"
            >
              + {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompetitorsStep({ form, capabilities }: StepProps) {
  const { control, register, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "competitors" });
  const [suggestions, setSuggestions] = useState<
    { name: string; website: string | null; reason: string }[]
  >([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const company = watch("company");

  async function suggest() {
    setBusy(true);
    setSuggestError(null);
    try {
      const response = await api.post<{
        competitors: { name: string; website: string | null; reason: string }[];
        note: string;
      }>("/projects/suggest-competitors", {
        company_name: company.name,
        product_name: company.product_name,
        industry: company.industry,
        description: company.description,
      });
      setSuggestions(response.competitors);
    } catch (error) {
      setSuggestError(error instanceof ApiError ? error.detail : "Suggestion request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {fields.length === 0 ? (
          <p className="border border-dashed border-line px-4 py-6 text-center text-[12px] text-muted">
            No competitors added. The platform will still identify companies named in the evidence.
          </p>
        ) : (
          fields.map((field, index) => (
            <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input placeholder="Competitor name" {...register(`competitors.${index}.name` as const)} />
              <Input placeholder="Website (optional)" {...register(`competitors.${index}.website` as const)} />
              <button
                type="button"
                onClick={() => remove(index)}
                className="flex items-center justify-center px-2 text-muted hover:text-negative"
                aria-label="Remove competitor"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => append({ name: "", website: "" })}
        >
          Add competitor
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={busy}
          icon={<Wand2 className="h-3.5 w-3.5" />}
          onClick={suggest}
        >
          Suggest competitors
        </Button>
        {!capabilities?.llm_configured ? (
          <span className="text-[10.5px] text-muted">Requires a configured LLM — no names are invented without one.</span>
        ) : null}
      </div>

      {suggestError ? <p className="text-[11.5px] text-negative">{suggestError}</p> : null}

      {suggestions.length > 0 ? (
        <div className="border border-line bg-subtle/50 p-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Model suggestions — verify before use</span>
            <Badge tone="warning">Not researched</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {suggestions.map((suggestion) => (
              <div key={suggestion.name} className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12.5px] text-ink">{suggestion.name}</div>
                  <div className="text-[11px] text-muted">{suggestion.reason}</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => append({ name: suggestion.name, website: suggestion.website ?? "" })}
                >
                  Add
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ConfigStep({ form, catalog, capabilities }: StepProps) {
  const { control, register, watch, formState } = form;
  const depth = watch("depth");
  const runMode = watch("run_mode");
  return (
    <div className="space-y-7">
      <div>
        <div className="eyebrow mb-3">Research depth</div>
        <Controller
          control={control}
          name="depth"
          render={({ field }) => (
            <div className="grid gap-2">
              {catalog.modes.map((mode) => (
                <OptionCard
                  key={mode.key}
                  selected={field.value === mode.key}
                  onClick={() => field.onChange(mode.key)}
                  title={mode.label}
                  description={mode.description}
                  meta={`${mode.stages} stages · ${mode.query_budget} queries · ${mode.competitors} competitors`}
                />
              ))}
            </div>
          )}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Research period start" type="date" {...register("period_start")} />
        <TextField label="Research period end" type="date" {...register("period_end")} />
      </div>

      <div>
        <div className="eyebrow mb-3">Source categories</div>
        <Controller
          control={control}
          name="source_categories"
          render={({ field }) => (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {catalog.source_categories.map((source) => {
                const active = field.value.includes(source.key);
                return (
                  <label
                    key={source.key}
                    className="flex cursor-pointer items-start gap-2.5 border border-line px-3 py-2.5 text-[12px] hover:border-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() =>
                        field.onChange(
                          active ? field.value.filter((item: string) => item !== source.key) : [...field.value, source.key],
                        )
                      }
                      className="mt-0.5 accent-[var(--mp-navy)]"
                    />
                    <span>
                      <span className="block text-ink">{source.label}</span>
                      <span className="block text-[10.5px] leading-snug text-muted">{source.note}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        />
        {formState.errors.source_categories ? (
          <p className="mt-1 text-[11.5px] text-negative">{formState.errors.source_categories.message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Competitors to analyse"
          type="number"
          min={1}
          max={6}
          {...register("competitor_target", { valueAsNumber: true })}
        />
        <div className="space-y-2">
          <span className="text-[12.5px] font-medium">Analysis preferences</span>
          <div className="space-y-1.5">
            <Controller
              control={control}
              name="preferences.include_contradictions"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-[11.5px] text-muted">
                  <input type="checkbox" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} className="accent-[var(--mp-navy)]" />
                  Flag conflicting evidence
                </label>
              )}
            />
            <Controller
              control={control}
              name="preferences.regional_comparison"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-[11.5px] text-muted">
                  <input type="checkbox" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} className="accent-[var(--mp-navy)]" />
                  Include regional comparison
                </label>
              )}
            />
          </div>
        </div>
      </div>

      <FieldShell label="Notes for this investigation">
        <Textarea rows={3} placeholder="Anything the analysis should keep in mind." {...register("notes")} />
      </FieldShell>

      <div className="border-t border-line pt-5">
        <div className="eyebrow mb-3">Run mode</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <OptionCard
            selected={runMode === "demo"}
            onClick={() => form.setValue("run_mode", "demo")}
            title="Demonstration"
            description="Run against the labelled synthetic corpus. No API keys, no live search."
            meta={capabilities?.demo_mode ? "Available" : "Disabled on this server"}
            disabled={!capabilities?.demo_mode}
          />
          <OptionCard
            selected={runMode === "live"}
            onClick={() => form.setValue("run_mode", "live")}
            title="Live research"
            description={
              capabilities?.live_research_available
                ? "Uses the configured search provider. Results are real public sources."
                : "Requires SEARCH_PROVIDER plus an API key on the server."
            }
            meta={
              capabilities?.live_research_available
                ? `Provider: ${capabilities.search_provider}`
                : "Not configured"
            }
            disabled={!capabilities?.live_research_available}
          />
        </div>
        {depth === "deep" ? (
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Deep intelligence adds trend modelling and contradiction analysis, and collects up to twice the
            evidence of a standard run.
          </p>
        ) : null}
      </div>
    </div>
  );
}
