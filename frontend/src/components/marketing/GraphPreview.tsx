const nodes = [
  { id: "complaint", x: 74, y: 44, label: "Pricing complaints", sub: "9 records", kind: "negative" },
  { id: "value", x: 214, y: 88, label: "Lower perceived value", sub: "inference", kind: "warning" },
  { id: "switching", x: 356, y: 46, label: "Switching pressure", sub: "competitor", kind: "warning" },
  { id: "retention", x: 498, y: 104, label: "Retention risk", sub: "high severity", kind: "negative" },
  { id: "opportunity", x: 636, y: 56, label: "Bundled plan opportunity", sub: "impact 82", kind: "positive" },
];

const edges = [
  ["complaint", "value"],
  ["value", "switching"],
  ["switching", "retention"],
  ["retention", "opportunity"],
];

const colors: Record<string, string> = {
  negative: "var(--mp-negative)",
  warning: "var(--mp-warning)",
  positive: "var(--mp-positive)",
};

export function GraphPreview() {
  return (
    <div className="relative overflow-hidden border border-line bg-paper">
      <div className="hairline-grid absolute inset-0 opacity-60" aria-hidden />
      <div className="relative flex items-center justify-between border-b border-line px-5 py-3">
        <span className="eyebrow">Strategic intelligence graph</span>
        <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
          7 nodes · 6 relationships
        </span>
      </div>
      <div className="relative overflow-x-auto p-4">
        <svg viewBox="0 0 740 190" className="h-[210px] w-full min-w-[620px]" role="img" aria-label="Example intelligence graph: pricing complaints lead to lower perceived value, switching pressure, retention risk and a subscription bundle opportunity">
          <defs>
            <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--mp-muted)" opacity="0.7" />
            </marker>
          </defs>
          {edges.map(([from, to]) => {
            const source = nodes.find((node) => node.id === from);
            const target = nodes.find((node) => node.id === to);
            if (!source || !target) return null;
            const x1 = source.x + 70;
            const y1 = source.y + 26;
            const x2 = target.x - 4;
            const y2 = target.y + 26;
            const middle = (x1 + x2) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="var(--mp-muted)"
                strokeWidth="1"
                opacity="0.55"
                markerEnd="url(#graph-arrow)"
              />
            );
          })}
          {nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width="132"
                height="52"
                fill="var(--mp-surface)"
                stroke={colors[node.kind]}
                strokeWidth="1"
                rx="2"
              />
              <rect x={node.x} y={node.y} width="3" height="52" fill={colors[node.kind]} />
              <text
                x={node.x + 12}
                y={node.y + 22}
                fill="var(--mp-text)"
                fontSize="10.5"
                fontFamily="Inter, sans-serif"
              >
                {node.label}
              </text>
              <text
                x={node.x + 12}
                y={node.y + 38}
                fill="var(--mp-muted)"
                fontSize="8"
                fontFamily="IBM Plex Mono, monospace"
                letterSpacing="0.8"
              >
                {node.sub.toUpperCase()}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="relative border-t border-line px-5 py-3">
        <p className="text-[11.5px] leading-relaxed text-muted">
          Each node opens its supporting evidence. Relationships are derived from findings, not decoration.
        </p>
      </div>
    </div>
  );
}
