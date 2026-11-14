import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Unhandled UI error", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-shell flex min-h-[70vh] flex-col items-start justify-center">
          <div className="eyebrow mb-3">Unexpected error</div>
          <h1 className="headline max-w-xl">Something in this view broke.</h1>
          <p className="mt-4 max-w-lg text-[13.5px] leading-relaxed text-muted">
            The rest of the workspace is unaffected. Reload the page to continue, or return to the
            dashboard.
          </p>
          <p className="mono mt-4 max-w-lg break-words text-[11px] text-muted">{this.state.message}</p>
          <div className="mt-8 flex gap-3">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
              Dashboard
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
