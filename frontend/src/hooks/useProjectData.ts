import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Analytics,
  CompetitorView,
  CustomerVoice,
  EvidenceResponse,
  Failure,
  GraphData,
  Opportunity,
  ProjectDetail,
  ProjectStatusResponse,
  Report,
  RoadmapItem,
  Scenario,
} from "@/types";

export function useProjectDetail(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: Boolean(projectId),
  });
}

export function useProjectStatus(projectId: string | undefined, poll = false) {
  return useQuery({
    queryKey: ["project-status", projectId],
    queryFn: () => api.get<ProjectStatusResponse>(`/projects/${projectId}/status`),
    enabled: Boolean(projectId),
    refetchInterval: poll ? 1500 : false,
  });
}

export function useFailures(projectId: string | undefined) {
  return useQuery({
    queryKey: ["failures", projectId],
    queryFn: () => api.get<Failure[]>(`/projects/${projectId}/failures`),
    enabled: Boolean(projectId),
  });
}

export function useOpportunities(projectId: string | undefined) {
  return useQuery({
    queryKey: ["opportunities", projectId],
    queryFn: () => api.get<Opportunity[]>(`/projects/${projectId}/opportunities`),
    enabled: Boolean(projectId),
  });
}

export function useCustomerVoice(projectId: string | undefined, query: string) {
  return useQuery({
    queryKey: ["customer-voice", projectId, query],
    queryFn: () => api.get<CustomerVoice>(`/projects/${projectId}/customer-voice?${query}`),
    enabled: Boolean(projectId),
  });
}

export function useCompetitors(projectId: string | undefined) {
  return useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api.get<CompetitorView>(`/projects/${projectId}/competitors`),
    enabled: Boolean(projectId),
  });
}

export function useGraph(projectId: string | undefined, filters: string) {
  return useQuery({
    queryKey: ["graph", projectId, filters],
    queryFn: () => api.get<GraphData>(`/projects/${projectId}/graph?${filters}`),
    enabled: Boolean(projectId),
  });
}

export function useAnalytics(projectId: string | undefined) {
  return useQuery({
    queryKey: ["analytics", projectId],
    queryFn: () => api.get<Analytics>(`/projects/${projectId}/analytics`),
    enabled: Boolean(projectId),
  });
}

export function useEvidence(projectId: string | undefined, query: string, page: number) {
  return useQuery({
    queryKey: ["evidence", projectId, query, page],
    queryFn: () => api.get<EvidenceResponse>(`/projects/${projectId}/evidence?${query}&page=${page}`),
    enabled: Boolean(projectId),
  });
}

export function useReport(projectId: string | undefined) {
  return useQuery({
    queryKey: ["report", projectId],
    queryFn: () => api.get<Report>(`/projects/${projectId}/report`),
    enabled: Boolean(projectId),
    retry: false,
  });
}

export function useRoadmap(projectId: string | undefined) {
  return useQuery({
    queryKey: ["roadmap", projectId],
    queryFn: () => api.get<RoadmapItem[]>(`/projects/${projectId}/roadmap`),
    enabled: Boolean(projectId),
  });
}

export function useScenarios(projectId: string | undefined) {
  return useQuery({
    queryKey: ["scenarios", projectId],
    queryFn: () => api.get<Scenario[]>(`/projects/${projectId}/scenarios`),
    enabled: Boolean(projectId),
  });
}
