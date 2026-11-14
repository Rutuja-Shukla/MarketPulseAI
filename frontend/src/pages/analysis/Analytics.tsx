import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { ChartNoAxesCombined } from "lucide-react";
import { Panel, SectionHeading } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { EChart, useChartPalette } from "@/components/charts/EChart";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useAnalytics } from "@/hooks/useProjectData";
import { formatMonth, titleCase } from "@/lib/utils";
import type { Analytics } from "@/types";

function useChartOptions(data: Analytics | undefined) {
  const palette = useChartPalette();

  const baseTooltip = {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    textStyle: { color: palette.text, fontSize: 11 },
  };
  const axis = {
    axisLine: { lineStyle: { color: palette.border } },
    axisLabel: { color: palette.muted, fontSize: 9 },
    splitLine: { lineStyle: { color: palette.border, type: "dashed" as const } },
  };

  return useMemo(() => {
    if (!data) return {} as Record<string, EChartsOption>;
    const months = data.sentiment_trend.months.map(formatMonth);

    const sentiment: EChartsOption = {
      tooltip: { trigger: "axis", ...baseTooltip },
      legend: { bottom: 0, icon: "circle", itemWidth: 7, itemHeight: 7, textStyle: { color: palette.muted, fontSize: 10 } },
      grid: { left: 38, right: 18, top: 20, bottom: 56 },
      xAxis: { type: "category", data: months, ...axis, boundaryGap: false },
      yAxis: { type: "value", name: "Records", nameTextStyle: { color: palette.muted, fontSize: 9 }, ...axis },
      series: [
        { name: "Positive", type: "line", smooth: true, data: data.sentiment_trend.positive, lineStyle: { color: palette.positive }, itemStyle: { color: palette.positive }, areaStyle: { color: palette.positive, opacity: 0.12 } },
        { name: "Negative", type: "line", smooth: true, data: data.sentiment_trend.negative, lineStyle: { color: palette.negative }, itemStyle: { color: palette.negative }, areaStyle: { color: palette.negative, opacity: 0.1 } },
        { name: "Neutral / mixed", type: "line", smooth: true, data: data.sentiment_trend.neutral, lineStyle: { color: palette.muted, type: "dashed" }, itemStyle: { color: palette.muted } },
      ],
    };

    const pain: EChartsOption = {
      tooltip: { trigger: "item", ...baseTooltip, formatter: "{b}: {c} negative records" },
      grid: { left: 140, right: 24, top: 10, bottom: 28 },
      xAxis: { type: "value", name: "Records", nameTextStyle: { color: palette.muted, fontSize: 9 }, ...axis },
      yAxis: {
        type: "category",
        inverse: true,
        data: data.pain_points.map((item) => item.topic),
        axisLine: { lineStyle: { color: palette.border } },
        axisLabel: { color: palette.muted, fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          data: data.pain_points.map((item) => item.count),
          itemStyle: { color: palette.negative },
          barWidth: 9,
          label: { show: true, position: "right", color: palette.muted, fontSize: 9 },
        },
      ],
    };

    const benchmark: EChartsOption = {
      tooltip: { ...baseTooltip },
      legend: { bottom: 0, icon: "circle", itemWidth: 7, itemHeight: 7, textStyle: { color: palette.muted, fontSize: 10 } },
      radar: {
        indicator: data.benchmark_dimensions.map((dimension) => ({ name: titleCase(dimension), max: 100 })),
        radius: "62%",
        center: ["50%", "45%"],
        axisName: { color: palette.muted, fontSize: 9 },
        splitLine: { lineStyle: { color: palette.border } },
        splitArea: { areaStyle: { color: ["transparent"] } },
        axisLine: { lineStyle: { color: palette.border } },
      },
      series: [
        {
          type: "radar",
          data: data.benchmark_series.map((series, index) => ({
            name: series.name,
            value: series.values,
            lineStyle: { width: 1.4 },
            areaStyle: { opacity: series.is_primary ? 0.16 : 0.07 },
            itemStyle: { color: [palette.navy, palette.accent, palette.warning, palette.positive][index % 4] },
          })),
        },
      ],
    };

    const matrix: EChartsOption = {
      tooltip: {
        trigger: "item",
        ...baseTooltip,
        formatter: (params: unknown) => {
          const item = params as { data: { name: string; value: [number, number]; quadrant: string } };
          return `${item.data.name}<br/>Effort ${item.data.value[0]} · Impact ${item.data.value[1]}<br/>${titleCase(item.data.quadrant)}`;
        },
      },
      grid: { left: 48, right: 24, top: 24, bottom: 46 },
      xAxis: { type: "value", min: 0, max: 100, name: "Effort", nameTextStyle: { color: palette.muted, fontSize: 9 }, ...axis },
      yAxis: { type: "value", min: 0, max: 100, name: "Impact", nameTextStyle: { color: palette.muted, fontSize: 9 }, ...axis },
      series: [
        {
          type: "scatter",
          symbolSize: 11,
          data: data.opportunity_matrix.map((item) => ({
            name: item.title,
            value: [item.effort, item.impact],
            quadrant: item.quadrant,
            itemStyle: {
              color:
                item.quadrant === "quick_win"
                  ? palette.positive
                  : item.quadrant === "strategic_investment"
                    ? palette.accent
                    : item.quadrant === "long_term"
                      ? palette.warning
                      : palette.muted,
            },
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

    const geography: EChartsOption = {
      tooltip: { trigger: "axis", ...baseTooltip },
      legend: { bottom: 0, icon: "circle", itemWidth: 7, itemHeight: 7, textStyle: { color: palette.muted, fontSize: 10 } },
      grid: { left: 36, right: 18, top: 18, bottom: 54 },
      xAxis: { type: "category", data: data.geography.map((item) => item.country), ...axis },
      yAxis: { type: "value", name: "Records", nameTextStyle: { color: palette.muted, fontSize: 9 }, ...axis },
      series: [
        { name: "Positive", type: "bar", data: data.geography.map((item) => item.positive), itemStyle: { color: palette.positive }, barMaxWidth: 22 },
        { name: "Negative", type: "bar", data: data.geography.map((item) => item.negative), itemStyle: { color: palette.negative }, barMaxWidth: 22 },
      ],
    };

    const sources: EChartsOption = {
      tooltip: { trigger: "item", ...baseTooltip, formatter: "{b}: {c} records ({d}%)" },
      legend: { bottom: 0, icon: "circle", itemWidth: 7, itemHeight: 7, textStyle: { color: palette.muted, fontSize: 9 } },
      series: [
        {
          type: "pie",
          radius: ["42%", "68%"],
          center: ["50%", "44%"],
          label: { show: false },
          itemStyle: { borderColor: palette.surface, borderWidth: 2 },
          data: data.source_distribution.map((item, index) => ({
            name: titleCase(item.source),
            value: item.count,
            itemStyle: {
              color: [palette.navy, palette.accent, palette.positive, palette.warning, palette.negative, palette.muted][index % 6],
            },
          })),
        },
      ],
    };

    const topTopics = [...data.topic_trends].sort((a, b) => b.evidence_count - a.evidence_count).slice(0, 5);
    const topicMonths = Array.from(
      new Set(topTopics.flatMap((topic) => topic.series.map((point) => point.month))),
    ).sort();
    const trends: EChartsOption = {
      tooltip: { trigger: "axis", ...baseTooltip },
      legend: { bottom: 0, icon: "circle", itemWidth: 7, itemHeight: 7, textStyle: { color: palette.muted, fontSize: 9 } },
      grid: { left: 34, right: 18, top: 18, bottom: 62 },
      xAxis: { type: "category", data: topicMonths.map(formatMonth), ...axis, boundaryGap: false },
      yAxis: { type: "value", name: "Mentions", nameTextStyle: { color: palette.muted, fontSize: 9 }, ...axis },
      series: topTopics.map((topic, index) => ({
        name: `${topic.label} (${topic.trend})`,
        type: "line",
        smooth: true,
        data: topicMonths.map(
          (month) => topic.series.find((point) => point.month === month)?.count ?? 0,
        ),
        symbolSize: 4,
        lineStyle: { width: 1.6 },
        itemStyle: {
          color: [palette.navy, palette.accent, palette.positive, palette.warning, palette.negative][index % 5],
        },
      })),
    };

    const timeline: EChartsOption = {
      tooltip: {
        trigger: "item",
        ...baseTooltip,
        formatter: (params: unknown) => {
          const item = params as { data: { name: string; value: [string, string]; source: string; sentiment: string } };
          return `${item.data.value[0]}<br/><strong>${item.data.name}</strong><br/>${item.data.source} · ${item.data.sentiment}`;
        },
      },
      grid: { left: 96, right: 24, top: 18, bottom: 44 },
      xAxis: { type: "time", ...axis, name: "Observed", nameTextStyle: { color: palette.muted, fontSize: 9 } },
      yAxis: {
        type: "category",
        data: data.source_distribution.map((item) => titleCase(item.source)),
        axisLine: { lineStyle: { color: palette.border } },
        axisLabel: { color: palette.muted, fontSize: 9 },
        splitLine: { lineStyle: { color: palette.border, type: "dashed" } },
      },
      series: [
        {
          type: "scatter",
          symbolSize: 8,
          data: data.timeline.map((item) => ({
            name: item.label,
            value: [item.date, titleCase(item.category).replace("Review Platform", "Review"), item.sentiment],
            source: item.source,
            sentiment: item.sentiment,
            itemStyle: {
              color:
                item.sentiment === "positive"
                  ? palette.positive
                  : item.sentiment === "negative"
                    ? palette.negative
                    : item.sentiment === "mixed"
                      ? palette.warning
                      : palette.muted,
              opacity: 0.85,
            },
          })),
        },
      ],
    };

    return { sentiment, pain, benchmark, matrix, geography, sources, trends, timeline };
  }, [data, palette]);
}

function ChartPanel({
  title,
  explanation,
  children,
  empty,
}: {
  title: string;
  explanation: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] leading-snug">{title}</h3>
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{explanation}</p>
      <div className="mt-3">
        {empty ? (
          <div className="flex h-[240px] items-center justify-center border border-dashed border-line text-[11.5px] text-muted">
            No records for this chart in the current run.
          </div>
        ) : (
          children
        )}
      </div>
    </Panel>
  );
}

export default function AnalyticsPage() {
  const { project } = useAnalysisContext();
  const query = useAnalytics(project.id);
  const options = useChartOptions(query.data);

  if (query.isLoading) return <LoadingBlock label="Computing analytics" rows={4} />;
  if (query.isError) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Analytics" title="Market analytics" />
        <Panel>
          <EmptyState
            icon={<ChartNoAxesCombined className="h-4 w-4" />}
            title="No analytics yet"
            description="Charts are computed from stored evidence. Run the analysis to populate this page."
          />
        </Panel>
        {query.error ? (
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
        ) : null}
      </div>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Market analytics"
        title="Eight views of the same evidence"
        description="Every value is aggregated from stored records. No chart is padded with sample values; sparse data produces sparse charts."
        actions={
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted">
            {data.totals.evidence} records · {data.totals.sources} source categories
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartPanel
          title="Sentiment over time"
          explanation="Monthly counts of positive, negative and neutral/mixed records across the research period."
          empty={data.sentiment_trend.months.length === 0}
        >
          <EChart option={options.sentiment} height={300} ariaLabel="Line chart of sentiment over time" />
        </ChartPanel>

        <ChartPanel
          title="Customer pain-point distribution"
          explanation="Negative records grouped by topic. A single record counts once per topic it mentions."
          empty={data.pain_points.length === 0}
        >
          <EChart option={options.pain} height={300} ariaLabel="Bar chart of customer pain points" />
        </ChartPanel>

        <ChartPanel
          title="Competitor benchmarking"
          explanation="Sentiment indices across dimensions, only where records mention that company and topic."
          empty={data.benchmark_series.length === 0}
        >
          <EChart option={options.benchmark} height={320} ariaLabel="Radar chart comparing companies across dimensions" />
        </ChartPanel>

        <ChartPanel
          title="Opportunity vs effort"
          explanation="AI-assisted prioritisation. High impact and low effort sits in the upper-left quadrant."
          empty={data.opportunity_matrix.length === 0}
        >
          <EChart option={options.matrix} height={320} ariaLabel="Scatter chart of opportunity impact against effort" />
        </ChartPanel>

        <ChartPanel
          title="Geographic comparison"
          explanation="Record volume by country, split by sentiment direction. Countries with few records are still shown."
          empty={data.geography.length === 0}
        >
          <EChart option={options.geography} height={300} ariaLabel="Bar chart comparing countries by positive and negative records" />
        </ChartPanel>

        <ChartPanel
          title="Feedback source distribution"
          explanation="How the collected evidence is distributed across source categories."
          empty={data.source_distribution.length === 0}
        >
          <EChart option={options.sources} height={300} ariaLabel="Donut chart of evidence by source category" />
        </ChartPanel>

        <ChartPanel
          title="Topic trend analysis"
          explanation="Monthly mentions for the five largest topics. Emerging and declining labels come from first-half versus second-half volume."
          empty={data.topic_trends.length === 0}
        >
          <EChart option={options.trends} height={300} ariaLabel="Multi-line chart of topic mentions over time" />
        </ChartPanel>

        <ChartPanel
          title="Market signal timeline"
          explanation="When each record was observed, grouped by source category and coloured by sentiment."
          empty={data.timeline.length === 0}
        >
          <EChart option={options.timeline} height={300} ariaLabel="Timeline scatter plot of market signals" />
        </ChartPanel>
      </div>

      <div className="border-t border-line pt-4">
        <p className="max-w-[80ch] text-[10.5px] leading-relaxed text-muted">
          Sentiment is classified with a transparent lexicon model blended with published star ratings where
          available. Topic counts reflect keyword classification over the collected corpus, not a census of all
          customer opinion. Demonstration projects use synthetic records.
        </p>
      </div>
    </div>
  );
}
