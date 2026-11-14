import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("h-6 w-6", className)} aria-hidden fill="none">
      <circle cx="14" cy="14" r="12.4" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <circle cx="14" cy="14" r="7.4" stroke="currentColor" strokeWidth="1" opacity="0.55" />
      <circle cx="14" cy="14" r="2" fill="currentColor" />
      <path d="M14 1.6v6.2M14 20.4v6M1.6 14h6.2M20.4 14h6" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <path d="M20.2 7.8l3.2-3.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function Logo({
  to = "/",
  compact = false,
  className,
}: {
  to?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn("group inline-flex items-center gap-2.5 text-ink", className)}
      aria-label="MarketPulse AI home"
    >
      <LogoMark className="text-navy transition-transform duration-500 ease-editorial group-hover:rotate-45" />
      <span className="flex flex-col leading-none">
        <span className="font-serif text-[19px] tracking-[-0.01em]">MarketPulse</span>
        {!compact ? (
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.28em] text-muted">
            Intelligence
          </span>
        ) : null}
      </span>
    </Link>
  );
}
