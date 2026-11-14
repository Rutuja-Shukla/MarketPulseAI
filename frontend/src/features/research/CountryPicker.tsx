import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import type { Country } from "@/types";

export function CountryPicker({
  countries,
  selected,
  onChange,
  disabled,
}: {
  countries: Country[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return countries;
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(needle) ||
        country.code.toLowerCase().includes(needle) ||
        country.region.toLowerCase().includes(needle),
    );
  }, [countries, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Country[]>();
    filtered.forEach((country) => {
      const list = map.get(country.region) ?? [];
      list.push(country);
      map.set(country.region, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  function toggle(code: string) {
    if (disabled) return;
    onChange(selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code]);
  }

  return (
    <div className="border border-line bg-paper">
      <div className="relative border-b border-line">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search countries or regions"
          aria-label="Search countries"
          disabled={disabled}
          className="border-0 pl-9 focus:ring-0"
        />
      </div>
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-3 py-2">
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              disabled={disabled}
              className="inline-flex items-center gap-1 rounded-sm border border-navy/25 bg-navy/[0.06] px-2 py-0.5 text-[11px] text-navy"
            >
              {code}
              <span aria-hidden className="text-[10px]">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-1 text-[10.5px] uppercase tracking-[0.08em] text-muted hover:text-ink"
          >
            Clear
          </button>
        </div>
      ) : null}
      <div className="max-h-[260px] overflow-y-auto p-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-muted">No countries match that search.</p>
        ) : (
          grouped.map(([region, items]) => (
            <div key={region} className="mb-2 last:mb-0">
              <div className="eyebrow px-2 py-1.5">{region}</div>
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {items.map((country) => {
                  const active = selected.includes(country.code);
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => toggle(country.code)}
                      disabled={disabled}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center justify-between gap-2 px-2 py-1.5 text-left text-[12.5px] transition-colors",
                        active ? "bg-navy/[0.06] text-navy" : "text-muted hover:bg-subtle hover:text-ink",
                      )}
                    >
                      <span className="truncate">{country.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="mono text-[9.5px] text-muted">{country.code}</span>
                        {active ? <Check className="h-3 w-3" aria-hidden /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
