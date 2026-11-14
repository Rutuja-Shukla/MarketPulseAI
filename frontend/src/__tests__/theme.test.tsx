import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";

function ThemeHarness() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        Toggle theme
      </button>
    </div>
  );
}

describe("theme", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark", "light");
    vi.restoreAllMocks();
  });

  it("defaults to light mode for a new visitor", () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggles to dark mode and persists the choice", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    await user.click(screen.getByRole("button", { name: /toggle theme/i }));

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("marketpulse-theme")).toBe("dark");
  });

  it("restores a stored dark preference", () => {
    localStorage.setItem("marketpulse-theme", "dark");
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
