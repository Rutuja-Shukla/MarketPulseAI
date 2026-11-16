import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative" | "warning" | "navy" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-muted border-line",
  positive: "bg-positive/10 text-positive border-positive/25",
  negative: "bg-negative/10 text-negative border-negative/25",
  warning: "bg-warning/10 text-warning border-warning/25",
  navy: "bg-navy/[0.06] text-ink border-line dark:bg-white/10 dark:text-ink",
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-semibold capitalize tracking-[-0.005em]",
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
