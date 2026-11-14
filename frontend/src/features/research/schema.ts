import { z } from "zod";

const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(""));

export const studioSchema = z.object({
  name: z
    .string()
    .min(3, "Give the research project a name of at least 3 characters")
    .max(240, "Keep the project name under 240 characters"),
  company: z.object({
    name: z.string().min(1, "Company name is required").max(200),
    website: optionalText(400).refine(
      (value) => !value || /\./.test(value),
      "Enter a domain such as example.com",
    ),
    industry: optionalText(160),
    product_name: optionalText(200),
    description: optionalText(4000),
    target_audience: optionalText(2000),
  }),
  market: z
    .object({
      global_scope: z.boolean(),
      countries: z.array(z.string()),
      regions: z.array(z.string()),
      comparison_pairs: z.array(z.array(z.string())),
    })
    .refine(
      (market) =>
        market.global_scope || market.countries.length > 0 || market.regions.length > 0,
      { message: "Select at least one country, a region or the global market", path: ["countries"] },
    ),
  situation_key: z.string().optional(),
  situation_description: optionalText(4000),
  objectives: z.array(z.string()),
  assumptions: z.array(z.object({ text: z.string().max(600) })),
  competitors: z.array(
    z.object({
      name: z.string().min(1, "Competitor name is required").max(200),
      website: optionalText(400),
    }),
  ),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  source_categories: z.array(z.string()).min(1, "Choose at least one source category"),
  depth: z.enum(["quick", "standard", "deep"]),
  competitor_target: z.number().min(1).max(6),
  preferences: z.object({
    include_contradictions: z.boolean(),
    regional_comparison: z.boolean(),
  }),
  notes: optionalText(4000),
  run_mode: z.enum(["demo", "live"]),
});

export type StudioForm = z.infer<typeof studioSchema>;

function isoDate(offsetMonths: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + offsetMonths);
  return date.toISOString().slice(0, 10);
}

export const defaultStudioValues: StudioForm = {
  name: "",
  company: {
    name: "",
    website: "",
    industry: "",
    product_name: "",
    description: "",
    target_audience: "",
  },
  market: {
    global_scope: false,
    countries: ["AU", "NZ"],
    regions: [],
    comparison_pairs: [["AU", "NZ"]],
  },
  situation_key: "losing_customers",
  situation_description: "",
  objectives: ["sentiment", "weaknesses", "competitors", "opportunities"],
  assumptions: [{ text: "" }],
  competitors: [],
  period_start: isoDate(-12),
  period_end: isoDate(0),
  source_categories: ["reddit", "review_platform", "app_store", "news", "industry_publication", "product_forum"],
  depth: "standard",
  competitor_target: 3,
  preferences: { include_contradictions: true, regional_comparison: true },
  notes: "",
  run_mode: "demo",
};

export const exampleBrief: Partial<StudioForm> = {
  name: "Lumenly Signals — ANZ market position",
  company: {
    name: "Lumenly",
    website: "https://lumenly.example",
    industry: "B2B SaaS — market & customer intelligence",
    product_name: "Lumenly Signals",
    description:
      "Lumenly Signals collects public customer conversations and competitor activity for mid-market e-commerce and subscription brands.",
    target_audience:
      "Heads of Growth, Retention and Product at D2C and subscription businesses with 10–500 employees.",
  },
  market: {
    global_scope: false,
    countries: ["AU", "NZ"],
    regions: ["Oceania"],
    comparison_pairs: [["AU", "NZ"]],
  },
  situation_key: "losing_customers",
  situation_description:
    "Renewal conversations have become harder over the last two quarters. Sales hears that pricing is the blocker.",
  objectives: ["sentiment", "weaknesses", "competitors", "opportunities", "pricing", "roadmap"],
  assumptions: [
    { text: "We believe customers are switching because subscription pricing is too expensive." },
    { text: "We believe support response times are a driver of cancellations." },
  ],
  competitors: [{ name: "Orbit Metrics", website: "" }, { name: "ClarityStack", website: "" }],
  depth: "standard",
  competitor_target: 3,
};

export const STEP_FIELDS: Record<number, (keyof StudioForm)[]> = {
  0: ["name", "company"],
  1: ["market"],
  2: ["situation_key", "situation_description"],
  3: ["objectives"],
  4: ["assumptions"],
  5: ["competitors"],
  6: ["source_categories", "depth", "competitor_target", "period_start", "period_end", "run_mode"],
};

export const STEPS = [
  { key: "company", title: "Company", caption: "Who is being studied" },
  { key: "market", title: "Market", caption: "Where to look" },
  { key: "situation", title: "Situation", caption: "Why now" },
  { key: "objectives", title: "Objectives", caption: "What to answer" },
  { key: "assumptions", title: "Assumptions", caption: "What to test" },
  { key: "competitors", title: "Competitors", caption: "Who to compare" },
  { key: "configuration", title: "Configuration", caption: "How deep to go" },
] as const;
