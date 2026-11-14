import { describe, expect, it } from "vitest";
import { defaultStudioValues, studioSchema } from "@/features/research/schema";

const validBrief = {
  ...defaultStudioValues,
  name: "ANZ market assessment",
  company: { ...defaultStudioValues.company, name: "Northwind Analytics" },
};

function withValues(overrides: Record<string, unknown>) {
  return { ...validBrief, ...overrides };
}

describe("research studio schema", () => {
  it("accepts a complete brief", () => {
    const result = studioSchema.safeParse(validBrief);
    expect(result.success).toBe(true);
  });

  it("requires a project name of at least three characters", () => {
    const result = studioSchema.safeParse(withValues({ name: "ab" }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/at least 3/i);
    }
  });

  it("requires a company name", () => {
    const result = studioSchema.safeParse(
      withValues({ company: { ...validBrief.company, name: "" } }),
    );
    expect(result.success).toBe(false);
  });

  it("requires at least one market when global scope is off", () => {
    const result = studioSchema.safeParse(
      withValues({
        market: { global_scope: false, countries: [], regions: [], comparison_pairs: [] },
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => /country|region|global/i.test(issue.message))).toBe(true);
    }
  });

  it("allows a global scope with no countries", () => {
    const result = studioSchema.safeParse(
      withValues({
        market: { global_scope: true, countries: [], regions: [], comparison_pairs: [] },
      }),
    );
    expect(result.success).toBe(true);
  });

  it("requires at least one source category", () => {
    const result = studioSchema.safeParse(withValues({ source_categories: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects an invalid website domain", () => {
    const result = studioSchema.safeParse(
      withValues({
        company: { ...validBrief.company, website: "not-a-domain" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("only allows the three documented research depths", () => {
    expect(studioSchema.safeParse(withValues({ depth: "exhaustive" })).success).toBe(false);
    expect(studioSchema.safeParse(withValues({ depth: "deep" })).success).toBe(true);
  });
});
