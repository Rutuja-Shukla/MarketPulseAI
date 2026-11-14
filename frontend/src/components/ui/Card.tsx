import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface rounded-sm", className)} {...props}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="max-w-prose">
        {eyebrow ? <div className="eyebrow mb-3">{eyebrow}</div> : null}
        <h2 className="title">{title}</h2>
        {description ? <p className="mt-3 text-[14px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <span className="text-[12px] uppercase tracking-[0.09em] text-muted">{label}</span>
      <span className="text-right text-[13px] text-ink">{value}</span>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "negative";
}) {
  const toneClass = {
    default: "text-ink",
    positive: "text-positive",
    warning: "text-warning",
    negative: "text-negative",
  }[tone];
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={cn("mono mt-2 text-[1.9rem] leading-none", toneClass)}>{value}</div>
      {hint ? <div className="mt-2 text-[11.5px] leading-snug text-muted">{hint}</div> : null}
    </div>
  );
}
