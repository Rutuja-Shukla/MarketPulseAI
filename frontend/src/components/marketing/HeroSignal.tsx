import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const findings = [
  { label: "Pricing & perceived value", severity: "Critical", records: 9, tone: "negative" as const, width: 92 },
  { label: "Support responsiveness", severity: "High", records: 7, tone: "warning" as const, width: 68 },
  { label: "Reporting flexibility", severity: "Medium", records: 5, tone: "navy" as const, width: 46 },
];

const sparkline = [18, 26, 22, 34, 30, 44, 38, 52, 47, 61, 55, 68];

function Sparkline() {
  const max = Math.max(...sparkline);
  const points = sparkline
    .map((value, index) => `${(index / (sparkline.length - 1)) * 100},${40 - (value / max) * 34}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 44" className="h-12 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mp-accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--mp-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,44 ${points} 100,44`} fill="url(#hero-spark)" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--mp-accent)"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeroSignal() {
  return (
    <div className="relative">
      <div className="absolute -left-6 -top-6 h-24 w-24 border-l border-t border-line" aria-hidden />
      <div className="absolute -bottom-6 -right-6 h-24 w-24 border-b border-r border-line" aria-hidden />

      <div className="surface relative p-6 shadow-lift">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Signal ledger</div>
            <div className="mt-2 font-serif text-[20px] leading-tight">Lumenly Signals</div>
            <div className="mt-1 text-[11.5px] text-muted">ANZ &amp; India · 12 months</div>
          </div>
          <Badge tone="warning">Illustrative</Badge>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4 border-y border-line py-4">
          <div>
            <div className="eyebrow">Negative share</div>
            <div className="mono mt-1 text-[28px] leading-none">38.1%</div>
          </div>
          <div className="w-[52%]">
            <Sparkline />
            <div className="mono mt-1 flex justify-between text-[9px] uppercase tracking-[0.1em] text-muted">
              <span>Nov</span>
              <span>Oct</span>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {findings.map((finding) => (
            <div key={finding.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-ink">{finding.label}</span>
                <span className="mono text-[10px] uppercase tracking-[0.08em] text-muted">
                  {finding.records} records
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-[3px] flex-1 bg-subtle">
                  <div
                    className={
                      finding.tone === "negative"
                        ? "h-full bg-negative"
                        : finding.tone === "warning"
                          ? "h-full bg-warning"
                          : "h-full bg-accent"
                    }
                    style={{ width: `${finding.width}%` }}
                  />
                </div>
                <span className="mono w-[62px] text-right text-[9.5px] uppercase tracking-[0.1em] text-muted">
                  {finding.severity}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-muted">
            7 sources · 42 records · 11 findings
          </span>
          <ArrowUpRight className="h-3.5 w-3.5 text-muted" aria-hidden />
        </div>
      </div>

      <div className="surface absolute -bottom-10 -left-8 hidden w-[210px] p-4 shadow-lift lg:block">
        <div className="eyebrow">Opportunity</div>
        <p className="mt-2 font-serif text-[15px] leading-snug">
          Repackage plans around workspace value
        </p>
        <div className="mono mt-3 flex items-center justify-between text-[9.5px] uppercase tracking-[0.1em] text-muted">
          <span>Impact 82</span>
          <span>Effort 46</span>
        </div>
      </div>
    </div>
  );
}
