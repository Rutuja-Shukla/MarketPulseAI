import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Outlet, Route, Routes } from "react-router-dom";
import { mockApi, renderWithProviders } from "@/test/utils";
import AnalyticsPage from "@/pages/analysis/Analytics";
import type { AnalysisOutletContext } from "@/pages/analysis/context";

vi.mock("echarts", () => ({
  init: () => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

const project = {
  id: "p-1",
  name: "Acme market assessment",
  mode: "standard" as const,
  status: "completed" as const,
  is_demo: true,
  summary: "Summary",
  current_stage: "completed",
  error_message: null,
  evidence_count: 12,
  failure_count: 3,
  opportunity_count: 2,
  created_at: new Date().toISOString(),
  completed_at: new Date().toISOString(),
  product_name: "Acme Signals",
  company_name: "Acme",
  countries: ["AU"],
  global_scope: false,
  progress: 100,
};

const analytics = {
  totals: { evidence: 12, sources: 3, countries: 2, failures: 3, opportunities: 2, competitors: 2, positive: 3, negative: 6, neutral: 3 },
  sentiment_trend: { months: ["2026-01", "2026-02"], positive: [1, 2], negative: [2, 4], neutral: [1, 2] },
  pain_points: [{ topic: "Pricing concerns", key: "pricing", count: 4 }],
  benchmark_dimensions: ["sentiment", "pricing"],
  benchmark_series: [{ name: "Acme (you)", is_primary: true, values: [50, 40], mention_count: 12 }],
  opportunity_matrix: [{ id: "o1", title: "Workspace plans", impact: 80, effort: 40, quadrant: "quick_win", confidence: 0.6 }],
  geography: [{ country: "AU", records: 6, sentiment: 0.1, positive: 2, negative: 3 }],
  topic_trends: [{ label: "Pricing concerns", trend: "emerging" as const, series: [{ month: "2026-01", count: 2 }], evidence_count: 4, kind: "complaint" }],
  source_distribution: [{ source: "reddit", count: 6 }],
  timeline: [{ date: "2026-01-04", label: "A complaint", category: "reddit", sentiment: "negative" as const, source: "Reddit" }],
  severity_breakdown: [{ severity: "high" as const, count: 2 }],
  demo: true,
  project_name: project.name,
};

const context: AnalysisOutletContext = {
  project,
  detail: {
    project,
    configuration: null,
    tasks: [],
    competitors: [],
    sources: [],
    company: { name: "Acme", website: null, industry: null, description: null, target_audience: null },
  },
};

function renderAnalytics() {
  return renderWithProviders(
    <Routes>
      <Route path="/analysis/:projectId" element={<Outlet context={context} />}>
        <Route path="analytics" element={<AnalyticsPage />} />
      </Route>
    </Routes>,
    { route: "/analysis/p-1/analytics" },
  );
}

describe("analytics page", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders all eight chart panels from the API data", async () => {
    mockApi({ "/analytics": analytics });
    renderAnalytics();

    await waitFor(() => {
      expect(screen.getByText(/sentiment over time/i)).toBeInTheDocument();
    });
    [
      /customer pain-point distribution/i,
      /competitor benchmarking/i,
      /opportunity vs effort/i,
      /geographic comparison/i,
      /feedback source distribution/i,
      /topic trend analysis/i,
      /market signal timeline/i,
    ].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
    expect(screen.getByRole("img", { name: /line chart of sentiment over time/i })).toBeInTheDocument();
  });

  it("shows an empty state instead of inventing chart data", async () => {
    mockApi({ "/analytics": { detail: "This project has no evidence records yet." } }, { "/analytics": 404 });
    renderAnalytics();
    await waitFor(() => {
      expect(screen.getByText(/no analytics yet/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/charts are computed from stored evidence/i)).toBeInTheDocument();
  });
});
