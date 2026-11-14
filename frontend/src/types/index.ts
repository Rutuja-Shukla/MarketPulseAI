export type Sentiment = "positive" | "negative" | "neutral" | "mixed";
export type Severity = "critical" | "high" | "medium" | "low";
export type Depth = "quick" | "standard" | "deep";
export type ProjectStatus = "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";

export interface User {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  is_demo: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Capabilities {
  demo_mode: boolean;
  search_provider: string;
  search_configured: boolean;
  llm_provider: string;
  llm_configured: boolean;
  live_research_available: boolean;
  job_runner: string;
  limitations: string[];
  demo_project_id: string | null;
  demo_credentials: { email: string; password: string } | null;
}

export interface Country {
  code: string;
  name: string;
  region: string;
}

export interface ModeOption {
  key: Depth;
  label: string;
  description: string;
  stages: number;
  query_budget: number;
  competitors: number;
  capabilities: string[];
}

export interface Catalog {
  countries: Country[];
  regions: string[];
  source_categories: { key: string; label: string; note: string }[];
  objectives: { key: string; label: string }[];
  situations: { key: string; label: string }[];
  modes: ModeOption[];
  topics: { key: string; label: string; description: string }[];
  monitoring_tracks: { key: string; label: string }[];
}

export interface Task {
  id: string;
  stage: string;
  agent: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  detail: string | null;
  result_count: number;
  order_index: number;
  started_at: string | null;
  finished_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  mode: Depth;
  status: ProjectStatus;
  is_demo: boolean;
  summary: string | null;
  current_stage: string | null;
  error_message: string | null;
  evidence_count: number;
  failure_count: number;
  opportunity_count: number;
  created_at: string;
  completed_at: string | null;
  product_name: string | null;
  company_name: string;
  countries: string[];
  global_scope: boolean;
  progress: number;
}

export interface ProjectConfiguration {
  global_scope: boolean;
  countries: string[];
  regions: string[];
  comparison_pairs: string[][];
  situation: string | null;
  situation_description: string | null;
  objectives: string[];
  assumptions: { text: string; status: string; rationale?: string; support_count?: number; contradict_count?: number }[];
  source_categories: string[];
  research_period_start: string | null;
  research_period_end: string | null;
  depth: Depth;
  competitor_target: number;
  analysis_preferences: Record<string, unknown>;
  notes: string | null;
}

export interface SourceInfo {
  id: string;
  name: string;
  category: string;
  provider: string;
  is_live: boolean;
  record_count: number;
  description: string | null;
  base_url: string | null;
}

export interface Competitor {
  id: string;
  name: string;
  website: string | null;
  is_primary: boolean;
  positioning: string | null;
  pricing_summary: string | null;
  strengths: string[];
  weaknesses: string[];
  sentiment_score: number | null;
  mention_count: number;
  source_count: number;
  is_suggested: boolean;
  observations: { dimension: string; value: string; score: number | null; evidence_id: string | null }[];
}

export interface ProjectDetail {
  project: Project;
  configuration: ProjectConfiguration | null;
  tasks: Task[];
  competitors: Competitor[];
  sources: SourceInfo[];
  company: {
    name: string;
    website: string | null;
    industry: string | null;
    description: string | null;
    target_audience: string | null;
  };
}

export interface ProjectStatusResponse {
  id: string;
  status: ProjectStatus;
  current_stage: string | null;
  error_message: string | null;
  progress: number;
  tasks: Task[];
  evidence_count: number;
  is_demo: boolean;
}

export interface Evidence {
  id: string;
  source_name: string;
  source_url: string | null;
  source_category: string;
  published_at: string | null;
  collected_at: string;
  title: string | null;
  excerpt: string;
  country: string | null;
  author_handle: string | null;
  rating: number | null;
  sentiment: Sentiment;
  sentiment_score: number;
  topics: string[];
  key_phrases: string[];
  credibility_score: number;
  credibility_label: "high" | "moderate" | "low";
  corroboration_count: number;
  duplicate_status: string;
  contradiction_group: string | null;
  is_demo: boolean;
  finding_ids: { id: string; type: "failure" | "opportunity"; title: string }[];
}

export interface Facet {
  value: string;
  count: number;
}

export interface EvidenceResponse {
  items: Evidence[];
  total: number;
  page: number;
  page_size: number;
  facets: { sources: Facet[]; sentiments: Facet[]; countries: Facet[] };
  demo: boolean;
  contradiction_count: number;
}

export interface Failure {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  summary: string;
  observed_complaint: string | null;
  interpretation: string | null;
  business_implications: string | null;
  recommended_actions: string[];
  evidence_ids: string[];
  evidence_count: number;
  source_count: number;
  representative_quote: string | null;
  first_observed: string | null;
  last_observed: string | null;
  sentiment_score: number;
  confidence: number;
  confidence_label: string;
  is_observed_complaint: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  category: string;
  description: string;
  demand_signal: string | null;
  competitor_comparison: string | null;
  strategic_relevance: string | null;
  next_action: string | null;
  evidence_ids: string[];
  evidence_count: number;
  impact_score: number;
  effort_score: number;
  confidence: number;
  quadrant: "quick_win" | "strategic_investment" | "long_term" | "low_priority";
  is_estimate: boolean;
}

export interface CustomerVoice {
  summary: {
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
    average_score: number;
  };
  complaint_categories: { key: string; label: string; count: number; negative: number; positive: number }[];
  praise_categories: { key: string; label: string; count: number; positive: number }[];
  feature_requests: { key: string; label: string; count: number; topic_key: string | null }[];
  topics: { key: string; label: string; count: number }[];
  evidence: Evidence[];
  filtered_total: number;
  facets: { sources: Facet[]; countries: Facet[]; sentiments: Facet[] };
  demo: boolean;
}

export interface CompetitorView {
  primary: Competitor | null;
  competitors: Competitor[];
  matrix: {
    dimensions: { key: string; label: string; topic: string | null }[];
    rows: {
      id: string;
      name: string;
      is_primary: boolean;
      scores: Record<string, number | null>;
      evidence_count: number;
    }[];
  };
  pricing: { name: string; pricing_summary: string | null; evidence: number; reliable: boolean }[];
  timeline: {
    date: string | null;
    title: string;
    competitor: string;
    source: string;
    sentiment: Sentiment;
  }[];
  insights: {
    competitor: string;
    mentions: number;
    sentiment_score: number | null;
    strengths: string[];
    weaknesses: string[];
    note: string;
  }[];
  demo: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  category: "complaint" | "expectation" | "weakness" | "competitor" | "trend" | "risk" | "opportunity" | "action";
  category_label: string;
  detail: string;
  confidence: number;
  evidence_ids: string[];
  meta: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  rationale: string | null;
  confidence: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  legend: Record<string, { label: string; color: string }>;
  relationship_types: string[];
}

export interface Analytics {
  totals: {
    evidence: number;
    sources: number;
    countries: number;
    failures: number;
    opportunities: number;
    competitors: number;
    positive: number;
    negative: number;
    neutral: number;
  };
  sentiment_trend: { months: string[]; positive: number[]; negative: number[]; neutral: number[] };
  pain_points: { topic: string; key: string; count: number }[];
  benchmark_dimensions: string[];
  benchmark_series: { name: string; is_primary: boolean; values: number[]; mention_count: number }[];
  opportunity_matrix: {
    id: string;
    title: string;
    impact: number;
    effort: number;
    quadrant: string;
    confidence: number;
  }[];
  geography: { country: string; records: number; sentiment: number; positive: number; negative: number }[];
  topic_trends: {
    label: string;
    trend: "emerging" | "declining" | "stable";
    series: { month: string; count: number }[];
    evidence_count: number;
    kind: string;
  }[];
  source_distribution: { source: string; count: number }[];
  timeline: { date: string; label: string; category: string; sentiment: Sentiment; source: string }[];
  severity_breakdown: { severity: Severity; count: number }[];
  demo: boolean;
  project_name: string;
}

export interface ReportItem {
  title: string;
  meta?: string;
  body?: string;
  quote?: string;
  url?: string;
}

export interface ReportSection {
  key: string;
  title: string;
  type: string;
  body: string;
  items?: ReportItem[];
}

export interface Report {
  id: string;
  title: string;
  version: number;
  executive_summary: string;
  sections: ReportSection[];
  limitations: string[];
  reference_ids: string[];
  generated_at: string | null;
  provider: string;
  is_demo: boolean;
}

export interface RoadmapItem {
  id: string;
  finding_type: "failure" | "opportunity";
  finding_id: string | null;
  title: string;
  problem: string | null;
  improvement: string | null;
  expected_impact: string | null;
  complexity: string;
  priority: string;
  horizon: "immediate" | "short_term" | "medium_term" | "long_term";
  confidence: number;
  success_metrics: string[];
  status: "planned" | "in_progress" | "completed" | "parked";
  notes: string | null;
  order_index: number;
}

export interface Scenario {
  id: string;
  name: string;
  prompt: string;
  assumptions: string[];
  advantages: string[];
  disadvantages: string[];
  competitor_responses: string[];
  risks: string[];
  evidence_ids: string[];
  confidence: number;
  provider: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: {
    id?: string;
    source_name?: string;
    source_url?: string;
    excerpt?: string;
    sentiment?: string;
    published_at?: string;
    is_demo?: boolean;
  }[];
  retrieval_trace: { step: string; detail: string }[];
  provider: string;
  created_at: string;
}

export interface ChatHistory {
  conversation_id: string | null;
  messages: ChatMessage[];
  suggestions: string[];
}

export interface NotificationItem {
  id: string;
  project_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  action_route: string | null;
  created_at: string;
}

export interface DashboardData {
  metrics: {
    projects: number;
    completed: number;
    evidence: number;
    failures: number;
    critical_risks: number;
    opportunities: number;
    unread_notifications: number;
  };
  recent_projects: Project[];
  completed_projects: Project[];
  notifications: NotificationItem[];
  demo_mode: boolean;
  live_research_available: boolean;
}

export interface MonitoringEntry {
  id: string;
  project_id: string;
  enabled: boolean;
  interval: string;
  track: string[];
  last_run_at: string | null;
  next_run_at: string | null;
  execution_mode: string;
  change_summary: {
    new_records: number;
    sentiment_positive_share: number;
    sentiment_recent_share: number;
    sentiment_delta: number;
    latest_signal: { title: string | null; source: string; date: string | null; sentiment: string } | null;
    complaint_watch: { title: string; severity: string; evidence: number }[];
    opportunity_watch: { title: string; impact: number; quadrant: string }[];
    execution_mode: string;
    notice: string;
  };
}

export interface MonitoringList {
  entries: { project: Project; monitoring: MonitoringEntry }[];
  total: number;
}
