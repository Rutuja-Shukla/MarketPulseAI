import { useOutletContext } from "react-router-dom";
import type { Project, ProjectDetail, ProjectStatusResponse } from "@/types";

export interface AnalysisOutletContext {
  project: Project;
  detail: ProjectDetail;
  currentStatus?: ProjectStatusResponse;
}

export function useAnalysisContext(): AnalysisOutletContext {
  return useOutletContext<AnalysisOutletContext>();
}
