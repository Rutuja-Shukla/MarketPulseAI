import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Link2 } from "lucide-react";
import { Badge, SentimentBadge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/utils";
import type { Evidence, EvidenceResponse } from "@/types";

export function useEvidenceByIds(projectId: string, ids: string[], enabled = true) {
  return useQuery({
    queryKey: ["evidence-by-ids", projectId, ids.join(",")],
    queryFn: () =>
      api.get<EvidenceResponse>(
        `/projects/${projectId}/evidence?ids=${encodeURIComponent(ids.join(","))}&page_size=100`,
      ),
    enabled: enabled && ids.length > 0,
  });
}

export function EvidenceRecordView({ record, compact = false }: { record: Evidence; compact?: boolean }) {
  return (
    <div className="border-l-2 border-line pl-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-ink">{record.source_name}</span>
        <SentimentBadge sentiment={record.sentiment} />
        <Badge tone="outline">{titleCase(record.source_category)}</Badge>
        {record.contradiction_group ? <Badge tone="warning">conflicting</Badge> : null}
        {record.country ? <span className="mono text-[9.5px] text-muted">{record.country}</span> : null}
        <span className="mono text-[9.5px] text-muted">{formatDate(record.published_at)}</span>
      </div>
      {!compact && record.title ? (
        <div className="mt-1.5 text-[12px] text-ink">{record.title}</div>
      ) : null}
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">“{record.excerpt}”</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <Link2 className="h-2.5 w-2.5" /> credibility {record.credibility_score} ({record.credibility_label})
        </span>
        <span>corroborated by {record.corroboration_count}</span>
        {record.source_url ? (
          record.is_demo ? (
            <span className="mono uppercase tracking-[0.08em] text-warning">synthetic source — demo data</span>
          ) : (
            <a
              href={record.source_url}
              target="_blank"
              rel="noreferrer"
              className="link-underline inline-flex items-center gap-1"
            >
              open source <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )
        ) : (
          <span>no public URL</span>
        )}
      </div>
    </div>
  );
}

export function EvidenceList({
  projectId,
  ids,
  enabled = true,
  emptyLabel = "No evidence is linked to this item.",
}: {
  projectId: string;
  ids: string[];
  enabled?: boolean;
  emptyLabel?: string;
}) {
  const query = useEvidenceByIds(projectId, ids, enabled);
  if (ids.length === 0) return <p className="text-[11.5px] text-muted">{emptyLabel}</p>;
  if (query.isLoading) return <LoadingBlock label="Loading supporting evidence" rows={2} />;
  if (query.isError)
    return <p className="text-[11.5px] text-negative">Evidence could not be loaded.</p>;
  if (!query.data || query.data.items.length === 0)
    return <p className="text-[11.5px] text-muted">{emptyLabel}</p>;
  return (
    <div className="space-y-4">
      {query.data.items.map((record) => (
        <EvidenceRecordView key={record.id} record={record} />
      ))}
    </div>
  );
}
