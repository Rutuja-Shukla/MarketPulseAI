import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Panel, SectionHeading } from "@/components/ui/Card";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { useAnalysisContext } from "@/pages/analysis/context";
import { useGraph } from "@/hooks/useProjectData";
import { api } from "@/lib/api";
import { cn, percent, titleCase } from "@/lib/utils";
import type { GraphNode } from "@/types";

type MpNodeData = {
  label: string;
  category: string;
  categoryLabel: string;
  detail: string;
  confidence: number;
  severity?: string;
  impact?: number;
};

const CATEGORY_COLOR: Record<string, string> = {
  complaint: "var(--mp-negative)",
  expectation: "var(--mp-accent)",
  weakness: "var(--mp-negative)",
  competitor: "var(--mp-warning)",
  trend: "var(--mp-positive)",
  risk: "var(--mp-warning)",
  opportunity: "var(--mp-positive)",
  action: "var(--mp-navy)",
};

const COLUMN: Record<string, number> = {
  competition: 0,
  complaint: 0,
  expectation: 0,
  competitor: 1,
  trend: 1,
  weakness: 2,
  risk: 3,
  opportunity: 4,
  action: 5,
};

function MpNode({ data }: NodeProps<Node<MpNodeData>>) {
  const color = CATEGORY_COLOR[data.category] ?? "var(--mp-muted)";
  return (
    <div
      className="w-[188px] rounded-sm border bg-paper px-3 py-2 shadow-quiet"
      style={{ borderColor: "var(--mp-border)", borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 6, height: 6, border: "none" }} />
      <div className="mono text-[8px] uppercase tracking-[0.12em] text-muted">{data.categoryLabel}</div>
      <div className="mt-1 text-[11px] leading-snug text-ink" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {data.label}
      </div>
      <div className="mono mt-1.5 flex items-center justify-between text-[8px] uppercase tracking-[0.08em] text-muted">
        <span>{data.severity ?? `${percent(data.confidence, 1)}%`}</span>
        {typeof data.impact === "number" ? <span>impact {Math.round(data.impact)}</span> : null}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6, border: "none" }} />
    </div>
  );
}

const nodeTypes = { mp: MpNode };

function layout(nodes: GraphNode[]): Node<MpNodeData>[] {
  const columns = new Map<number, GraphNode[]>();
  nodes.forEach((node) => {
    const column = COLUMN[node.category] ?? 2;
    const list = columns.get(column) ?? [];
    list.push(node);
    columns.set(column, list);
  });
  const result: Node<MpNodeData>[] = [];
  const tallest = Math.max(...Array.from(columns.values(), (list) => list.length), 1);
  columns.forEach((list, column) => {
    list.forEach((node, index) => {
      const offset = (tallest - list.length) / 2;
      result.push({
        id: node.id,
        type: "mp",
        position: { x: column * 250, y: (index + offset) * 108 },
        data: {
          label: node.label,
          category: node.category,
          categoryLabel: node.category_label,
          detail: node.detail,
          confidence: node.confidence,
          severity: typeof node.meta.severity === "string" ? node.meta.severity : undefined,
          impact: typeof node.meta.impact === "number" ? node.meta.impact : undefined,
        },
      });
    });
  });
  return result;
}

export default function IntelligenceGraph() {
  const { project } = useAnalysisContext();
  const [category, setCategory] = useState<string>("");
  const [relation, setRelation] = useState<string>("");
  const [selected, setSelected] = useState<GraphNode | null>(null);

  const filters = useMemo(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (relation) params.set("relation", relation);
    return params.toString();
  }, [category, relation]);

  const query = useGraph(project.id, filters);
  const data = query.data;

  const nodes = useMemo(() => (data ? layout(data.nodes) : []), [data]);
  const edges = useMemo<Edge[]>(() => {
    if (!data) return [];
    const visible = new Set(nodes.map((node) => node.id));
    return data.edges
      .filter((edge) => visible.has(edge.source) && visible.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.relation.replace(/_/g, " "),
        animated: edge.relation === "opens" || edge.relation === "recommends",
        style: { stroke: "var(--mp-border)", strokeWidth: 1.2 },
        labelStyle: { fill: "var(--mp-muted)", fontSize: 9, fontFamily: "Manrope, sans-serif", fontWeight: 600 },
        labelBgStyle: { fill: "var(--mp-surface)" },
        labelBgPadding: [3, 1] as [number, number],
      }));
  }, [data, nodes]);

  const nodeEvidence = useQuery({
    queryKey: ["graph-node-evidence", project.id, selected?.id],
    queryFn: () =>
      api.get<{ items: { id: string; source_name: string; excerpt: string; sentiment: string; source_url: string | null }[] }>(
        `/projects/${project.id}/graph/node/${encodeURIComponent(selected!.id)}/evidence`,
      ),
    enabled: Boolean(selected),
  });

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      const match = data?.nodes.find((item) => item.id === node.id) ?? null;
      setSelected(match);
    },
    [data],
  );

  if (query.isLoading) return <LoadingBlock label="Layout the intelligence graph" rows={4} />;
  if (query.isError) {
    return (
      <div className="space-y-6">
        <SectionHeading eyebrow="Intelligence graph" title="The argument, made visible" />
        <Panel>
          <EmptyState
            icon={<GitBranch className="h-4 w-4" />}
            title="No relationships available"
            description="The graph needs findings and competitor evidence. Complete a standard or deep analysis, then return."
          />
        </Panel>
      </div>
    );
  }
  if (!data) return null;

  const categories = Array.from(new Set(data.nodes.map((node) => node.category)));

  return (
    <div className="space-y-6">
      <SectionHeading
        eyebrow="Strategic intelligence graph"
        title="The argument, made visible"
        description="Nodes are findings, not decoration. Follow a chain from complaint to risk to opportunity, and open any node to read its evidence."
        actions={<Badge tone="outline">{data.nodes.length} nodes · {data.edges.length} relationships</Badge>}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={cn(
              "border px-2.5 py-1 text-[10.5px] transition-colors",
              category === "" ? "border-navy bg-navy/[0.05] text-navy" : "border-line text-muted hover:text-ink",
            )}
          >
            All nodes
          </button>
          {categories.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(category === key ? "" : key)}
              className={cn(
                "flex items-center gap-1.5 border px-2.5 py-1 text-[10.5px] transition-colors",
                category === key ? "border-navy bg-navy/[0.05] text-navy" : "border-line text-muted hover:text-ink",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLOR[key] }} />
              {titleCase(key)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[10.5px] text-muted">
          Relationship
          <select
            value={relation}
            onChange={(event) => setRelation(event.target.value)}
            className="border border-line bg-paper px-2 py-1 text-[11px] text-ink"
          >
            <option value="">All</option>
            {data.relationship_types.map((type) => (
              <option key={type} value={type}>{titleCase(type)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className={cn("border border-line bg-paper", selected ? "lg:col-span-8" : "lg:col-span-12")}>
          <div style={{ height: 560 }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelected(null)}
              fitView
              minZoom={0.3}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
            >
              <Background color="var(--mp-border)" gap={28} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable nodeColor={() => "var(--mp-subtle)"} maskColor="rgba(0,0,0,0.04)" />
            </ReactFlow>
          </div>
        </div>

        {selected ? (
          <aside className="lg:col-span-4">
            <Panel className="sticky top-24 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="mono text-[9px] uppercase tracking-[0.12em] text-muted">{selected.category_label}</span>
                <button type="button" onClick={() => setSelected(null)} className="text-[10px] text-muted hover:text-ink">
                  close
                </button>
              </div>
              <h3 className="mt-2 font-serif text-[20px] leading-snug">{selected.label}</h3>
              <p className="mt-3 text-[12px] leading-relaxed text-muted">{selected.detail}</p>
              <div className="mt-4 flex flex-wrap gap-4 border-y border-line py-3">
                <div>
                  <div className="eyebrow">Confidence</div>
                  <div className="mono mt-1 text-[13px]">{percent(selected.confidence, 1)}%</div>
                </div>
                {typeof selected.meta.severity === "string" ? (
                  <div>
                    <div className="eyebrow">Severity</div>
                    <div className="mono mt-1 text-[13px] uppercase">{selected.meta.severity}</div>
                  </div>
                ) : null}
                {typeof selected.meta.impact === "number" ? (
                  <div>
                    <div className="eyebrow">Impact</div>
                    <div className="mono mt-1 text-[13px]">{Math.round(selected.meta.impact)}</div>
                  </div>
                ) : null}
              </div>
              <div className="mt-4">
                <div className="eyebrow mb-2">Supporting evidence</div>
                {nodeEvidence.isLoading ? (
                  <p className="text-[11px] text-muted">Loading evidence…</p>
                ) : nodeEvidence.data && nodeEvidence.data.items.length > 0 ? (
                  <div className="space-y-3">
                    {nodeEvidence.data.items.map((item) => (
                      <div key={item.id} className="border-l-2 border-line pl-3">
                        <div className="text-[11px] text-ink">{item.source_name}</div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">“{item.excerpt.slice(0, 220)}”</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] leading-relaxed text-muted">
                    This node is a strategic inference rather than a direct evidence cluster. Its rationale is
                    described above.
                  </p>
                )}
              </div>
            </Panel>
          </aside>
        ) : null}
      </div>

      <p className="text-[10.5px] leading-relaxed text-muted">
        Arrow labels describe the relationship type. Animated edges mark the recommended path from risk to action.
        Graph structure is generated from stored findings and their evidence overlaps.
      </p>
    </div>
  );
}
