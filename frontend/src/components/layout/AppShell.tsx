import type { ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="no-print">
        <TopNav />
      </div>
      <div className="page-shell py-8 md:py-10">{children}</div>
      <footer className="no-print border-t border-line">
        <div className="page-shell flex flex-wrap items-center justify-between gap-3 py-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            MarketPulse AI — evidence-led market intelligence
          </span>
          <span className="text-[11px] text-muted">
            Findings are interpretations of public evidence, not financial advice.
          </span>
        </div>
      </footer>
    </div>
  );
}
