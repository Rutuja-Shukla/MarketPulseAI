import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage } from "@/pages/Login";
import { mockApi, renderWithProviders } from "@/test/utils";

const capabilities = {
  demo_mode: true,
  search_provider: "none",
  search_configured: false,
  llm_provider: "gemini",
  llm_configured: false,
  live_research_available: false,
  job_runner: "inline",
  limitations: [],
  demo_project_id: null,
  demo_credentials: { email: "demo@marketpulse.ai", password: "DemoPass123!" },
};

describe("login page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("shows demo credentials and the demo entry point", async () => {
    mockApi({ "/meta/capabilities": capabilities });
    renderWithProviders(<LoginPage />, { route: "/login" });

    await waitFor(() => {
      expect(screen.getByText("demo@marketpulse.ai")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /enter the demonstration workspace/i })).toBeEnabled();
  });

  it("surfaces a failed sign-in attempt without leaving the page", async () => {
    const user = userEvent.setup();
    mockApi(
      {
        "/meta/capabilities": capabilities,
        "/auth/login": { detail: "Incorrect email or password" },
      },
      { "/auth/login": 401 },
    );

    renderWithProviders(<LoginPage />, { route: "/login" });
    await user.type(screen.getByLabelText(/email/i), "analyst@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });
  });

  it("marks credentials as required fields", async () => {
    mockApi({ "/meta/capabilities": capabilities });
    renderWithProviders(<LoginPage />, { route: "/login" });

    expect(screen.getByLabelText(/^Email/)).toBeRequired();
    expect(screen.getByLabelText(/^Password/)).toBeRequired();
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute("type", "email");
  });
});
