import { expect, test, type Page } from "@playwright/test";

const unique = Date.now().toString().slice(-6);
const email = `e2e-${unique}@example.com`;
const password = "E2ePassword123";
const projectName = `E2E market assessment ${unique}`;

test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

test("landing page introduces the product and light theme is default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/See what the\s*market sees/);
  await expect(page.getByRole("link", { name: /start an analysis/i }).first()).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("a new analyst can register", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel(/^Full name/).fill("E2E Analyst");
  await page.getByLabel(/^Company/).fill("E2E Labs");
  await page.getByLabel(/^Work email/).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/research\/new/, { timeout: 20_000 });
});

test("the research studio creates and runs an analysis", async ({ page }) => {
  await signIn(page);
  await page.goto("/research/new");

  await page.getByLabel(/research project name/i).fill(projectName);
  await page.getByLabel(/^Company name/).fill("Northwind Analytics");
  await page.getByLabel(/product or service name/i).fill("Northwind Signals");
  await page.getByLabel(/^Industry/).fill("B2B SaaS");
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await expect(page.getByRole("button", { name: /Australia AU/ })).toBeVisible();
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await page.getByRole("button", { name: /losing customers to competitors/i }).click();
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await page.getByRole("button", { name: /identify product weaknesses/i }).click();
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await page.getByRole("button", { name: /add assumption/i }).click();
  await page
    .getByPlaceholder("We believe…")
    .last()
    .fill("We believe customers are switching because subscription pricing is too expensive.");
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await page.getByRole("button", { name: /add competitor/i }).click();
  await page.getByPlaceholder("Competitor name").fill("Orbit Metrics");
  await page.getByRole("button", { name: /^Continue$/ }).click();

  await expect(page.getByText(/research summary/i)).toBeVisible();
  await page.getByRole("button", { name: /start intelligence analysis/i }).click();

  await expect(page).toHaveURL(/\/analysis\/[0-9a-f-]+\/overview/, { timeout: 30_000 });
  await expect(page.getByText(/executive summary/i).first()).toBeVisible();
  await expect(page.getByText(/no evidence in this project yet/i)).toBeHidden({ timeout: 120_000 });
  await expect(page.getByText(/intelligence set/i)).toBeVisible();
});

test("analysis sections render real findings", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: new RegExp(projectName) }).first().click();
  await expect(page).toHaveURL(/\/analysis\/.+\/overview/);

  const sections = page.getByRole("navigation", { name: "Analysis sections" });

  await sections.getByRole("link", { name: "Failure radar", exact: true }).click();
  await expect(page.getByText(/where the product is underperforming/i).first()).toBeVisible();

  await sections.getByRole("link", { name: "Opportunity radar", exact: true }).click();
  await expect(page.getByText(/where the business could move/i).first()).toBeVisible();

  await sections.getByRole("link", { name: "Customer voice", exact: true }).click();
  await expect(page.getByText(/what customers actually said/i).first()).toBeVisible();
  await expect(page.getByLabel(/search customer discussions/i)).toBeVisible();

  await sections.getByRole("link", { name: "Intelligence graph", exact: true }).click();
  await expect(page.getByText(/the argument, made visible/i).first()).toBeVisible();

  await sections.getByRole("link", { name: "Evidence", exact: true }).click();
  await expect(page.getByText(/every claim has a record/i).first()).toBeVisible();

  await sections.getByRole("link", { name: "Report", exact: true }).click();
  await expect(page.getByText(/executive summary/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /download pdf/i })).toBeVisible();
});

test("dark mode can be enabled and persists", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: /switch to dark mode/i }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: /switch to light mode/i }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});
