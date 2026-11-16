import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CircleDot,
  FileText,
  GitBranch,
  Layers,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { HeroSignal } from "@/components/marketing/HeroSignal";
import { GraphPreview } from "@/components/marketing/GraphPreview";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Capabilities, DashboardData } from "@/types";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const steps = [
  {
    number: "01",
    title: "Frame the question",
    body: "Define the company, product, markets and the assumptions you want tested. Comparisons like Australia vs New Zealand are first-class, not an afterthought.",
  },
  {
    number: "02",
    title: "Collect permitted signals",
    body: "A configurable search provider gathers public conversations, reviews, competitor pages and industry reporting — with the source and category attached to every record.",
  },
  {
    number: "03",
    title: "Validate before concluding",
    body: "Records are deduplicated, scored for credibility and checked for corroboration and contradiction. Weak evidence stays weak, and the report says so.",
  },
  {
    number: "04",
    title: "Decide with traceability",
    body: "Findings become radars, a relationship graph, a prioritised roadmap and an executive report where every claim links back to the record behind it.",
  },
];

const failureExample = [
  { title: "Pricing & perceived value", severity: "Critical", records: 9, note: "Corroborated across review platforms and community threads." },
  { title: "Support responsiveness", severity: "High", records: 7, note: "Response time, not effort, is the recurring frustration." },
  { title: "Reporting flexibility", severity: "Medium", records: 5, note: "Analysts rebuild scheduled reports manually." },
];

const opportunityExample = [
  { title: "Workspace-based plans", impact: 82, effort: 46 },
  { title: "Scheduled report delivery", impact: 74, effort: 38 },
  { title: "Multi-store connector", impact: 76, effort: 58 },
];

export function LandingPage() {
  const { user, demoLogin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [radar, setRadar] = useState<"failure" | "opportunity">("failure");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function openDemo() {
    setDemoLoading(true);
    setDemoError(null);
    try {
      if (!user) await demoLogin();
      const dashboard = await api.get<DashboardData>("/dashboard");
      const demoProject =
        dashboard.recent_projects.find((project) => project.is_demo) ??
        dashboard.recent_projects[0];
      if (demoProject) navigate(`/analysis/${demoProject.id}/overview`);
      else navigate("/dashboard");
    } catch (error) {
      setDemoError(
        error instanceof Error ? error.message : "Demonstration mode is unavailable right now.",
      );
      const capabilities = await api.get<Capabilities>("/meta/capabilities").catch(() => null);
      if (capabilities?.demo_mode) navigate("/login?demo=1");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="page-shell flex h-[68px] items-center justify-between gap-6">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Marketing">
            <a href="#method" className="link-underline text-[12.5px] text-muted hover:text-ink">
              Method
            </a>
            <a href="#radars" className="link-underline text-[12.5px] text-muted hover:text-ink">
              Radars
            </a>
            <a href="#graph" className="link-underline text-[12.5px] text-muted hover:text-ink">
              Intelligence graph
            </a>
            <a href="#report" className="link-underline text-[12.5px] text-muted hover:text-ink">
              Report
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-line bg-paper text-muted transition-colors hover:border-positive/40 hover:text-ink"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" variant="outline">
                  Workspace
                </Button>
              </Link>
            ) : (
              <Link to="/login" className="hidden text-[12.5px] text-muted hover:text-ink sm:block">
                Sign in
              </Link>
            )}
            <Link to="/research/new">
              <Button size="sm" icon={<ArrowUpRight className="h-3.5 w-3.5" />}>
                Start an analysis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-subtle/70 to-transparent" aria-hidden />
        <div className="page-shell relative grid gap-16 pb-24 pt-16 md:pt-24 lg:grid-cols-12 lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 lg:pr-10"
          >
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden />
              <span className="eyebrow">Market intelligence, evidence first</span>
            </div>
            <h1 className="display mt-7 text-ink">
              See what the
              <br />
              market sees.
            </h1>
            <p className="mt-6 max-w-[34ch] font-serif text-[clamp(1.35rem,2.2vw,1.85rem)] leading-[1.25] text-muted">
              Discover what your business is missing — and what to do about it.
            </p>
            <p className="mt-6 max-w-[54ch] text-[15px] leading-relaxed text-muted">
              MarketPulse turns public conversations, competitor moves and market signals into a
              traceable intelligence report. Every weakness, opportunity and recommendation is
              linked to the evidence it came from.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/research/new">
                <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                  Start an analysis
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                onClick={openDemo}
                loading={demoLoading}
                icon={<CircleDot className="h-4 w-4" />}
              >
                Explore the demonstration
              </Button>
            </div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Works without paid API keys in demonstration mode · live mode when you connect a provider
            </p>
            {demoError ? <p className="mt-3 text-[12px] text-negative">{demoError}</p> : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 lg:pl-4"
          >
            <HeroSignal />
          </motion.div>
        </div>
      </section>

      {/* Fact strip */}
      <section className="border-y border-line bg-subtle/50">
        <div className="page-shell grid grid-cols-2 gap-y-8 py-9 md:grid-cols-4">
          {[
            ["09", "Stage research pipeline"],
            ["08", "Source categories"],
            ["01", "Evidence ledger"],
            ["00", "Invented citations"],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-4 md:justify-center">
              <span className="mono text-[1.6rem] leading-none text-ink">{value}</span>
              <span className="max-w-[10ch] text-[11px] uppercase leading-tight tracking-[0.08em] text-muted">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Method */}
      <section id="method" className="page-shell py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-12">
          <motion.div {...fadeUp} className="lg:col-span-4">
            <div className="eyebrow">The method</div>
            <h2 className="headline mt-4">
              Research that shows
              <br />
              its working.
            </h2>
            <p className="mt-5 max-w-[38ch] text-[14px] leading-relaxed text-muted">
              A single prompt cannot produce trustworthy market intelligence. MarketPulse runs a
              structured pipeline: questions, sources, evidence, validation, then conclusions.
            </p>
            <Link
              to="/research/new"
              className="link-underline mt-8 inline-flex text-[13px] text-navy"
            >
              See the research studio <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>

          <div className="lg:col-span-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: index * 0.06 }}
                  className="surface p-6 md:p-7"
                >
                  <div className="flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted">
                      {step.number}
                    </span>
                    {index === 0 ? <Layers className="h-3.5 w-3.5 text-muted" /> : null}
                    {index === 1 ? <GitBranch className="h-3.5 w-3.5 text-muted" /> : null}
                    {index === 2 ? <ShieldCheck className="h-3.5 w-3.5 text-muted" /> : null}
                    {index === 3 ? <FileText className="h-3.5 w-3.5 text-muted" /> : null}
                  </div>
                  <h3 className="mt-6 text-[19px] leading-snug">{step.title}</h3>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-muted">{step.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Radars */}
      <section id="radars" className="border-y border-line bg-subtle/40 py-24 md:py-32">
        <div className="page-shell">
          <motion.div {...fadeUp} className="max-w-2xl">
            <div className="eyebrow">Two radars</div>
            <h2 className="headline mt-4">Where you are losing, and where you could win.</h2>
            <p className="mt-5 text-[14px] leading-relaxed text-muted">
              Failure Radar reads the evidence for friction, severity and support. Opportunity Radar
              reads the same evidence for unmet needs, gaps and expansion. Neither is a generic
              score — each finding expands into the records behind it.
            </p>
          </motion.div>

          <div className="mt-10 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRadar("failure")}
              aria-pressed={radar === "failure"}
              className={cn(
                "rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                radar === "failure"
                  ? "border-navy bg-navy text-canvas dark:text-[#10161c]"
                  : "border-line text-muted hover:border-muted/50 hover:text-ink",
              )}
            >
              Failure Radar
            </button>
            <button
              type="button"
              onClick={() => setRadar("opportunity")}
              aria-pressed={radar === "opportunity"}
              className={cn(
                "rounded-full border px-4 py-2 text-[12.5px] font-semibold transition-colors",
                radar === "opportunity"
                  ? "border-navy bg-navy text-canvas dark:text-[#10161c]"
                  : "border-line text-muted hover:border-muted/50 hover:text-ink",
              )}
            >
              Opportunity Radar
            </button>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-12">
            <motion.div key={radar} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="surface p-6 lg:col-span-7 md:p-8">
              {radar === "failure" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">Observed weaknesses</span>
                    <Badge tone="warning">Illustrative</Badge>
                  </div>
                  <div className="mt-6 divide-y divide-line">
                    {failureExample.map((item, index) => (
                      <div key={item.title} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="flex items-baseline gap-3">
                            <span className="mono text-[10px] text-muted">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="text-[14px] text-ink">{item.title}</span>
                          </div>
                          <Badge
                            tone={
                              item.severity === "Critical"
                                ? "negative"
                                : item.severity === "High"
                                  ? "warning"
                                  : "navy"
                            }
                          >
                            {item.severity}
                          </Badge>
                        </div>
                        <p className="mt-2 pl-7 text-[12px] leading-relaxed text-muted">
                          {item.note} · {item.records} supporting records
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">Impact vs effort</span>
                    <Badge tone="warning">AI-assisted estimates</Badge>
                  </div>
                  <div className="relative mt-6 h-[240px] border border-line bg-canvas">
                    <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
                    <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-line" />
                    <span className="mono absolute left-3 top-2 text-[8.5px] uppercase tracking-[0.12em] text-muted">
                      High impact
                    </span>
                    <span className="mono absolute bottom-2 left-3 text-[8.5px] uppercase tracking-[0.12em] text-muted">
                      Low effort → right
                    </span>
                    {opportunityExample.map((item, index) => (
                      <div
                        key={item.title}
                        className="group absolute"
                        style={{
                          left: `${item.effort - 4}%`,
                          bottom: `${item.impact - 8}%`,
                        }}
                      >
                        <span
                          className={cn(
                            "block h-2.5 w-2.5 rounded-full ring-4",
                            index === 0
                              ? "bg-positive ring-positive/15"
                              : index === 1
                                ? "bg-accent ring-accent/15"
                                : "bg-warning ring-warning/15",
                          )}
                        />
                        <span className="mono absolute left-4 top-1/2 w-[130px] -translate-y-1/2 text-[9px] uppercase leading-tight tracking-[0.06em] text-muted">
                          {item.title}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
                    Quadrants label quick wins, strategic investments, long-term bets and low-priority
                    initiatives. Scores are qualitative assessments, not forecast revenue.
                  </p>
                </div>
              )}
            </motion.div>

            <motion.div {...fadeUp} className="lg:col-span-5">
              <div className="border-l border-line pl-6">
                <h3 className="text-[22px] leading-snug">
                  {radar === "failure"
                    ? "A complaint is a signal, not a verdict."
                    : "An opportunity is a hypothesis, not a promise."}
                </h3>
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  {radar === "failure"
                    ? "MarketPulse separates the observed complaint from the business interpretation. Severity reflects volume, source diversity and corroboration — and confidence is shown next to every finding."
                    : "Impact and effort are AI-assisted assessments for prioritisation. The platform never presents them as measured commercial outcomes, and every opportunity keeps its demand evidence attached."}
                </p>
                <ul className="mt-6 space-y-3">
                  {(radar === "failure"
                    ? ["Severity across four levels", "Representative quote, linked to source", "First and last observed dates", "Recommended corrective actions"]
                    : ["Demand signal from real records", "Competitor comparison where evidenced", "Quadrant classification", "Recommended next action"]
                  ).map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[12.5px] text-muted">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/research/new"
                  className="link-underline mt-8 inline-flex text-[13px] text-navy"
                >
                  Build your own <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Graph */}
      <section id="graph" className="page-shell py-24 md:py-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <motion.div {...fadeUp} className="lg:col-span-4">
            <div className="eyebrow">Intelligence graph</div>
            <h2 className="headline mt-4">The argument, made visible.</h2>
            <p className="mt-5 text-[14px] leading-relaxed text-muted">
              Complaints connect to expectations, weaknesses to risks, competitor strengths to
              switching pressure, and risks to the opportunities that relieve them. Filter by
              relationship, follow a chain, open the evidence.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {["Complaint", "Weakness", "Risk", "Competitor", "Opportunity", "Action"].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted"
                >
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
          <motion.div {...fadeUp} className="lg:col-span-8">
            <GraphPreview />
          </motion.div>
        </div>
      </section>

      {/* Report */}
      <section id="report" className="border-y border-line bg-subtle/40 py-24 md:py-32">
        <div className="page-shell grid gap-14 lg:grid-cols-12">
          <motion.div {...fadeUp} className="lg:col-span-5">
            <div className="eyebrow">The deliverable</div>
            <h2 className="headline mt-4">A report you can defend in a board meeting.</h2>
            <p className="mt-5 text-[14px] leading-relaxed text-muted">
              Thirteen sections, written as a strategy deliverable rather than a chat transcript:
              situation, sentiment, complaints, weaknesses, competitor intelligence, opportunities,
              risks, recommendations, roadmap, references and limitations. Export to PDF, print, or
              hand over the evidence references.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={openDemo} loading={demoLoading} icon={<FileText className="h-4 w-4" />}>
                Open the sample report
              </Button>
              <Link to="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
            </div>
          </motion.div>

          <motion.div {...fadeUp} className="lg:col-span-7">
            <div className="surface relative p-7 shadow-lift md:p-9">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
                  Executive intelligence report · v1
                </span>
                <Badge tone="warning">Demo data</Badge>
              </div>
              <h3 className="mt-6 font-serif text-[26px] leading-tight">
                Lumenly — Market intelligence assessment
              </h3>
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                Pricing friction and support responsiveness dominate negative market signals, while
                reporting flexibility and regional payment support are the clearest expansion
                openings.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["42", "Evidence records"],
                  ["7", "Source categories"],
                  ["11", "Findings"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-sm bg-subtle px-4 py-3">
                    <div className="mono text-[18px] leading-none">{value}</div>
                    <div className="mt-1 text-[9.5px] uppercase tracking-[0.1em] text-muted">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2">
                {[
                  "Executive summary",
                  "Customer sentiment",
                  "Key customer complaints",
                  "Competitor intelligence",
                  "Growth opportunities",
                  "Strategic recommendations",
                  "Research limitations",
                ].map((section, index) => (
                  <div
                    key={section}
                    className="flex items-center justify-between border-b border-line py-2 text-[12px] last:border-b-0"
                  >
                    <span className="text-ink">{section}</span>
                    <span className="mono text-[9.5px] text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                DEMO DATA — illustrative findings, not live market research
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Closing */}
      <section className="page-shell py-24 md:py-32">
        <div className="grid gap-10 border-t border-line pt-16 lg:grid-cols-12">
          <motion.div {...fadeUp} className="lg:col-span-8">
            <div className="eyebrow">Begin</div>
            <h2 className="display mt-5 max-w-[16ch] text-[clamp(2.4rem,5vw,4.2rem)]">
              Find the gap before the market does.
            </h2>
          </motion.div>
          <motion.div {...fadeUp} className="flex flex-col items-start justify-end gap-4 lg:col-span-4">
            <Link to="/research/new" className="w-full">
              <Button size="lg" className="w-full justify-between" icon={<ArrowRight className="h-4 w-4" />}>
                Start an analysis
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="w-full justify-between" onClick={openDemo} loading={demoLoading}>
              Explore the demonstration
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <p className="text-[11px] leading-relaxed text-muted">
              Demonstration mode uses a synthetic corpus. Nothing in it is presented as live research.
            </p>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-line bg-subtle/40">
        <div className="page-shell grid gap-10 py-14 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo />
            <p className="mt-5 max-w-[32ch] text-[12.5px] leading-relaxed text-muted">
              Market intelligence, product analysis and strategic opportunity discovery for teams
              that need to explain their decisions.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:col-span-4">
            <div>
              <div className="eyebrow mb-3">Product</div>
              <ul className="space-y-2 text-[12.5px] text-muted">
                <li><Link className="hover:text-ink" to="/research/new">Research studio</Link></li>
                <li><Link className="hover:text-ink" to="/monitoring">Market monitor</Link></li>
                <li><Link className="hover:text-ink" to="/login">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <div className="eyebrow mb-3">Method</div>
              <ul className="space-y-2 text-[12.5px] text-muted">
                <li><a className="hover:text-ink" href="#method">Research pipeline</a></li>
                <li><a className="hover:text-ink" href="#radars">Failure &amp; opportunity</a></li>
                <li><a className="hover:text-ink" href="#report">Reporting</a></li>
              </ul>
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="eyebrow mb-3">Demonstration</div>
            <p className="text-[12px] leading-relaxed text-muted">
              No API keys required. Live mode activates when a search provider is configured.
            </p>
            <p className="mono mt-4 text-[10px] uppercase tracking-[0.12em] text-muted">
              MarketPulse AI · 2026
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
