import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative" | "warning" | "navy" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-muted border-line",
  positive: "bg-positive/12 text-positive border-positive/35",
  negative: "bg-negative/12 text-negative border-negative/35",
  warning: "bg-warning/12 text-warning border-warning/35",
  navy: "bg-navy/10 text-navy border-navy/30",
  outline: "bg-transparent text-muted border-line",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const tone: Tone =
    sentiment === "positive" ? "positive" : sentiment === "negative" ? "negative" : sentiment === "mixed" ? "warning" : "neutral";
  return <Badge tone={tone}>{sentiment}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone: Tone =
    severity === "critical" ? "negative" : severity === "high" ? "warning" : severity === "medium" ? "navy" : "neutral";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warning" className={className} >
      Demo data
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "completed" ? "positive" : status === "running" || status === "queued" ? "navy" : status === "failed" ? "negative" : "neutral";
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}
