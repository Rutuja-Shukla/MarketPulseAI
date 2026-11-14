import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CircleDot,
  Compass,
  FileText,
  Gauge,
  Plus,
  Radar,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge, DemoBadge, StatusBadge } from "@/components/ui/Badge";
import { Panel, SectionHeading, Stat } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock, ProgressBar } from "@/components/ui/Feedback";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { formatRelative, percent, titleCase } from "@/lib/utils";
import type { DashboardData, MonitoringList } from "@/types";

const quickStart = [
  {
    mode: "quick",
    label: "Quick scan",
    description: "Headline sentiment and top three weaknesses. Ten stages, one pass.",
    icon: Gauge,
  },
  {
    mode: "standard",
    label: "Standard analysis",
    description: "Customer, competitor and market analysis with full validation.",
    icon: Radar,
  },
  {
    mode: "deep",
    label: "Deep intelligence",
    description: "Extended investigation with trend and contradiction analysis.",
    icon: Sparkles,
  },
];

export function DashboardPage() {
  const { user, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [demoBusy, setDemoBusy] = useState(false);

  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/dashboard"),
    refetchInterval: (query) =>
      query.state.data?.recent_projects.some((project) => project.status === "running" || project.status === "queued")
        ? 4000
        : false,
  });
  const monitoring = useQuery({
    queryKey: ["monitoring"],
    queryFn: () => api.get<MonitoringList>("/monitoring"),
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = user?.full_name?.split(" ")[0] ?? "analyst";
  const data = dashboard.data;

  async function loadDemo() {
    setDemoBusy(true);
    try {
      await demoLogin();
      await dashboard.refetch();
      await monitoring.refetch();
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow">Workspace</div>
          <h1 className="headline mt-3">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-3 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
            {data && data.metrics.projects > 0
              ? "Your research record, the risks it surfaced and the opportunities still open."
              : "Start with a question about your market. The studio turns it into a structured, evidence-led investigation."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/research/new">
            <Button icon={<Plus className="h-4 w-4" />}>Start an analysis</Button>
          </Link>
        </div>
      </div>

      {data && !data.live_research_available ? (
        <div className="mt-8 flex flex-wrap items-center gap-3 border border-warning/30 bg-warning/[0.05] px-4 py-3">
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-warning">Demonstration only</span>
          <span className="text-[12px] text-muted">
            No search provider is configured, so research runs on the synthetic corpus. Live research becomes
            available when a provider key is set.
          </span>
        </div>
      ) : null}

      {dashboard.isLoading ? (
        <div className="mt-10">
          <LoadingBlock label="Loading workspace" rows={4} />
        </div>
      ) : dashboard.isError ? (
        <div className="mt-10">
          <ErrorState message={(dashboard.error as Error).message} onRetry={() => dashboard.refetch()} />
        </div>
      ) : data ? (
        <>
          <div className="mt-9 grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
            {[
              {
                label: "Research projects",
                value: data.metrics.projects,
                hint: `${data.metrics.completed} completed`,
                tone: "default" as const,
              },
              {
                label: "Evidence records",
                value: data.metrics.evidence,
                hint: "Stored, attributed and deduplicated",
                tone: "default" as const,
              },
              {
                label: "Critical risks",
                value: data.metrics.critical_risks,
                hint: `${data.metrics.failures} weaknesses identified`,
                tone: data.metrics.critical_risks > 0 ? ("negative" as const) : ("default" as const),
              },
              {
                label: "Opportunities",
                value: data.metrics.opportunities,
                hint: "With demand evidence attached",
                tone: "positive" as const,
              },
            ].map((item) => (
              <div key={item.label} className="bg-paper px-5 py-6">
                <Stat label={item.label} value={item.value} hint={item.hint} tone={item.tone} />
              </div>
            ))}
          </div>

          {data.metrics.projects === 0 ? (
            <Panel className="mt-8">
              <EmptyState
                icon={<Compass className="h-4 w-4" />}
                title="No research yet — begin with one question"
                description="Define a company, a market and the assumptions you want tested. Or load the demonstration workspace to see a completed analysis with a synthetic dataset."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link to="/research/new">
                      <Button icon={<Plus className="h-4 w-4" />}>Create your first analysis</Button>
                    </Link>
                    <Button variant="outline" onClick={loadDemo} loading={demoBusy}>
                      Load demonstration workspace
                    </Button>
                  </div>
                }
              />
            </Panel>
          ) : null}

          <div className="mt-10 grid gap-8 lg:grid-cols-12">
            <section className="lg:col-span-8">
              <SectionHeading
                eyebrow="Research record"
                title="Recent research"
                description="Every project keeps its configuration, evidence and findings."
                actions={
                  <Link to="/research/new" className="link-underline text-[12.5px] text-navy">
                    New analysis <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="mt-5 divide-y divide-line border-y border-line">
                {data.recent_projects.length === 0 ? (
                  <p className="py-10 text-center text-[12.5px] text-muted">
                    Projects appear here once you start one.
                  </p>
                ) : (
                  data.recent_projects.map((project) => (
                    <Link
                      key={project.id}
                      to={
                        project.status === "completed"
                          ? `/analysis/${project.id}/overview`
                          : `/analysis/${project.id}/overview`
                      }
                      className="group flex flex-wrap items-center justify-between gap-4 py-4 transition-colors hover:bg-subtle/60"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] text-ink group-hover:text-navy">{project.name}</span>
                          <StatusBadge status={project.status} />
                          {project.is_demo ? <DemoBadge /> : null}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
                          <span>{project.company_name}</span>
                          <span aria-hidden>·</span>
                          <span className="mono uppercase tracking-[0.06em]">{titleCase(project.mode)}</span>
                          <span aria-hidden>·</span>
                          <span>{project.evidence_count} records</span>
                          <span aria-hidden>·</span>
                          <span>{formatRelative(project.created_at)}</span>
                        </div>
                        {project.status === "running" || project.status === "queued" ? (
                          <div className="mt-2 flex items-center gap-3">
                            <ProgressBar value={project.progress} className="w-[180px]" />
                            <span className="mono text-[10px] text-muted">{project.progress}%</span>
                          </div>
                        ) : null}
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  ))
                )}
              </div>

              <div className="mt-12">
                <SectionHeading
                  eyebrow="Deliverables"
                  title="Latest intelligence reports"
                  description="Generated from stored findings, not from a chat transcript."
                />
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {data.completed_projects.length === 0 ? (
                    <Panel className="sm:col-span-2">
                      <EmptyState
                        icon={<FileText className="h-4 w-4" />}
                        title="No completed reports yet"
                        description="Finish a research run to generate the executive report, roadmap and evidence references."
                      />
                    </Panel>
                  ) : (
                    data.completed_projects.map((project) => (
                      <Panel key={project.id} className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
                            Report · {project.company_name}
                          </span>
                          {project.is_demo ? <DemoBadge /> : <Badge tone="positive">Completed</Badge>}
                        </div>
                        <h3 className="mt-3 text-[17px] leading-snug">{project.name}</h3>
                        <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted">
                          {project.summary ?? "Open the report to review the executive summary."}
                        </p>
                        <Link
                          to={`/analysis/${project.id}/report`}
                          className="link-underline mt-4 inline-flex text-[12px] text-navy"
                        >
                          Open report <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Panel>
                    ))
                  )}
                </div>
              </div>
            </section>

            <aside className="space-y-8 lg:col-span-4">
              <div>
                <SectionHeading eyebrow="Quick start" title="Choose a depth" />
                <div className="mt-5 space-y-3">
                  {quickStart.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.mode}
                        to={`/research/new?mode=${item.mode}`}
                        className="group flex items-start gap-3 border border-line bg-paper p-4 transition-colors hover:border-muted/40"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-navy" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[12.5px] text-ink">{item.label}</span>
                          <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
                            {item.description}
                          </span>
                        </span>
                        <ArrowUpRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div>
                <SectionHeading
                  eyebrow="Monitoring"
                  title="Market watch"
                  actions={
                    <Link to="/monitoring" className="link-underline text-[11.5px] text-navy">
                      All
                    </Link>
                  }
                />
                <Panel className="mt-5">
                  {monitoring.data && monitoring.data.entries.length > 0 ? (
                    <div className="divide-y divide-line">
                      {monitoring.data.entries.slice(0, 3).map((entry) => (
                        <Link
                          key={entry.monitoring.id}
                          to={`/analysis/${entry.project.id}/analytics`}
                          className="block px-4 py-3 transition-colors hover:bg-subtle/60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12px] text-ink">{entry.project.company_name}</span>
                            <Badge tone={entry.monitoring.enabled ? "positive" : "neutral"}>
                              {entry.monitoring.enabled ? entry.monitoring.interval : "paused"}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10.5px] text-muted">
                            <span>Positive share {entry.monitoring.change_summary.sentiment_positive_share}%</span>
                            <span aria-hidden>·</span>
                            <span>{entry.monitoring.change_summary.new_records} new</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<TrendingUp className="h-4 w-4" />}
                      title="Nothing monitored yet"
                      description="Completed projects can be watched for sentiment and complaint changes."
                      action={
                        <Link to="/monitoring">
                          <Button size="sm" variant="outline">
                            Configure monitoring
                          </Button>
                        </Link>
                      }
                    />
                  )}
                </Panel>
              </div>

              <div>
                <SectionHeading eyebrow="Notifications" title="Latest activity" />
                <div className="mt-5 space-y-3">
                  {data.notifications.length === 0 ? (
                    <p className="text-[12px] text-muted">No activity recorded yet.</p>
                  ) : (
                    data.notifications.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex items-start gap-3 border-b border-line pb-3 last:border-b-0">
                        <CircleDot className="mt-1 h-3 w-3 shrink-0 text-accent" aria-hidden />
                        <div className="min-w-0">
                          <div className="text-[12px] text-ink">{item.title}</div>
                          <div className="text-[10.5px] text-muted">
                            {formatRelative(item.created_at)}
                            {item.body ? ` · ${item.body.slice(0, 80)}` : ""}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>

          {data.recent_projects.length > 0 ? (
            <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <p className="text-[11.5px] text-muted">
                Completed analyses: {percent(data.metrics.completed, data.metrics.projects)}% of your research record.
              </p>
              <button
                type="button"
                className="text-[11.5px] text-muted hover:text-ink"
                onClick={() => navigate("/research/new")}
              >
                Start another analysis →
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}
