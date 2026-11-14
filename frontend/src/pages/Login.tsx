import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import type { Capabilities } from "@/types";

export function LoginPage() {
  const { user, login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  useEffect(() => {
    api.get<Capabilities>("/meta/capabilities").then(setCapabilities).catch(() => setCapabilities(null));
  }, []);

  useEffect(() => {
    if (user) {
      const next = params.get("next");
      navigate(next ?? "/dashboard", { replace: true });
    }
  }, [user, navigate, params]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(params.get("next") ?? "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  async function onDemo() {
    setBusy(true);
    setError(null);
    try {
      await demoLogin();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demonstration access is unavailable");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between border-r border-line p-8 md:p-12">
        <Logo />
        <div className="max-w-md py-16">
          <div className="eyebrow">Welcome back</div>
          <h1 className="headline mt-4">Return to the evidence.</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-muted">
            Sign in to continue a research project, inspect the evidence ledger or export an
            intelligence report.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="analyst@company.com"
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
            />
            {error ? (
              <p className="border border-negative/30 bg-negative/[0.05] px-3 py-2 text-[12px] text-negative">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full justify-between" loading={busy} icon={<ArrowRight className="h-4 w-4" />}>
              Sign in
            </Button>
          </form>
          <p className="mt-6 text-[12.5px] text-muted">
            No account?{" "}
            <Link to="/register" className="link-underline text-navy">
              Create one
            </Link>
          </p>
        </div>
        <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
          MarketPulse AI · evidence-led market intelligence
        </p>
      </div>

      <div className="relative hidden flex-col justify-center bg-subtle/60 p-12 lg:flex">
        <div className="hairline-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="relative max-w-md">
          <div className="eyebrow">Demonstration workspace</div>
          <h2 className="mt-4 font-serif text-[30px] leading-tight">
            Explore a complete analysis without any API key.
          </h2>
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            A fictional company, a synthetic evidence corpus and a full set of findings. Every record is
            labelled as demonstration data — nothing is presented as live market research.
          </p>
          <div className="surface mt-7 p-5">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] uppercase tracking-[0.12em] text-muted">Demo credentials</span>
              <CircleDot className="h-3.5 w-3.5 text-positive" aria-hidden />
            </div>
            <div className="mono mt-3 space-y-1 text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="text-muted">Email</span>
                <span>{capabilities?.demo_credentials?.email ?? "demo@marketpulse.ai"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted">Password</span>
                <span>{capabilities?.demo_credentials?.password ?? "DemoPass123!"}</span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-5 w-full justify-between"
            onClick={onDemo}
            loading={busy}
            disabled={!capabilities?.demo_mode}
          >
            Enter the demonstration workspace
            <ArrowRight className="h-4 w-4" />
          </Button>
          {capabilities && !capabilities.demo_mode ? (
            <p className="mt-3 text-[11.5px] text-warning">Demonstration mode is disabled on this server.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
