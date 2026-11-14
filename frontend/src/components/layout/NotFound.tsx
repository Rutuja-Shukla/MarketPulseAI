import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-start justify-center">
      <div className="eyebrow mb-4">404 — Not found</div>
      <h1 className="headline max-w-xl">This page is not part of the research record.</h1>
      <p className="mt-4 max-w-md text-[14px] text-muted">
        The page you were looking for does not exist, or the research project is no longer available.
      </p>
      <Link to="/dashboard" className="mt-8">
        <Button>Return to workspace</Button>
      </Link>
    </div>
  );
}
