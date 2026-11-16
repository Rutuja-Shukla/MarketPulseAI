import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleAlert,
  FileText,
  GitBranch,
  Lightbulb,
  Users,
} from "lucide-react";
import { Badge, DemoBadge, SeverityBadge } from "@/components/ui/Badge";
import { Panel, SectionHeading, Stat } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useFailures, useOpportunities } from "@/hooks/useProjectData";
import { countryName, formatDate, percent, titleCase } from "@/lib/utils";
import type { Catalog } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

const sections = [
  {
    slug: "failures",
    title: "Failure radar",
    description: "Where the product is underperforming, with severity and evidence.",
    icon: CircleAlert,
  },
  {
    slug: "opportunities",
    title: "Opportunity radar",
    description: "Unmet needs and expansion paths, scored for impact and effort.",
    icon: Lightbulb,
  },
  {
    slug: "customer-voice",
    title: "Customer voice",
    description: "Sentiment, recurring complaints, praise and feature requests.",
    icon: Users,
  },
  {
    slug: "intelligence-graph",
    title: "Intelligence graph",
    description: "How complaints, risks and opportunities connect.",
    icon: GitBranch,
  },
  {
    slug: "analytics",
    title: "Analytics",
    description: "Eight chart sets computed from stored records.",
    icon: ChartNoAxesCombined,
  },
  {
    slug: "report",
    title: "Executive report",
    description: "The consulting-style deliverable, exportable to PDF.",
    icon: FileText,
  },
];

export default function Overview() {
  const { project, detail, currentStatus } = useAnalysisContext();
  const failures = useFailures(project.id);
  const opportunities = useOpportunities(project.id);
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: () => api.get<Catalog>("/meta/catalog"),
    staleTime: Infinity,
  });

  const assumptions = detail.configuration?.assumptions ?? [];
  const running = currentStatus?.status === "running" || currentStatus?.status === "queued";
  const hasEvidence = project.evidence_count > 0;

  const statusTone = (status: string) =>
    status === "supported"
      ? "positive"
      : status === "contradicted"
        ? "negative"
        : status === "partially_supported"
          ? "warning"
          : "neutral";

  return (
    <div className="space-y-10">
      <Panel className="p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="eyebrow">Executive summary</div>
          <div className="flex items-center gap-2">
            {project.is_demo ? <DemoBadge /> : <Badge tone="positive">Live evidence</Badge>}
            <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-muted">
              {titleCase(project.mode)} · {formatDate(project.completed_at ?? project.created_at)}
            </span>
          </div>
        </div>
        <p className="mt-4 max-w-[78ch] font-serif text-[19px] leading-[1.5] text-ink md:text-[21px]">
          {project.summary ??
            (running
              ? "Research is running. Findings will appear here as each stage completes."
              : "No summary yet. Run the analysis to generate findings from the collected evidence.")}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          <div className="bg-paper px-4 py-4">
            <Stat label="Evidence" value={project.evidence_count} hint="Attributed records" />
          </div>
          <div className="bg-paper px-4 py-4">
            <Stat label="Weaknesses" value={project.failure_count} hint="Observed complaints" tone="negative" />
          </div>
          <div className="bg-paper px-4 py-4">
            <Stat label="Opportunities" value={project.opportunity_count} hint="With demand evidence" tone="positive" />
          </div>
          <div className="bg-paper px-4 py-4">
            <Stat
              label="Markets"
              value={project.global_scope ? "Global" : project.countries.length}
              hint={
                project.global_scope
                  ? "Global scope"
                  : project.countries.map((code) => countryName(code, catalog.data?.countries ?? [])).join(", ") || "—"
              }
            />
          </div>
        </div>
      </Panel>

      {!hasEvidence && !running ? (
        <Panel>
          <EmptyState
            title="No evidence in this project yet"
            description="The analysis pipeline collects permitted sources, extracts evidence and only then produces findings. Start the run to begin."
            action={
              <Link to={`/analysis/${project.id}/evidence`}>
                <span className="link-underline text-[12.5px] text-navy">Open the evidence centre</span>
              </Link>
            }
          />
        </Panel>
      ) : null}

      {assumptions.length > 0 ? (
        <section>
          <SectionHeading
            eyebrow="Assumption validation"
            title="What the evidence did to your beliefs"
            description="Each assumption is tested against collected records, not against the model's opinion."
          />
          <div className="mt-5 divide-y divide-line border-y border-line">
            {assumptions.map((assumption) => (
              <div key={assumption.text} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink">{assumption.text}</p>
                  <Badge tone={statusTone(assumption.status) as "positive" | "negative" | "warning" | "neutral"}>
                    {titleCase(assumption.status)}
                  </Badge>
                </div>
                {assumption.rationale ? (
                  <p className="mt-2 max-w-[70ch] text-[11.5px] leading-relaxed text-muted">
                    {assumption.rationale}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <SectionHeading
          eyebrow="Navigate the analysis"
          title="The intelligence set"
          description="Every page reads from the same evidence ledger."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.slug}
                to={`/analysis/${project.id}/${section.slug}`}
                className="surface group p-5 transition-colors hover:border-accent/40"
              >
                <div className="flex items-center justify-between">
                  <Icon className="h-4 w-4 text-accent" aria-hidden />
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
                <div className="mt-5 text-[13.5px] text-ink">{section.title}</div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{section.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading
            eyebrow="Top weaknesses"
            title="What needs attention"
            actions={
              <Link to={`/analysis/${project.id}/failures`} className="link-underline text-[11.5px] text-navy">
                All findings
              </Link>
            }
          />
          <div className="mt-4 space-y-3">
            {(failures.data ?? []).slice(0, 3).map((failure) => (
              <div key={failure.id} className="border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] text-ink">{failure.title}</span>
                  <SeverityBadge severity={failure.severity} />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  {failure.evidence_count} records · confidence {percent(failure.confidence, 1)}%
                </p>
              </div>
            ))}
            {failures.data?.length === 0 ? (
              <p className="text-[12px] text-muted">
                No weakness crossed the evidence threshold in this run.
              </p>
            ) : null}
          </div>
        </section>

        <section>
          <SectionHeading
            eyebrow="Top opportunities"
            title="Where the opening is"
            actions={
              <Link to={`/analysis/${project.id}/opportunities`} className="link-underline text-[11.5px] text-navy">
                All opportunities
              </Link>
            }
          />
          <div className="mt-4 space-y-3">
            {(opportunities.data ?? []).slice(0, 3).map((opportunity) => (
              <div key={opportunity.id} className="border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[12.5px] text-ink">{opportunity.title}</span>
                  <Badge tone="positive">{Math.round(opportunity.impact_score)}</Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  {titleCase(opportunity.quadrant)} · effort {Math.round(opportunity.effort_score)}
                </p>
              </div>
            ))}
            {opportunities.data?.length === 0 ? (
              <p className="text-[12px] text-muted">No opportunity met the evidence threshold.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section>
        <SectionHeading
          eyebrow="Provenance"
          title="Where this came from"
          description="Sources are recorded per category. Demonstration projects use a synthetic corpus."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.sources.map((source) => (
            <div key={source.id} className="border border-line p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-ink">{source.name}</span>
                <Badge tone={source.is_live ? "positive" : "warning"}>
                  {source.is_live ? "live" : "synthetic"}
                </Badge>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">{source.description}</p>
              <div className="mono mt-2 text-[9.5px] uppercase tracking-[0.1em] text-muted">
                {source.record_count} records · {source.provider}
              </div>
            </div>
          ))}
          {detail.sources.length === 0 ? (
            <p className="text-[12px] text-muted">No sources recorded yet.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
