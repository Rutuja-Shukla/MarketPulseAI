import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1 border-b border-line", className)} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          type="button"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "relative -mb-px border-b-2 px-3 py-2 text-[12.5px] transition-colors",
            value === item.value
              ? "border-navy text-ink"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {item.label}
          {typeof item.count === "number" ? (
            <span className="mono ml-2 text-[10.5px] text-muted">{item.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
