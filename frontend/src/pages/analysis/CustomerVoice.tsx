import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { Filter, MessageSquare, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionHeading, Stat } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { Input, Select } from "@/components/ui/Field";
import { EChart, useChartPalette } from "@/components/charts/EChart";
import { EvidenceRecordView } from "@/features/evidence/EvidenceList";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useCustomerVoice } from "@/hooks/useProjectData";
import { cn, percent, titleCase } from "@/lib/utils";

export default function CustomerVoice() {
  const { project } = useAnalysisContext();
  const palette = useChartPalette();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [country, setCountry] = useState("");
  const [source, setSource] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (debounced) params.set("search", debounced);
    if (sentiment) params.set("sentiment", sentiment);
    if (country) params.set("country", country);
    if (source) params.set("source", source);
    if (topic) params.set("topic", topic);
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    params.set("limit", "60");
    return params.toString();
  }, [debounced, sentiment, country, source, topic, from, to]);

  const voice = useCustomerVoice(project.id, query);
  const data = voice.data;

  const option = useMemo<EChartsOption>(() => {
    if (!data) return {};
    const total = Math.max(1, data.summary.total);
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: palette.surface,
        borderColor: palette.border,
        textStyle: { color: palette.text, fontSize: 11 },
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        bottom: 0,
        left: "center",
        icon: "circle",
        itemWidth: 7,
        itemHeight: 7,
        textStyle: { color: palette.muted, fontSize: 10 },
      },
      series: [
        {
          type: "pie",
          radius: ["58%", "80%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: palette.surface, borderWidth: 2 },
          label: { show: false },
          data: [
            { name: "Positive", value: data.summary.positive, itemStyle: { color: palette.positive } },
            { name: "Negative", value: data.summary.negative, itemStyle: { color: palette.negative } },
            { name: "Mixed", value: data.summary.mixed, itemStyle: { color: palette.warning } },
            { name: "Neutral", value: data.summary.neutral, itemStyle: { color: palette.muted } },
          ],
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "38%",
          style: {
            text: String(total),
            fill: palette.text,
            fontSize: 24,
            fontFamily: "IBM Plex Mono, monospace",
          },
        },
        {
          type: "text",
          left: "center",
          top: "50%",
          style: { text: "records", fill: palette.muted, fontSize: 9 },
        },
      ],
    };
  }, [data, palette]);

  const activeFilters = [sentiment, country, source, from, to, topic].filter(Boolean).length;

  function reset() {
    setSearch("");
    setSentiment("");
    setCountry("");
    setSource("");
    setTopic(null);
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Voice of customer"
        title="What customers actually said"
        description="Filters run over stored evidence records. Excerpts are verbatim records — never generated quotations."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="outline">{data?.summary.total ?? 0} records</Badge>
            {activeFilters > 0 ? (
              <button type="button" onClick={reset} className="text-[11px] text-muted hover:text-ink">
                Clear filters ({activeFilters})
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="p-5 lg:col-span-4">
          <div className="eyebrow mb-2">Sentiment distribution</div>
          {data ? (
            <EChart option={option} height={260} ariaLabel="Donut chart of sentiment distribution" />
          ) : (
            <LoadingBlock rows={2} />
          )}
          {data ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat label="Positive" value={percent(data.summary.positive, data.summary.total)} hint="of records" tone="positive" />
              <Stat label="Negative" value={percent(data.summary.negative, data.summary.total)} hint="of records" tone="negative" />
            </div>
          ) : null}
        </Panel>

        <Panel className="p-5 lg:col-span-8">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Recurring complaint categories</div>
            <span className="text-[10.5px] text-muted">Select a category to filter the records</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(data?.complaint_categories ?? []).map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setTopic(topic === category.label ? null : category.label)}
                aria-pressed={topic === category.label}
                className={cn(
                  "group flex items-center gap-3 border px-3 py-2 text-left transition-colors",
                  topic === category.label
                    ? "border-navy bg-navy/[0.05]"
                    : "border-line hover:border-muted/40",
                )}
              >
                <span>
                  <span className="block text-[11.5px] text-ink">{category.label}</span>
                  <span className="mono block text-[9px] uppercase tracking-[0.08em] text-muted">
                    {category.negative} negative · {category.count} total
                  </span>
                </span>
                <span className="mono text-[13px] text-muted">{category.count}</span>
              </button>
            ))}
            {data && data.complaint_categories.length === 0 ? (
              <p className="text-[12px] text-muted">No complaint categories reached the evidence threshold.</p>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">What customers praise</div>
              <div className="space-y-1.5">
                {(data?.praise_categories ?? []).slice(0, 4).map((item) => (
                  <div key={item.key} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                    <span className="text-[11.5px] text-muted">{item.label}</span>
                    <span className="mono text-[10px] text-positive">{item.positive}</span>
                  </div>
                ))}
                {data && data.praise_categories.length === 0 ? (
                  <p className="text-[11px] text-muted">No praise cluster crossed the threshold.</p>
                ) : null}
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2">Feature requests</div>
              <div className="space-y-1.5">
                {(data?.feature_requests ?? []).slice(0, 4).map((item) => (
                  <div key={item.key} className="flex items-baseline justify-between gap-3 border-b border-line pb-1.5">
                    <span className="text-[11.5px] text-muted">{item.label}</span>
                    <span className="mono text-[10px] text-navy">{item.count}</span>
                  </div>
                ))}
                {data && data.feature_requests.length === 0 ? (
                  <p className="text-[11px] text-muted">No explicit requests were clustered.</p>
                ) : null}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer discussions"
              aria-label="Search customer discussions"
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
          <Select value={sentiment} onChange={(event) => setSentiment(event.target.value)} aria-label="Sentiment filter" className="w-auto">
            <option value="">All sentiment</option>
            {["positive", "negative", "neutral", "mixed"].map((item) => (
              <option key={item} value={item}>{titleCase(item)}</option>
            ))}
          </Select>
          <Select value={country} onChange={(event) => setCountry(event.target.value)} aria-label="Country filter" className="w-auto">
            <option value="">All countries</option>
            {(data?.facets.countries ?? []).map((facet) => (
              <option key={facet.value} value={facet.value}>{facet.value} ({facet.count})</option>
            ))}
          </Select>
          <Select value={source} onChange={(event) => setSource(event.target.value)} aria-label="Source filter" className="w-auto">
            <option value="">All sources</option>
            {(data?.facets.sources ?? []).map((facet) => (
              <option key={facet.value} value={facet.value}>{titleCase(facet.value)} ({facet.count})</option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" className="w-auto" />
          <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" className="w-auto" />
        </div>
        {topic ? (
          <div className="mt-3 flex items-center gap-2">
            <Badge tone="navy">Topic: {topic}</Badge>
            <button type="button" onClick={() => setTopic(null)} className="text-[10.5px] text-muted hover:text-ink">
              remove
            </button>
          </div>
        ) : null}
      </Panel>

      {voice.isLoading ? (
        <LoadingBlock label="Filtering customer records" rows={4} />
      ) : voice.isError ? (
        <ErrorState message={(voice.error as Error).message} onRetry={() => voice.refetch()} />
      ) : data ? (
        <div>
          <div className="flex items-center justify-between border-b border-line pb-2">
            <div className="eyebrow">Matching records · {data.filtered_total}</div>
            <div className="flex items-center gap-1.5 text-[10.5px] text-muted">
              <Filter className="h-3 w-3" /> filtered view
            </div>
          </div>
          {data.evidence.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-4 w-4" />}
              title="No records match these filters"
              description="Try removing a filter or widening the date range. The explorer only shows stored records."
            />
          ) : (
            <div className="divide-y divide-line">
              {data.evidence.map((record) => (
                <div key={record.id} className="py-4">
                  <EvidenceRecordView record={record} />
                </div>
              ))}
            </div>
          )}
          {data.filtered_total > data.evidence.length ? (
            <p className="mt-4 text-[10.5px] text-muted">
              Showing the first {data.evidence.length} of {data.filtered_total} matching records. Narrow the filters
              or open the evidence centre for the full library.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
