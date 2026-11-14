"""Domain taxonomy shared by research, analysis and chat modules.

Keeping the vocabulary in one place means the live pipeline and the
demonstration dataset are classified by exactly the same rules.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TopicDefinition:
    key: str
    label: str
    complaint_label: str
    praise_label: str
    request_label: str
    description: str
    keywords: tuple[str, ...]
    failure_severity_hint: str = "medium"
    business_implication: str = ""
    actions: tuple[str, ...] = field(default_factory=tuple)


TOPIC_DEFINITIONS: tuple[TopicDefinition, ...] = (
    TopicDefinition(
        key="pricing",
        label="Pricing & perceived value",
        complaint_label="Pricing concerns",
        praise_label="Value for money",
        request_label="Plan and billing requests",
        description="Perceptions of price, plan structure and value relative to alternatives.",
        keywords=(
            "price", "pricing", "expensive", "cost", "costly", "cheaper", "billing", "invoice",
            "subscription cost", "overpriced", "budget", "plan", "plans", "quota", "per seat",
            "per-seat", "value for money", "renewal",
        ),
        failure_severity_hint="high",
        business_implication=(
            "Persistent pricing friction can weaken perceived value and increase switching pressure "
            "at renewal, particularly for smaller accounts."
        ),
        actions=(
            "Model a usage-based or tiered plan for smaller teams",
            "Publish a transparent value comparison against named competitors",
            "Run win/loss interviews on price objections",
        ),
    ),
    TopicDefinition(
        key="customer_service",
        label="Customer support",
        complaint_label="Customer service",
        praise_label="Support experience",
        request_label="Support expectations",
        description="Responsiveness, quality and tone of human and automated support.",
        keywords=(
            "support", "customer service", "ticket", "response time", "helpdesk", "agent",
            "chat support", "email support", "escalation", "no reply", "ignored", "account manager",
            "onboarding call", "ait", "help center",
        ),
        failure_severity_hint="high",
        business_implication=(
            "Support delays are repeatedly linked to cancellation intent in public posts, which "
            "suggests a retention risk rather than a purely operational one."
        ),
        actions=(
            "Introduce tiered response-time SLAs with public targets",
            "Add a self-serve status and ticket visibility page",
            "Review escalation paths for billing and data issues",
        ),
    ),
    TopicDefinition(
        key="performance",
        label="Product performance",
        complaint_label="Product performance",
        praise_label="Speed and reliability",
        request_label="Performance requests",
        description="Load times, dashboard latency and data refresh speed.",
        keywords=(
            "slow", "lag", "laggy", "timeout", "loading", "load time", "performance", "fast",
            "speed", "refresh", "delay", "freeze", "crash", "unresponsive", "heavy dashboard",
        ),
        failure_severity_hint="high",
        business_implication=(
            "Performance complaints cluster around month-end reporting windows, when the product "
            "carries the most business value."
        ),
        actions=(
            "Profile dashboard queries during month-end load",
            "Introduce cached aggregates for large workspaces",
            "Publish performance status during peak periods",
        ),
    ),
    TopicDefinition(
        key="usability",
        label="User experience",
        complaint_label="User experience",
        praise_label="Ease of use",
        request_label="UX requests",
        description="Learnability, navigation clarity and information architecture.",
        keywords=(
            "confusing", "interface", "ui", "ux", "navigation", "hard to find", "clunky",
            "workflow", "click", "intuitive", "easy to use", "learning curve", "onboarding flow",
            "dashboard layout", "filter",
        ),
        failure_severity_hint="medium",
        business_implication=(
            "Usability friction lengthens time-to-first-value and shows up in trial conversion "
            "discussions."
        ),
        actions=(
            "Re-run first-run setup usability tests",
            "Consolidate navigation into task-based groups",
            "Add in-product guidance for recurring workflows",
        ),
    ),
    TopicDefinition(
        key="missing_features",
        label="Missing capabilities",
        complaint_label="Missing functionality",
        praise_label="Capability depth",
        request_label="Feature requests",
        description="Capabilities customers expect but cannot yet use.",
        keywords=(
            "missing", "no way to", "wish", "feature request", "doesn't support", "does not support",
            "would love", "need an option", "feature", "can't export", "no api", "no integration",
            "would like", "add support", "roadmap",
        ),
        failure_severity_hint="medium",
        business_implication=(
            "Capability gaps are explicitly cited in competitor-switching narratives, which makes "
            "them commercially material rather than cosmetic."
        ),
        actions=(
            "Cluster requests by customer segment and revenue weight",
            "Ship the narrowest version of the top two requests",
            "Publish a public roadmap with commitment levels",
        ),
    ),
    TopicDefinition(
        key="subscription_management",
        label="Subscription management",
        complaint_label="Subscription management",
        praise_label="Billing flexibility",
        request_label="Self-service billing requests",
        description="Cancellation, seat changes, invoices and trial handling.",
        keywords=(
            "cancel", "cancellation", "refund", "seat", "downgrade", "upgrade", "trial",
            "auto-renew", "auto renew", "billing portal", "pause", "contract", "notice period",
        ),
        failure_severity_hint="high",
        business_implication=(
            "Friction in cancellation and seat changes can convert ordinary churn into public "
            "complaints, amplifying negative perception."
        ),
        actions=(
            "Add self-serve pause and seat-change controls",
            "Make renewal terms visible 30 days in advance",
            "Audit the cancellation flow end to end",
        ),
    ),
    TopicDefinition(
        key="integrations",
        label="Integrations & ecosystem",
        complaint_label="Integration gaps",
        praise_label="Integration coverage",
        request_label="Integration requests",
        description="Connections to the tools customers already run their business on.",
        keywords=(
            "integration", "integrations", "connect", "api", "webhook", "shopify", "slack",
            "zapier", "hubspot", "salesforce", "csv", "export", "sso", "okta", "gsuite",
            "google sheets", "whatsapp",
        ),
        failure_severity_hint="medium",
        business_implication=(
            "Integration gaps block expansion into teams whose data lives elsewhere, capping "
            "account growth."
        ),
        actions=(
            "Prioritise the three most-requested connectors",
            "Publish API limits and webhook reliability documentation",
            "Ship CSV/Sheets export as an interim path",
        ),
    ),
    TopicDefinition(
        key="reporting_analytics",
        label="Reporting & analytics",
        complaint_label="Reporting limitations",
        praise_label="Reporting quality",
        request_label="Reporting requests",
        description="Depth, flexibility and trustworthiness of reports and dashboards.",
        keywords=(
            "report", "reports", "reporting", "dashboard", "chart", "charts", "analytics",
            "export pdf", "custom report", "metric", "kpi", "attribution", "segment",
            "breakdown", "insight",
        ),
        failure_severity_hint="medium",
        business_implication=(
            "Reporting gaps push analysts into spreadsheets, reducing stickiness and daily active "
            "usage."
        ),
        actions=(
            "Add saved report templates per segment",
            "Support scheduled PDF and CSV delivery",
            "Expose definitions for every headline metric",
        ),
    ),
    TopicDefinition(
        key="reliability",
        label="Reliability & uptime",
        complaint_label="Reliability",
        praise_label="Stability",
        request_label="Reliability expectations",
        description="Outages, data freshness and incident communication.",
        keywords=(
            "outage", "down", "downtime", "data loss", "stale", "not syncing", "sync", "bug",
            "incident", "status page", "reliability", "uptime", "errors", "failed",
        ),
        failure_severity_hint="critical",
        business_implication=(
            "Trust in the numbers is the product's core promise; repeated freshness issues create "
            "existential risk for analytical use cases."
        ),
        actions=(
            "Publish an uptime and data-freshness status page",
            "Add incident postmortems for customer-facing outages",
            "Introduce freshness indicators on every dataset",
        ),
    ),
    TopicDefinition(
        key="data_accuracy",
        label="Data accuracy",
        complaint_label="Data accuracy",
        praise_label="Data quality",
        request_label="Data quality expectations",
        description="Correctness, attribution and coverage of collected market data.",
        keywords=(
            "inaccurate", "wrong numbers", "mismatch", "duplicate", "dedupe", "coverage",
            "missing data", "accuracy", "attribution", "sample size", "representative",
            "methodology", "bias",
        ),
        failure_severity_hint="high",
        business_implication=(
            "Accuracy objections undermine the product's authority and slow enterprise "
            "procurement."
        ),
        actions=(
            "Publish methodology and sample sizes",
            "Add confidence labels to every insight",
            "Enable customer-side validation exports",
        ),
    ),
    TopicDefinition(
        key="onboarding",
        label="Onboarding & time-to-value",
        complaint_label="Onboarding friction",
        praise_label="Onboarding experience",
        request_label="Onboarding requests",
        description="Setup effort and speed to a first useful insight.",
        keywords=(
            "setup", "set up", "onboarding", "implementation", "migration", "import",
            "first week", "training", "documentation", "docs", "guide", "tutorial",
        ),
        failure_severity_hint="medium",
        business_implication=(
            "Long setup reduces trial conversion and increases reliance on services, which is "
            "expensive to scale."
        ),
        actions=(
            "Create a guided import checklist",
            "Offer a templated workspace by industry",
            "Track and publish median time-to-first-insight",
        ),
    ),
)

TOPIC_BY_KEY = {definition.key: definition for definition in TOPIC_DEFINITIONS}


SOURCE_CATEGORIES: tuple[dict[str, str], ...] = (
    {"key": "reddit", "label": "Reddit discussions", "note": "Public community threads; access via search provider."},
    {"key": "review_platform", "label": "Review platforms", "note": "Public review pages such as Trustpilot or G2."},
    {"key": "app_store", "label": "App Store / Google Play", "note": "Public store listings and review pages."},
    {"key": "news", "label": "News websites", "note": "Public news coverage."},
    {"key": "industry_publication", "label": "Industry publications", "note": "Trade press and analyst commentary."},
    {"key": "product_forum", "label": "Public product forums", "note": "Vendor and community forums."},
    {"key": "competitor_site", "label": "Competitor websites", "note": "Public pricing and feature pages."},
    {"key": "company_announcement", "label": "Company announcements", "note": "Public press releases and blogs."},
    {"key": "industry_report", "label": "Industry reports", "note": "Publicly available research summaries."},
)

SOURCE_CATEGORY_KEYS = tuple(item["key"] for item in SOURCE_CATEGORIES)

OBJECTIVES: tuple[dict[str, str], ...] = (
    {"key": "sentiment", "label": "Understand customer sentiment"},
    {"key": "weaknesses", "label": "Identify product weaknesses"},
    {"key": "competitors", "label": "Analyse competitors"},
    {"key": "opportunities", "label": "Discover market opportunities"},
    {"key": "complaints", "label": "Investigate customer complaints"},
    {"key": "pricing", "label": "Evaluate pricing perception"},
    {"key": "geography", "label": "Explore geographical expansion"},
    {"key": "trends", "label": "Identify emerging trends"},
    {"key": "roadmap", "label": "Develop a product improvement roadmap"},
)

SITUATIONS: tuple[dict[str, str], ...] = (
    {"key": "losing_customers", "label": "Losing customers to competitors"},
    {"key": "declining_satisfaction", "label": "Declining customer satisfaction"},
    {"key": "weak_adoption", "label": "Weak product adoption"},
    {"key": "new_market", "label": "Difficulty entering new markets"},
    {"key": "complaints", "label": "Increasing customer complaints"},
    {"key": "pricing_pressure", "label": "Pricing-related dissatisfaction"},
    {"key": "launch", "label": "New product launch"},
    {"key": "growth", "label": "Exploring growth opportunities"},
)

COUNTRIES: tuple[dict[str, str], ...] = (
    {"code": "AU", "name": "Australia", "region": "Oceania"},
    {"code": "NZ", "name": "New Zealand", "region": "Oceania"},
    {"code": "IN", "name": "India", "region": "Asia"},
    {"code": "SG", "name": "Singapore", "region": "Asia"},
    {"code": "GB", "name": "United Kingdom", "region": "Europe"},
    {"code": "US", "name": "United States", "region": "North America"},
    {"code": "CA", "name": "Canada", "region": "North America"},
    {"code": "DE", "name": "Germany", "region": "Europe"},
    {"code": "FR", "name": "France", "region": "Europe"},
    {"code": "NL", "name": "Netherlands", "region": "Europe"},
    {"code": "IE", "name": "Ireland", "region": "Europe"},
    {"code": "AE", "name": "United Arab Emirates", "region": "Middle East"},
    {"code": "SA", "name": "Saudi Arabia", "region": "Middle East"},
    {"code": "ZA", "name": "South Africa", "region": "Africa"},
    {"code": "NG", "name": "Nigeria", "region": "Africa"},
    {"code": "JP", "name": "Japan", "region": "Asia"},
    {"code": "KR", "name": "South Korea", "region": "Asia"},
    {"code": "ID", "name": "Indonesia", "region": "Asia"},
    {"code": "MY", "name": "Malaysia", "region": "Asia"},
    {"code": "PH", "name": "Philippines", "region": "Asia"},
    {"code": "BR", "name": "Brazil", "region": "South America"},
    {"code": "MX", "name": "Mexico", "region": "North America"},
    {"code": "AR", "name": "Argentina", "region": "South America"},
    {"code": "SE", "name": "Sweden", "region": "Europe"},
    {"code": "NO", "name": "Norway", "region": "Europe"},
    {"code": "DK", "name": "Denmark", "region": "Europe"},
    {"code": "ES", "name": "Spain", "region": "Europe"},
    {"code": "IT", "name": "Italy", "region": "Europe"},
    {"code": "PL", "name": "Poland", "region": "Europe"},
    {"code": "CH", "name": "Switzerland", "region": "Europe"},
)

COUNTRY_BY_CODE = {c["code"]: c for c in COUNTRIES}
REGIONS = tuple(sorted({c["region"] for c in COUNTRIES}))

MODE_PROFILES: dict[str, dict] = {
    "quick": {
        "label": "Quick Scan",
        "description": "A fast market overview: fewer queries, lighter validation, headline findings only.",
        "query_budget": 4,
        "max_competitors": 2,
        "evidence_target": 14,
        "capabilities": ["sentiment", "topics", "failures"],
        "stages": [
            "understand_request",
            "generate_questions",
            "discover_sources",
            "collect_results",
            "extract_evidence",
            "deduplicate",
            "sentiment_classification",
            "complaint_detection",
            "evidence_validation",
            "business_conclusions",
        ],
        "include_trends": False,
        "include_contradictions": False,
        "include_competitor_matrix": False,
    },
    "standard": {
        "label": "Standard Analysis",
        "description": "Customer, competitor and market analysis with full evidence validation.",
        "query_budget": 8,
        "max_competitors": 3,
        "evidence_target": 32,
        "capabilities": ["sentiment", "topics", "failures", "opportunities", "competitors"],
        "stages": [
            "understand_request",
            "generate_questions",
            "discover_sources",
            "collect_results",
            "extract_evidence",
            "deduplicate",
            "entity_linking",
            "sentiment_classification",
            "complaint_detection",
            "opportunity_detection",
            "competitor_positioning",
            "evidence_validation",
            "business_conclusions",
            "chart_datasets",
            "executive_report",
        ],
        "include_trends": True,
        "include_contradictions": True,
        "include_competitor_matrix": True,
    },
    "deep": {
        "label": "Deep Intelligence",
        "description": "Extended multi-stage investigation with contradiction analysis and trend modelling.",
        "query_budget": 14,
        "max_competitors": 4,
        "evidence_target": 44,
        "capabilities": [
            "sentiment", "topics", "failures", "opportunities", "competitors", "trends", "contradictions",
        ],
        "stages": [
            "understand_request",
            "generate_questions",
            "discover_sources",
            "collect_results",
            "extract_evidence",
            "deduplicate",
            "entity_linking",
            "sentiment_classification",
            "complaint_detection",
            "trend_modelling",
            "opportunity_detection",
            "competitor_positioning",
            "contradiction_analysis",
            "evidence_validation",
            "business_conclusions",
            "chart_datasets",
            "roadmap_generation",
            "executive_report",
        ],
        "include_trends": True,
        "include_contradictions": True,
        "include_competitor_matrix": True,
    },
}

STAGE_LABELS: dict[str, dict[str, str]] = {
    "understand_request": {"name": "Understand company, product and geography", "agent": "orchestrator"},
    "generate_questions": {"name": "Generate research questions", "agent": "orchestrator"},
    "discover_sources": {"name": "Discover relevant sources", "agent": "market_research"},
    "collect_results": {"name": "Collect permitted search results", "agent": "market_research"},
    "extract_evidence": {"name": "Extract evidence records", "agent": "customer_intelligence"},
    "deduplicate": {"name": "Deduplicate overlapping findings", "agent": "evidence_validation"},
    "entity_linking": {"name": "Identify companies, competitors and products", "agent": "competitor_intelligence"},
    "sentiment_classification": {"name": "Classify sentiment and topics", "agent": "sentiment"},
    "complaint_detection": {"name": "Identify recurring complaints", "agent": "customer_intelligence"},
    "trend_modelling": {"name": "Model emerging and declining topics", "agent": "sentiment"},
    "opportunity_detection": {"name": "Identify emerging opportunities", "agent": "market_research"},
    "competitor_positioning": {"name": "Analyse competitor positioning", "agent": "competitor_intelligence"},
    "contradiction_analysis": {"name": "Check conflicting evidence", "agent": "evidence_validation"},
    "evidence_validation": {"name": "Validate evidence quality", "agent": "evidence_validation"},
    "business_conclusions": {"name": "Generate business conclusions", "agent": "strategic_analysis"},
    "chart_datasets": {"name": "Produce structured chart datasets", "agent": "analytics"},
    "roadmap_generation": {"name": "Draft the product roadmap", "agent": "strategic_analysis"},
    "executive_report": {"name": "Write the executive intelligence report", "agent": "report_generation"},
}


def invalidate_topic_labels(text: str) -> list[str]:
    """Return topic keys detected by keyword matching (lowercased input expected)."""
    hits: list[str] = []
    for definition in TOPIC_DEFINITIONS:
        for keyword in definition.keywords:
            if keyword in text:
                hits.append(definition.key)
                break
    return hits


def severity_rank(severity: str) -> int:
    return {"critical": 4, "high": 3, "medium": 2, "low": 1}.get(severity, 0)
