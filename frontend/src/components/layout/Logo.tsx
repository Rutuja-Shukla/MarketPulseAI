import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-ink transition-transform duration-500 ease-editorial group-hover:-rotate-6",
        className,
      )}
      aria-hidden
    >
      <span className="h-2.5 w-2.5 rotate-45 rounded-[3px] bg-lime" />
    </span>
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
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[17.5px] font-extrabold tracking-[-0.04em]">MarketPulse</span>
        {!compact ? (
          <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.22em] text-muted">
            Intelligence
          </span>
        ) : null}
      </span>
    </Link>
  );
}
