import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { DashboardPage } from "@/pages/Dashboard";
import { mockApi, renderWithProviders } from "@/test/utils";

const emptyDashboard = {
  metrics: { projects: 0, completed: 0, evidence: 0, failures: 0, critical_risks: 0, opportunities: 0, unread_notifications: 0 },
  recent_projects: [],
  completed_projects: [],
  notifications: [],
  demo_mode: true,
  live_research_available: false,
};

describe("dashboard", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows an elegant empty state with a demo option", async () => {
    mockApi({ "/dashboard": emptyDashboard, "/monitoring": { entries: [], total: 0 } });
    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText(/no research yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /load demonstration workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/no completed reports yet/i)).toBeInTheDocument();
    expect(screen.getByText(/demonstration only/i)).toBeInTheDocument();
  });

  it("renders real metrics when projects exist", async () => {
    mockApi({
      "/dashboard": {
        ...emptyDashboard,
        metrics: { projects: 2, completed: 1, evidence: 42, failures: 5, critical_risks: 1, opportunities: 4, unread_notifications: 1 },
        recent_projects: [
          {
            id: "p1",
            name: "Lumenly Signals",
            mode: "deep",
            status: "completed",
            is_demo: true,
            summary: "Pricing and support dominate.",
            current_stage: "completed",
            error_message: null,
            evidence_count: 42,
            failure_count: 5,
            opportunity_count: 4,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            product_name: "Signals",
            company_name: "Lumenly",
            countries: ["AU"],
            global_scope: false,
            progress: 100,
          },
        ],
        completed_projects: [],
      },
      "/monitoring": { entries: [], total: 0 },
    });
    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText("Lumenly Signals")).toBeInTheDocument();
    });
    expect(screen.getByText("Critical risks")).toBeInTheDocument();
    expect(screen.getByText("Evidence records")).toBeInTheDocument();
    expect(screen.getByText(/5 weaknesses identified/i)).toBeInTheDocument();
  });

  it("shows a retryable error state when the API fails", async () => {
    mockApi({ "/dashboard": { detail: "Something went wrong on our side." } }, { "/dashboard": 500 });
    renderWithProviders(<DashboardPage />, { route: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText(/request failed/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
