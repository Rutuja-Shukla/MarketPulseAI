import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const sections = [
  { slug: "overview", label: "Overview" },
  { slug: "failures", label: "Failure radar" },
  { slug: "opportunities", label: "Opportunity radar" },
  { slug: "customer-voice", label: "Customer voice" },
  { slug: "competitors", label: "Competitors" },
  { slug: "intelligence-graph", label: "Intelligence graph" },
  { slug: "analytics", label: "Analytics" },
  { slug: "roadmap", label: "Roadmap" },
  { slug: "simulator", label: "Simulator" },
  { slug: "evidence", label: "Evidence" },
  { slug: "report", label: "Report" },
];

export function ProjectNav({ projectId }: { projectId: string }) {
  return (
    <nav
      aria-label="Analysis sections"
      className="no-print -mx-6 overflow-x-auto border-b border-line px-6 md:mx-0 md:px-0"
    >
      <div className="flex min-w-max items-center gap-6">
        {sections.map((section) => (
          <NavLink
            key={section.slug}
            to={`/analysis/${projectId}/${section.slug}`}
            className={({ isActive }) =>
              cn(
                "relative whitespace-nowrap border-b-2 py-3 text-[12.5px] transition-colors",
                isActive
                  ? "border-navy text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )
            }
          >
            {section.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
