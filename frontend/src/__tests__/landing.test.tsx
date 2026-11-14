import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingPage } from "@/pages/Landing";
import { renderWithProviders } from "@/test/utils";

describe("landing page", () => {
  it("presents the product positioning and primary calls to action", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByRole("heading", { level: 1, name: /see what the market sees/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /start an analysis/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /explore the demonstration/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/works without paid api keys/i)).toBeInTheDocument();
  });

  it("switches between the failure and opportunity radar examples", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LandingPage />);

    expect(screen.getByText(/a complaint is a signal, not a verdict/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /opportunity radar/i }));
    expect(screen.getByText(/an opportunity is a hypothesis, not a promise/i)).toBeInTheDocument();
    expect(screen.getByText(/impact vs effort/i)).toBeInTheDocument();
  });

  it("shows the graph example with a meaningful chain", () => {
    renderWithProviders(<LandingPage />);
    expect(screen.getByText("Pricing complaints")).toBeInTheDocument();
    expect(screen.getByText("Retention risk")).toBeInTheDocument();
    expect(screen.getByText("Bundled plan opportunity")).toBeInTheDocument();
  });

  it("links to sign in", () => {
    renderWithProviders(<LandingPage />);
    const links = screen.getAllByRole("link", { name: /sign in/i });
    expect(links.some((link) => link.getAttribute("href") === "/login")).toBe(true);
  });
});
