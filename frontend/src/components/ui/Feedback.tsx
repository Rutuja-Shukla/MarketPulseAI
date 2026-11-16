import type { ReactNode } from "react";
import { AlertTriangle, Compass, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-line bg-subtle text-accent">
        {icon ?? <Compass className="h-4 w-4" aria-hidden />}
      </div>
      <h3 className="text-[17px] font-bold">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-subtle", className)} aria-hidden />;
}

export function LoadingBlock({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="eyebrow">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border border-negative/25 bg-negative/[0.05] p-6">
      <div className="flex items-center gap-2 text-negative">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em]">Request failed</span>
      </div>
      <p className="max-w-prose text-[13px] leading-relaxed text-ink">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-accent to-positive transition-[width] duration-700 ease-editorial"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
