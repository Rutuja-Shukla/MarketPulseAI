import { useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessageSquare, Play } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ProjectNav } from "@/components/layout/ProjectNav";
import { AssistantPanel } from "@/features/assistant/AssistantPanel";
import { Badge, DemoBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingBlock, ProgressBar } from "@/components/ui/Feedback";
import { useProjectDetail, useProjectStatus } from "@/hooks/useProjectData";
import { api } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/utils";
import type { ProjectStatusResponse } from "@/types";

export default function AnalysisLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const detail = useProjectDetail(projectId);
  const status = useProjectStatus(projectId);
  const queueState = (location.state as { queueError?: string } | null) ?? null;

  const running = status.data?.status === "running" || status.data?.status === "queued";
  const liveStatus = useProjectStatus(projectId, true);

  const startRun = useMutation({
    mutationFn: () => api.post(`/projects/${projectId}/run`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-status", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  if (detail.isLoading) {
    return (
      <AppShell>
        <LoadingBlock label="Loading research project" rows={4} />
      </AppShell>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <AppShell>
        <ErrorState
          message={(detail.error as Error)?.message ?? "Research project not found"}
          onRetry={() => detail.refetch()}
        />
      </AppShell>
    );
  }

  const project = detail.data.project;
  const currentStatus: ProjectStatusResponse | undefined = liveStatus.data ?? status.data;
  const countries = project.countries.length ? project.countries.join(", ") : project.global_scope ? "Global" : "—";

  return (
    <AppShell>
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link to="/dashboard" className="link-underline inline-flex text-[11px] uppercase tracking-[0.1em] text-muted">
          <ArrowLeft className="h-3 w-3" /> Workspace
        </Link>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAssistantOpen(true)}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
          >
            Ask the research
          </Button>
        </div>
      </div>

      <header className="no-print mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={project.status} />
          <Badge tone="outline">{titleCase(project.mode)}</Badge>
          {project.is_demo ? <DemoBadge /> : <Badge tone="positive">Live sources</Badge>}
          <span className="mono text-[10px] uppercase tracking-[0.1em] text-muted">
            {countries} · {formatDate(project.created_at)}
          </span>
        </div>
        <h1 className="headline mt-4 max-w-3xl">{project.name}</h1>
        <p className="mt-3 max-w-[70ch] text-[13px] leading-relaxed text-muted">
          {project.company_name}
          {project.product_name ? ` · ${project.product_name}` : ""} — {project.evidence_count} evidence
          records, {project.failure_count} weaknesses, {project.opportunity_count} opportunities.
        </p>
      </header>

      {project.is_demo ? (
        <div className="no-print mt-6 border border-warning/30 bg-warning/[0.05] px-4 py-3">
          <span className="mono text-[10px] uppercase tracking-[0.12em] text-warning">Demo data</span>
          <span className="ml-3 text-[12px] text-muted">
            Illustrative findings from a synthetic corpus. Not live market research.
          </span>
        </div>
      ) : null}

      {queueState?.queueError ? (
        <div className="mt-6 border border-negative/30 bg-negative/[0.04] px-4 py-3 text-[12px] text-negative">
          {queueState.queueError}
        </div>
      ) : null}

      {(project.status === "draft" || project.status === "failed") && !running ? (
        <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-4 border border-line bg-subtle/50 px-4 py-3">
          <div>
            <div className="text-[12.5px] text-ink">
              {project.status === "failed" ? "The last research run did not complete." : "This project has not been analysed yet."}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              {project.error_message ?? "Queue the research run to generate findings, charts and the report."}
            </p>
          </div>
          <Button size="sm" onClick={() => startRun.mutate()} loading={startRun.isPending} icon={<Play className="h-3.5 w-3.5" />}>
            Run analysis
          </Button>
        </div>
      ) : null}

      {running && currentStatus ? (
        <div className="no-print mt-6 border border-line bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Research in progress</div>
              <div className="mt-1 text-[13px] text-ink">
                {currentStatus.tasks.find((task) => task.status === "running")?.name ?? "Preparing the pipeline"}
              </div>
            </div>
            <span className="mono text-[11px] text-muted">{currentStatus.progress}%</span>
          </div>
          <ProgressBar value={currentStatus.progress} className="mt-3" />
          <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {currentStatus.tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-[11px]">
                <span
                  className={
                    task.status === "completed"
                      ? "h-1.5 w-1.5 rounded-full bg-positive"
                      : task.status === "running"
                        ? "h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                        : task.status === "failed"
                          ? "h-1.5 w-1.5 rounded-full bg-negative"
                          : "h-1.5 w-1.5 rounded-full bg-line"
                  }
                  aria-hidden
                />
                <span className={task.status === "pending" ? "text-muted" : "text-ink"}>{task.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted">
            You can navigate while research runs. Pages refresh when the run completes.
          </p>
        </div>
      ) : null}

      <div className="mt-6">
        <ProjectNav projectId={project.id} />
      </div>

      <div className="py-8">
        <Outlet context={{ project, detail: detail.data, currentStatus }} />
      </div>

      {projectId ? <AssistantPanel projectId={projectId} open={assistantOpen} onClose={() => setAssistantOpen(false)} /> : null}
    </AppShell>
  );
}
