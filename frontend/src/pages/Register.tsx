import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/hooks/useAuth";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", company_name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        company_name: form.company_name || undefined,
      });
      navigate("/research/new", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="page-shell flex h-16 items-center justify-between">
        <Logo />
        <Link to="/login" className="text-[12.5px] text-muted hover:text-ink">
          Already have an account
        </Link>
      </header>
      <div className="page-shell grid flex-1 items-center gap-16 py-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="eyebrow">Create an account</div>
          <h1 className="headline mt-4">Start with a question.</h1>
          <p className="mt-5 max-w-[42ch] text-[14px] leading-relaxed text-muted">
            The research studio turns a company, a market and a set of assumptions into a structured
            investigation. You can start in demonstration mode and connect live search later.
          </p>
          <div className="mt-10 space-y-4 border-t border-line pt-6">
            {[
              ["Evidence before conclusions", "Every finding keeps the records that produced it."],
              ["Regions and comparisons", "Select countries, regions or the global market."],
              ["Exportable deliverables", "Executive report, roadmap and evidence references."],
            ].map(([title, body]) => (
              <div key={title}>
                <div className="text-[12.5px] text-ink">{title}</div>
                <div className="text-[11.5px] leading-relaxed text-muted">{body}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <form onSubmit={onSubmit} className="surface space-y-4 p-6 md:p-8">
            <div className="eyebrow mb-2">Account details</div>
            <TextField
              label="Full name"
              required
              autoComplete="name"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              placeholder="Avery Chen"
            />
            <TextField
              label="Company"
              hint="Optional"
              autoComplete="organization"
              value={form.company_name}
              onChange={(event) => setForm({ ...form, company_name: event.target.value })}
              placeholder="Lumenly"
            />
            <TextField
              label="Work email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="you@company.com"
            />
            <TextField
              label="Password"
              type="password"
              required
              hint="At least 8 characters"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="••••••••"
            />
            {error ? (
              <p className="border border-negative/30 bg-negative/[0.05] px-3 py-2 text-[12px] text-negative">{error}</p>
            ) : null}
            <Button type="submit" className="w-full justify-between" loading={busy} icon={<ArrowRight className="h-4 w-4" />}>
              Create account
            </Button>
            <p className="text-[11px] leading-relaxed text-muted">
              By creating an account you accept that research findings are interpretations of public
              evidence and not financial advice.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
