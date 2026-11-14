import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Printer, RefreshCw } from "lucide-react";
import { Badge, DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, SectionHeading } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/Feedback";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useReport } from "@/hooks/useProjectData";
import { api, openAuthenticated } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Report } from "@/types";

function SectionBody({ section }: { section: Report["sections"][number] }) {
  if (section.type === "metrics") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
        {(section.items ?? []).map((item) => (
          <div key={item.title} className="bg-paper px-4 py-3">
            <div className="eyebrow">{item.title}</div>
            <div className="mono mt-1 text-[18px] leading-none">{item.body}</div>
          </div>
        ))}
      </div>
    );
  }
  if (section.type === "references") {
    return (
      <ol className="mt-4 space-y-3">
        {(section.items ?? []).map((item, index) => (
          <li key={`${item.title}-${index}`} className="text-[11.5px] leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="mono mt-0.5 text-[9.5px] text-muted">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <div className="text-ink">{item.title}</div>
                <div className="mono text-[9px] uppercase tracking-[0.08em] text-muted">{item.meta}</div>
                {item.body ? <p className="mt-1 text-muted">{item.body}</p> : null}
                {item.url ? (
                  <span className="text-[10px] text-muted">
                    {item.url.includes("demo.marketpulse.ai") ? "synthetic source (demo)" : item.url}
                  </span>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
    );
  }
  if (section.type === "list") {
    return (
      <div className="mt-4 space-y-4">
        {(section.items ?? []).map((item, index) => (
          <div key={`${item.title}-${index}`} className="border-l-2 border-line pl-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-[13.5px] leading-snug">{item.title}</h4>
              {item.meta ? (
                <span className="mono text-[9px] uppercase tracking-[0.08em] text-muted">{item.meta}</span>
              ) : null}
            </div>
            {item.body ? <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p> : null}
            {item.quote ? (
              <p className="mt-1 text-[11px] italic leading-relaxed text-muted">{item.quote}</p>
            ) : null}
          </div>
        ))}
      </div>
    );
  }
  return <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{section.body}</p>;
}

export default function ReportPage() {
  const { project } = useAnalysisContext();
  const query = useReport(project.id);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const regenerate = useMutation({
    mutationFn: () => api.post<Report>(`/projects/${project.id}/report/regenerate`),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["report", project.id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Report generation failed"),
  });

  if (query.isLoading) return <LoadingBlock label="Loading report" rows={5} />;
  if (query.isError && (query.error as { status?: number })?.status !== 404) {
    return <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />;
  }
  const report = query.data;

  if (!report) {
    return (
      <Panel>
        <EmptyState
          icon={<FileText className="h-4 w-4" />}
          title="No report has been generated"
          description="The executive report is generated after the evidence pipeline completes. Run the analysis, or generate a report now if evidence already exists."
          action={
            <div className="flex flex-col items-center gap-3">
              <Button onClick={() => regenerate.mutate()} loading={regenerate.isPending}>
                Generate report
              </Button>
              {error ? <p className="text-[11.5px] text-negative">{error}</p> : null}
            </div>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Executive intelligence report"
          title="The deliverable"
          description="Separates observed evidence, interpretation, hypothesis and recommendation. Print-optimised for PDF."
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            loading={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            Regenerate
          </Button>
          <Button
            size="sm"
            variant="outline"
            icon={<Printer className="h-3.5 w-3.5" />}
            onClick={() => window.print()}
          >
            Print
          </Button>
          <Button
            size="sm"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={async () => {
              setError(null);
              try {
                await openAuthenticated(`/projects/${project.id}/report/export`);
              } catch (err) {
                setError(err instanceof Error ? err.message : "PDF export failed");
              }
            }}
          >
            Download PDF
          </Button>
        </div>
      </div>
      {error ? <p className="no-print text-[11.5px] text-negative">{error}</p> : null}

      <article className="print-page border border-line bg-paper px-6 py-10 md:px-14 md:py-14">
        <header className="border-b border-line pb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="mono text-[9.5px] uppercase tracking-[0.18em] text-muted">
              MarketPulse AI · version {report.version} · {report.provider}
            </span>
            {report.is_demo ? <DemoBadge /> : <Badge tone="positive">Live evidence</Badge>}
          </div>
          <h1 className="mt-6 max-w-[28ch] font-serif text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.08]">
            {report.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10.5px] text-muted">
            <span>{project.company_name}</span>
            <span>·</span>
            <span>{formatDate(report.generated_at)}</span>
            <span>·</span>
            <span>{project.evidence_count} evidence records</span>
            <span>·</span>
            <span>{project.countries.join(", ") || "Global"}</span>
          </div>
          {report.is_demo ? (
            <p className="mt-5 border border-warning/40 bg-warning/[0.06] px-4 py-2.5 text-[11px] leading-relaxed text-warning">
              DEMO DATA — illustrative findings generated from a synthetic corpus. Not live market research.
            </p>
          ) : null}
        </header>

        <section className="mt-8">
          <h2 className="text-[20px]">Executive summary</h2>
          <p className="mt-3 max-w-[80ch] font-serif text-[16px] leading-[1.65] text-ink">
            {report.executive_summary}
          </p>
        </section>

        {report.sections.map((section) => (
          <section key={section.key} className="mt-9 break-inside-avoid">
            <div className="flex items-baseline gap-3 border-b border-line pb-1.5">
              <h2 className="text-[18px]">{section.title}</h2>
            </div>
            {section.body && section.type !== "metrics" ? (
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{section.body}</p>
            ) : null}
            <SectionBody section={section} />
          </section>
        ))}

        <section className="mt-10 border-t border-line pt-5">
          <h2 className="text-[18px]">Research limitations</h2>
          <ul className="mt-3 space-y-1.5">
            {report.limitations.map((limitation) => (
              <li key={limitation} className="text-[11px] leading-relaxed text-muted">· {limitation}</li>
            ))}
          </ul>
        </section>

        <footer className="mt-10 border-t border-line pt-4">
          <p className="text-[9.5px] leading-relaxed text-muted">
            Generated by MarketPulse AI from {report.reference_ids.length} referenced evidence records. Findings
            are interpretations of public evidence and do not constitute financial advice. Prepared for internal
            strategic discussion.
          </p>
        </footer>
      </article>
    </div>
  );
}
