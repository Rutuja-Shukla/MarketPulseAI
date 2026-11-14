import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "@/pages/Landing";
import { LoginPage } from "@/pages/Login";
import { RegisterPage } from "@/pages/Register";
import { DashboardPage } from "@/pages/Dashboard";
import { ResearchStudioPage } from "@/pages/ResearchStudio";
import { MonitoringPage } from "@/pages/Monitoring";
import { NotFound } from "@/components/layout/NotFound";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { LoadingBlock } from "@/components/ui/Feedback";

const AnalysisLayout = lazy(() => import("@/pages/analysis/AnalysisLayout"));
const ProjectOverview = lazy(() => import("@/pages/analysis/Overview"));
const FailuresPage = lazy(() => import("@/pages/analysis/Failures"));
const OpportunitiesPage = lazy(() => import("@/pages/analysis/Opportunities"));
const CustomerVoicePage = lazy(() => import("@/pages/analysis/CustomerVoice"));
const CompetitorsPage = lazy(() => import("@/pages/analysis/Competitors"));
const GraphPage = lazy(() => import("@/pages/analysis/IntelligenceGraph"));
const AnalyticsPage = lazy(() => import("@/pages/analysis/Analytics"));
const RoadmapPage = lazy(() => import("@/pages/analysis/Roadmap"));
const SimulatorPage = lazy(() => import("@/pages/analysis/Simulator"));
const EvidencePage = lazy(() => import("@/pages/analysis/Evidence"));
const ReportPage = lazy(() => import("@/pages/analysis/Report"));

function Suspenseful({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="page-shell py-20">
          <LoadingBlock label="Loading analysis view" rows={4} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/research/new"
          element={
            <ProtectedRoute>
              <ResearchStudioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <MonitoringPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analysis/:projectId"
          element={
            <ProtectedRoute>
              <Suspenseful>
                <AnalysisLayout />
              </Suspenseful>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<ProjectOverview />} />
          <Route path="failures" element={<FailuresPage />} />
          <Route path="opportunities" element={<OpportunitiesPage />} />
          <Route path="customer-voice" element={<CustomerVoicePage />} />
          <Route path="competitors" element={<CompetitorsPage />} />
          <Route path="intelligence-graph" element={<GraphPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="simulator" element={<SimulatorPage />} />
          <Route path="evidence" element={<EvidencePage />} />
          <Route path="report" element={<ReportPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}
