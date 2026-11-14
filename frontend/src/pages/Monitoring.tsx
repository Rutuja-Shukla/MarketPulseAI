import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDot, Play, Radar, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionHeading, Stat } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import { formatDate, formatRelative, titleCase } from "@/lib/utils";
import type { Catalog, MonitoringEntry, MonitoringList, Project } from "@/types";

const INTERVALS = ["daily", "weekly", "fortnightly", "monthly"];

export function MonitoringPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const monitoring = useQuery({
    queryKey: ["monitoring"],
    queryFn: () => api.get<MonitoringList>("/monitoring"),
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<{ projects: Project[]; total: number }>("/projects"),
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => api.get<Catalog>("/meta/catalog") });

  const save = useMutation({
    mutationFn: (input: { projectId: string; enabled: boolean; interval: string; track: string[] }) =>
      api.post(`/projects/${input.projectId}/monitoring`, {
        enabled: input.enabled,
        interval: input.interval,
        track: input.track,
      }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save monitoring"),
  });

  const runNow = useMutation({
    mutationFn: (projectId: string) => api.post(`/projects/${projectId}/monitoring/run`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["monitoring"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Monitor run failed"),
  });

  const completed = (projects.data?.projects ?? []).filter((project) => project.status === "completed");
  const monitoredIds = new Set((monitoring.data?.entries ?? []).map((entry) => entry.project.id));
  const unmonitored = completed.filter((project) => !monitoredIds.has(project.id));

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="eyebrow">Market change monitor</div>
          <h1 className="headline mt-3">Keep watching, honestly.</h1>
          <p className="mt-3 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
            Monitoring compares new research runs against the last check. Without a live search provider,
            checks are recorded as manual summaries of stored records — the interface says so rather than
            implying continuous data collection.
          </p>
        </div>
      </div>

      {error ? <p className="mt-4 text-[11.5px] text-negative">{error}</p> : null}

      {monitoring.isLoading ? (
        <div className="mt-10">
          <LoadingBlock label="Loading monitoring" rows={3} />
        </div>
      ) : monitoring.isError ? (
        <div className="mt-10">
          <ErrorState message={(monitoring.error as Error).message} onRetry={() => monitoring.refetch()} />
        </div>
      ) : monitoring.data && monitoring.data.entries.length === 0 ? (
        <Panel className="mt-8">
          <EmptyState
            icon={<Radar className="h-4 w-4" />}
            title="Nothing is being monitored yet"
            description="Complete a research project, then configure how often its signals should be checked."
            action={
              completed.length > 0 ? (
                <Button
                  onClick={() =>
                    save.mutate({
                      projectId: completed[0].id,
                      enabled: true,
                      interval: "weekly",
                      track: ["sentiment", "complaints", "competitor", "opportunities"],
                    })
                  }
                  loading={save.isPending}
                >
                  Monitor {completed[0].company_name}
                </Button>
              ) : (
                <Link to="/research/new">
                  <Button>Start an analysis</Button>
                </Link>
              )
            }
          />
        </Panel>
      ) : null}

      <div className="mt-8 space-y-6">
        {(monitoring.data?.entries ?? []).map(({ project, monitoring: entry }) => (
          <MonitorCard
            key={entry.id}
            entry={entry}
            projectName={project.name}
            companyName={project.company_name}
            isDemo={project.is_demo}
            projectId={project.id}
            onSave={(patch) => save.mutate({ projectId: project.id, ...patch })}
            onRun={() => runNow.mutate(project.id)}
            running={runNow.isPending}
            catalog={catalog.data}
            saving={save.isPending}
          />
        ))}
      </div>

      {unmonitored.length > 0 ? (
        <section className="mt-12">
          <SectionHeading
            eyebrow="Available projects"
            title="Add a project to monitoring"
            description="Only completed analyses can be monitored."
          />
          <div className="mt-4 divide-y divide-line border-y border-line">
            {unmonitored.map((project) => (
              <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-[12.5px] text-ink">{project.name}</div>
                  <div className="text-[10.5px] text-muted">
                    {project.company_name} · {project.evidence_count} records · completed {formatRelative(project.completed_at)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    save.mutate({
                      projectId: project.id,
                      enabled: true,
                      interval: "weekly",
                      track: ["sentiment", "complaints", "competitor", "opportunities"],
                    })
                  }
                  loading={save.isPending}
                >
                  Enable monitoring
                </Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}

function MonitorCard({
  entry,
  projectName,
  companyName,
  projectId,
  isDemo,
  onSave,
  onRun,
  running,
  catalog,
  saving,
}: {
  entry: MonitoringEntry;
  projectName: string;
  companyName: string;
  projectId: string;
  isDemo: boolean;
  onSave: (patch: { enabled: boolean; interval: string; track: string[] }) => void;
  onRun: () => void;
  running: boolean;
  catalog?: Catalog;
  saving: boolean;
}) {
  const [enabled, setEnabled] = useState(entry.enabled);
  const [interval, setInterval] = useState(entry.interval);
  const [track, setTrack] = useState<string[]>(entry.track);
  const summary = entry.change_summary;
  const dirty = enabled !== entry.enabled || interval !== entry.interval || track.join(",") !== entry.track.join(",");

  return (
    <Panel className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/analysis/${projectId}/overview`} className="text-[15px] text-ink hover:text-navy">
              {companyName}
            </Link>
            <Badge tone={enabled ? "positive" : "neutral"}>{enabled ? "Monitoring" : "Paused"}</Badge>
            <Badge tone={entry.execution_mode === "automated" ? "positive" : "warning"}>
              {entry.execution_mode}
            </Badge>
            {isDemo ? <Badge tone="warning">demo data</Badge> : null}
          </div>
          <p className="mt-1 text-[11px] text-muted">{projectName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRun} loading={running} icon={<Play className="h-3.5 w-3.5" />}>
            Run check now
          </Button>
          <Button size="sm" disabled={!dirty} loading={saving} onClick={() => onSave({ enabled, interval, track })}>
            Save
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-px border border-line bg-line sm:grid-cols-4">
        <div className="bg-paper px-4 py-4">
          <Stat label="Positive share" value={`${summary.sentiment_positive_share}%`} hint="all stored records" />
        </div>
        <div className="bg-paper px-4 py-4">
          <Stat label="Recent share" value={`${summary.sentiment_recent_share}%`} hint="latest third of records" />
        </div>
        <div className="bg-paper px-4 py-4">
          <Stat
            label="Delta"
            value={`${summary.sentiment_delta > 0 ? "+" : ""}${summary.sentiment_delta}`}
            hint="recent vs overall"
            tone={summary.sentiment_delta > 0 ? "positive" : summary.sentiment_delta < 0 ? "negative" : "default"}
          />
        </div>
        <div className="bg-paper px-4 py-4">
          <Stat label="New records" value={summary.new_records} hint="since the last check" />
        </div>
      </div>

      <p className="mt-3 border border-line bg-subtle/40 px-3 py-2 text-[10.5px] leading-relaxed text-muted">
        {summary.notice}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="eyebrow mb-2">Schedule &amp; tracks</div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[11px] text-muted">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="accent-[var(--mp-navy)]" />
              Enabled
            </label>
            <select
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              aria-label="Monitoring interval"
              className="border border-line bg-paper px-2 py-1 text-[11px]"
            >
              {INTERVALS.map((item) => (
                <option key={item} value={item}>{titleCase(item)}</option>
              ))}
            </select>
            <span className="mono text-[9.5px] uppercase tracking-[0.08em] text-muted">
              next {formatDate(entry.next_run_at)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(catalog?.monitoring_tracks ?? []).map((option) => {
              const active = track.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTrack(active ? track.filter((item) => item !== option.key) : [...track, option.key])}
                  className={
                    active
                      ? "border border-navy/30 bg-navy/[0.05] px-2 py-1 text-[10.5px] text-navy"
                      : "border border-line px-2 py-1 text-[10.5px] text-muted hover:text-ink"
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-muted">
            Last check {formatRelative(entry.last_run_at)} · interval {entry.interval}
          </p>
        </div>

        <div className="lg:col-span-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="eyebrow mb-2">Complaint watch</div>
              {summary.complaint_watch.length ? (
                <ul className="space-y-1.5">
                  {summary.complaint_watch.map((item) => (
                    <li key={item.title} className="flex items-start gap-2 text-[11px] leading-snug text-muted">
                      <CircleDot className="mt-1 h-2.5 w-2.5 shrink-0 text-negative" />
                      <span>
                        {item.title}
                        <span className="mono ml-1 text-[9px] uppercase">{item.severity}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted">No weakness findings recorded.</p>
              )}
            </div>
            <div>
              <div className="eyebrow mb-2">Opportunity watch</div>
              {summary.opportunity_watch.length ? (
                <ul className="space-y-1.5">
                  {summary.opportunity_watch.map((item) => (
                    <li key={item.title} className="flex items-start gap-2 text-[11px] leading-snug text-muted">
                      <TrendingUp className="mt-1 h-2.5 w-2.5 shrink-0 text-positive" />
                      <span>
                        {item.title}
                        <span className="mono ml-1 text-[9px] uppercase">impact {Math.round(item.impact)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted">No opportunities recorded.</p>
              )}
            </div>
          </div>
          {summary.latest_signal ? (
            <div className="mt-4 border border-line px-3 py-2">
              <div className="eyebrow mb-1">Latest observed signal</div>
              <div className="text-[11.5px] text-ink">{summary.latest_signal.title}</div>
              <div className="mono text-[9.5px] uppercase tracking-[0.08em] text-muted">
                {summary.latest_signal.source} · {formatDate(summary.latest_signal.date)} · {summary.latest_signal.sentiment}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
