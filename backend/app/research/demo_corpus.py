"""Synthetic demonstration corpus.

Everything here is fabricated for illustration. Records are flagged `is_demo`
and every URL uses the reserved `demo.marketpulse.ai` host so nothing can be
mistaken for live market research or a real published source.
"""
from __future__ import annotations

from datetime import date

DEMO_COMPANY = {
    "name": "Lumenly",
    "website": "https://lumenly.example",
    "industry": "B2B SaaS — market & customer intelligence",
    "product_name": "Lumenly Signals",
    "description": (
        "Lumenly Signals collects public customer conversations and competitor activity for "
        "mid-market e-commerce and subscription brands, then turns them into retention and "
        "positioning dashboards."
    ),
    "target_audience": (
        "Heads of Growth, Retention and Product at D2C and subscription businesses with "
        "10–500 employees, primarily in Australia, New Zealand, the UK and India."
    ),
}

DEMO_PROJECT_NAME = "Lumenly Signals — ANZ & India market position"
DEMO_SUMMARY = (
    "Pricing friction and support responsiveness dominate negative market signals, while "
    "reporting flexibility and regional payment support are the clearest expansion openings."
)

DEMO_COMPETITORS = [
    {
        "name": "Orbit Metrics",
        "website": "https://orbit-metrics.example",
        "positioning": "Lower-cost entry tier with a self-serve onboarding motion for small teams.",
        "pricing_summary": "Public pricing starts below Lumenly's entry tier; per-workspace rather than per-seat.",
        "strengths": ["Lower entry price", "Faster first-response support", "Simple workspace pricing"],
        "weaknesses": ["Shallow historical data", "Limited enterprise controls", "Fewer integrations"],
        "is_suggested": True,
    },
    {
        "name": "ClarityStack",
        "website": "https://claritystack.example",
        "positioning": "Premium analytics suite with flexible dashboards for larger analytics teams.",
        "pricing_summary": "No public price list; quote-based with an annual commitment.",
        "strengths": ["Flexible custom reporting", "Strong dashboard depth", "Enterprise data controls"],
        "weaknesses": ["Long implementation time", "Higher total cost", "Steep learning curve"],
        "is_suggested": True,
    },
    {
        "name": "Signalwise",
        "website": "https://signalwise.example",
        "positioning": "Integration-first platform aimed at teams already running Klaviyo and Shopify Plus.",
        "pricing_summary": "Usage-based pricing published per event volume.",
        "strengths": ["Deep Shopify and Klaviyo connectors", "Fast data sync", "Clear API documentation"],
        "weaknesses": ["Pricing scales quickly with volume", "Support limited to business hours"],
        "is_suggested": True,
    },
]

DEMO_CONFIG = {
    "global_scope": False,
    "countries": ["AU", "NZ", "IN", "GB"],
    "regions": ["Oceania", "Asia"],
    "comparison_pairs": [["AU", "NZ"], ["IN", "GB"]],
    "situation": "losing_customers",
    "situation_description": (
        "Renewal conversations have become harder over the last two quarters. Sales hears that "
        "pricing is the blocker, but support has also seen more escalations about reporting."
    ),
    "objectives": [
        "sentiment", "weaknesses", "competitors", "opportunities", "complaints", "pricing", "geography", "roadmap",
    ],
    "assumptions": [
        {"text": "We believe customers are switching because subscription pricing is too expensive.", "status": "pending"},
        {"text": "We believe support response times are a primary driver of cancellations.", "status": "pending"},
        {"text": "We believe the product lacks the reporting flexibility competitors offer.", "status": "pending"},
    ],
    "source_categories": [
        "reddit", "review_platform", "app_store", "news", "industry_publication", "product_forum", "competitor_site",
    ],
    "research_period_start": "2025-11-01",
    "research_period_end": "2026-10-31",
    "depth": "deep",
    "competitor_target": 3,
    "analysis_preferences": {
        "sentiment_model": "lexicon-v1",
        "include_contradictions": True,
        "include_regional_comparison": True,
    },
}


def _record(
    slug: str,
    category: str,
    source: str,
    published: str,
    country: str | None,
    title: str,
    text: str,
    rating: float | None = None,
    author: str | None = None,
    query: str | None = None,
) -> dict:
    return {
        "external_id": slug,
        "source_category": category,
        "source_name": source,
        "source_url": f"https://demo.marketpulse.ai/s/{slug}",
        "published_at": date.fromisoformat(published),
        "country": country,
        "title": title,
        "text": text,
        "rating": rating,
        "author_handle": author,
        "search_query": query,
    }


# 42 synthetic records across 12 months, four countries and seven source categories.
DEMO_EVIDENCE: list[dict] = [
    _record(
        "rd-001", "reddit", "Reddit — r/ecommerce", "2025-11-12", "AU",
        "Lumenly vs Orbit Metrics for a 6-person growth team?",
        "We trialled Lumenly Signals for a month. The dashboards are genuinely useful and the setup call was excellent, but the per-seat pricing doubles our cost as soon as we add the retention team. Orbit Metrics quoted us less for the whole workspace. Hard to justify the price at our size.",
        author="u/smallstore_au", query="Lumenly Signals pricing review",
    ),
    _record(
        "rd-002", "reddit", "Reddit — r/ecommerce", "2025-12-03", "AU",
        "Month-end reporting is painfully slow in Lumenly",
        "Every month-end the Signals dashboard times out when I switch date ranges. Support told me it is a known issue with large workspaces. I end up exporting to a spreadsheet, which defeats the purpose of paying for analytics in the first place.",
        author="u/aus_ops", query="Lumenly Signals slow dashboard",
    ),
    _record(
        "rd-003", "reddit", "Reddit — r/ecommerce", "2025-12-18", "NZ",
        "Is Lumenly worth it for NZ retailers?",
        "The sentiment tracking is good but I wish it supported NZD invoices. We had to pay in AUD and absorb the conversion, which finance was not happy about. Product itself does what it says, the onboarding was smooth.",
        author="u/kiwi_d2c", query="Lumenly New Zealand",
    ),
    _record(
        "rd-004", "reddit", "Reddit — r/ecommerce", "2026-01-09", "IN",
        "Lumenly pricing for Indian D2C brands is unrealistic",
        "The tool is strong but pricing is clearly designed for Australian budgets. At our scale the subscription is more than our entire analytics stack. We need INR billing and GST invoices before we can even put it through procurement.",
        author="u/d2c_blr", query="Lumenly India pricing GST",
    ),
    _record(
        "rd-005", "reddit", "Reddit — r/ecommerce", "2026-01-22", "GB",
        "Customer support has gone quiet",
        "Raised a ticket about attribution mismatches nine days ago and only got an automated reply. The product is good, but when the numbers look wrong I need an answer fast. This is the second time this quarter we have been ignored.",
        author="u/london_growth", query="Lumenly customer support",
    ),
    _record(
        "rd-006", "reddit", "Reddit — r/shopify", "2026-02-02", "AU",
        "Lumenly missing multi-store support?",
        "We run three Shopify stores and Lumenly only lets us connect one at a time. Signalwise handles all three natively and syncs much faster. The missing functionality is the only reason we have not switched over fully.",
        author="u/multistore_au", query="Lumenly Shopify multi store",
    ),
    _record(
        "rd-007", "reddit", "Reddit — r/analytics", "2026-02-19", "AU",
        "Lumenly data accuracy question",
        "Our Lumenly revenue numbers do not match GA4 by about 4%. Support says it is attribution methodology, but there is no documentation explaining the difference. Hard to trust the insight layer when we cannot reconcile the base data.",
        author="u/data_au", query="Lumenly data accuracy GA4",
    ),
    _record(
        "rd-008", "reddit", "Reddit — r/ecommerce", "2026-03-04", "AU",
        "Lumenly onboarding was the best part",
        "Honestly the onboarding call was brilliant. Our implementation person had us live in a week and the templates saved a lot of time. The only frustration later is custom reports, which are clunky compared to ClarityStack.",
        author="u/retention_au", query="Lumenly onboarding experience",
    ),
    _record(
        "rd-009", "reddit", "Reddit — r/ecommerce", "2026-03-21", "IN",
        "Lumenly support slow for Indian timezones",
        "Support hours are basically Australian business hours, so by the time we get a reply our day is over. The team is helpful when they answer, but the delay is frustrating for a paid tool.",
        author="u/in_retail", query="Lumenly support hours India",
    ),
    _record(
        "rd-010", "reddit", "Reddit — r/ecommerce", "2026-04-02", "AU",
        "Cancelling Lumenly was harder than it should be",
        "To cancel we had to email an account manager, wait for a call, and sit through a retention pitch. Auto-renew charged us for another year before the cancellation went through. The product is fine, the subscription management is not.",
        author="u/churned_au", query="Lumenly cancel subscription",
    ),
    _record(
        "tp-001", "review_platform", "Trustpilot", "2025-11-28", "GB",
        "Useful insight, expensive seats",
        "Lumenly Signals gives us a clean view of what customers complain about. The price per seat is the main issue — we only need three people in it, but the plan forces five minimum seats.",
        rating=3.0, author="verified-reviewer-1", query="Lumenly reviews pricing",
    ),
    _record(
        "tp-002", "review_platform", "Trustpilot", "2026-01-15", "AU",
        "Great product, mixed support",
        "The dashboards are clear and the insight summaries save my team hours each week. Support is a lottery: sometimes a same-day answer, sometimes a week of silence. For the price I expect consistent response times.",
        rating=3.5, author="verified-reviewer-2", query="Lumenly Trustpilot support",
    ),
    _record(
        "tp-003", "review_platform", "Trustpilot", "2026-02-27", "NZ",
        "Solid onboarding, weak reporting",
        "Setup was smooth and the team was helpful. Reporting is where it falls down: I cannot schedule a PDF to my leadership team, so I rebuild the same view manually every Monday.",
        rating=3.0, author="verified-reviewer-3", query="Lumenly reporting PDF export",
    ),
    _record(
        "tp-004", "review_platform", "Trustpilot", "2026-04-11", "AU",
        "Support turned it around",
        "After a rough patch earlier this year, our last two tickets were answered within a few hours and the agent actually understood the data model. Genuinely improved support experience.",
        rating=5.0, author="verified-reviewer-4", query="Lumenly support improvement",
    ),
    _record(
        "tp-005", "review_platform", "Trustpilot", "2026-05-06", "IN",
        "Good tool, unclear billing for India",
        "We like the product but the billing experience is confusing: no INR invoices, GST details not captured, and our finance team rejected the receipt twice. This blocks renewal more than the price does.",
        rating=2.5, author="verified-reviewer-5", query="Lumenly billing India",
    ),
    _record(
        "tp-006", "review_platform", "Trustpilot", "2026-06-19", "GB",
        "ClarityStack wins on reporting",
        "We ran both for a quarter. ClarityStack gives analysts flexible custom reports; Lumenly is easier for marketers. If our analysts owned the budget we would have kept ClarityStack despite the implementation time.",
        rating=3.0, author="verified-reviewer-6", query="Lumenly vs ClarityStack",
    ),
    _record(
        "tp-007", "review_platform", "Trustpilot", "2026-08-02", "AU",
        "Reliable and easy to use",
        "Two years in and it is still the tool my team opens first every morning. Easy to use, reliable, and the sentiment view has caught two product issues before they hit social media.",
        rating=5.0, author="verified-reviewer-7", query="Lumenly reliable",
    ),
    _record(
        "tp-008", "review_platform", "Trustpilot", "2026-09-14", "NZ",
        "Price increase without notice",
        "Our renewal jumped 18% with no advance notice beyond a line in the invoice email. The value is there, but the way the price increase was handled felt sneaky and made us review alternatives.",
        rating=2.0, author="verified-reviewer-8", query="Lumenly price increase",
    ),
    _record(
        "as-001", "app_store", "Apple App Store — Lumenly", "2025-12-09", "AU",
        "Handy mobile alerts",
        "The mobile app is basic but the alerts are useful when sentiment spikes. Would love WhatsApp alerts instead of push only, since our team lives in WhatsApp.",
        rating=4.0, author="app-reviewer-1", query="Lumenly app alerts",
    ),
    _record(
        "as-002", "app_store", "Google Play — Lumenly", "2026-03-12", "IN",
        "App crashes on older Android",
        "The app crashes every time I open the reports tab on my Android phone. It has been like this for three updates. The web version is fine, so it is an app-specific reliability problem.",
        rating=2.0, author="app-reviewer-2", query="Lumenly app crash Android",
    ),
    _record(
        "as-003", "app_store", "Google Play — Lumenly", "2026-05-22", "GB",
        "Filters are confusing",
        "The filter panel is confusing — I keep losing my segment selection when I switch tabs. The web dashboard is better but still takes too many clicks to get to a specific cohort.",
        rating=3.0, author="app-reviewer-3", query="Lumenly app filters UX",
    ),
    _record(
        "as-004", "app_store", "Apple App Store — Lumenly", "2026-07-08", "AU",
        "Great for quick checks",
        "Fast, clean and easy to use when I just want to check sentiment before a standup. The push alerts have been reliable for us.",
        rating=5.0, author="app-reviewer-4", query="Lumenly app review",
    ),
    _record(
        "pf-001", "product_forum", "Lumenly community forum", "2026-01-05", "AU",
        "Request: scheduled PDF reports",
        "Feature request — please add scheduled PDF and CSV delivery for saved reports. Our leadership team wants a Monday summary and right now someone rebuilds it manually each week.",
        author="forum-user-1", query="Lumenly scheduled reports feature request",
    ),
    _record(
        "pf-002", "product_forum", "Lumenly community forum", "2026-02-14", "GB",
        "Request: Klaviyo and HubSpot connectors",
        "Would love native Klaviyo and HubSpot integrations. Right now we export CSV and join it in a spreadsheet. Signalwise has both and that is genuinely tempting.",
        author="forum-user-2", query="Lumenly integrations Klaviyo",
    ),
    _record(
        "pf-003", "product_forum", "Lumenly community forum", "2026-04-18", "IN",
        "Request: multi-language sentiment",
        "Our customers write reviews in Hindi and English. Sentiment for Hindi reviews is basically random right now. Adding Hindi support would unlock the India market for us.",
        author="forum-user-3", query="Lumenly Hindi sentiment support",
    ),
    _record(
        "pf-004", "product_forum", "Lumenly community forum", "2026-06-25", "AU",
        "Request: seat downgrade without support ticket",
        "Why do I need to email support to remove a seat? Self-serve downgrade would save everyone time. Also the cancellation flow is painful — we should be able to pause for a quarter.",
        author="forum-user-4", query="Lumenly seat management",
    ),
    _record(
        "pf-005", "product_forum", "Lumenly community forum", "2026-08-19", "NZ",
        "Feature idea: competitor price tracking",
        "Would be useful to track competitor public pricing changes automatically instead of checking manually. Orbit Metrics just cut their entry tier and I only found out from a peer.",
        author="forum-user-5", query="Lumenly competitor price tracking",
    ),
    _record(
        "pf-006", "product_forum", "Lumenly community forum", "2026-09-29", "GB",
        "Request: custom metric definitions",
        "Please let us define custom metrics and see the formula behind every headline number. Analysts do not trust a score without the definition, and right now the documentation is thin.",
        author="forum-user-6", query="Lumenly metric definitions documentation",
    ),
    _record(
        "nw-001", "news", "Australian Retail Tech Weekly", "2026-02-06", "AU",
        "Customer intelligence budgets shift toward retention tools",
        "Mid-market retailers are reallocating analytics budgets from acquisition dashboards to retention and customer-voice tooling as acquisition costs stay elevated. Vendors bundling sentiment with competitor tracking are seeing the strongest interest.",
        query="customer intelligence market trend ANZ",
    ),
    _record(
        "nw-002", "news", "India D2C Monitor", "2026-03-18", "IN",
        "Indian D2C brands prioritise local billing and language support",
        "Procurement teams at Indian D2C brands increasingly require GST-compliant invoicing and local payment methods before approving international SaaS tools. Vendors that localise billing report shorter sales cycles.",
        query="India SaaS procurement GST localisation",
    ),
    _record(
        "nw-003", "news", "SaaS Benchmark Brief", "2026-06-04", "GB",
        "Price transparency becomes a renewal battleground",
        "Across 40 mid-market SaaS vendors, unannounced renewal increases were the most cited reason for initiating a competitive review, ahead of feature gaps. Buyers expect notice periods and published pricing tiers.",
        query="SaaS renewal pricing transparency",
    ),
    _record(
        "nw-004", "news", "NZ Business Wire", "2026-07-21", "NZ",
        "New Zealand retailers lag on customer feedback tooling",
        "Only a minority of surveyed NZ retailers systematically analyse public customer feedback, citing cost and complexity. Analysts see room for lighter, locally-billed tools aimed at smaller teams.",
        query="New Zealand retail customer feedback adoption",
    ),
    _record(
        "ip-001", "industry_publication", "Martech Intelligence Review", "2026-01-30", None,
        "AI-assisted insight tools face a trust barrier",
        "Buyers consistently ask two questions about AI-generated insight: where the data came from, and whether the model will invent numbers. Vendors publishing source attribution and confidence levels are winning enterprise evaluations.",
        query="AI market research trust attribution",
    ),
    _record(
        "ip-002", "industry_publication", "Commerce Analytics Quarterly", "2026-05-14", None,
        "Support responsiveness correlates with retention in mid-market SaaS",
        "Analysis of renewal outcomes shows support first-response time is a stronger predictor of mid-market renewal than feature breadth, particularly where the product touches revenue reporting.",
        query="SaaS support response retention benchmark",
    ),
    _record(
        "ip-003", "industry_publication", "Commerce Analytics Quarterly", "2026-08-27", None,
        "Competitive intelligence buyers want workflow outputs, not more dashboards",
        "Teams report dashboard fatigue and prefer vendors that convert findings into prioritised actions with owners. Roadmap and experiment integration is becoming a purchasing criterion.",
        query="competitive intelligence roadmap integration",
    ),
    _record(
        "ip-004", "industry_publication", "Asia Pacific SaaS Journal", "2026-09-30", "SG",
        "Regional data residency questions rise in APAC deals",
        "APAC buyers increasingly ask where analytics data is stored and processed, with some requiring in-region processing. Vendors without a clear answer report longer procurement cycles.",
        query="APAC data residency SaaS procurement",
    ),
    _record(
        "cs-001", "competitor_site", "Orbit Metrics — pricing page", "2026-04-08", None,
        "Orbit Metrics publishes per-workspace pricing",
        "Public pricing list shows a workspace-based plan below Lumenly's minimum seat commitment, with unlimited viewers and a 14-day trial. Historical data limited to 12 months on the lower tier.",
        query="Orbit Metrics pricing",
    ),
    _record(
        "cs-002", "competitor_site", "ClarityStack — platform page", "2026-04-09", None,
        "ClarityStack highlights custom reporting depth",
        "ClarityStack markets configurable report builders, scheduled delivery and analyst-grade export controls. Implementation is described as a guided four-to-six week programme.",
        query="ClarityStack features reporting",
    ),
    _record(
        "cs-003", "competitor_site", "Signalwise — integrations page", "2026-04-10", None,
        "Signalwise advertises native Shopify and Klaviyo connectors",
        "Signalwise lists native connectors for Shopify Plus, Klaviyo, Meta Ads and HubSpot with near-real-time sync and usage-based pricing per event volume.",
        query="Signalwise integrations",
    ),
    _record(
        "ca-001", "company_announcement", "Lumenly blog", "2026-03-02", None,
        "Lumenly launches AI insight summaries",
        "Lumenly announced AI-generated insight summaries across all paid plans, positioned around time saved for growth teams. The announcement emphasises source attribution on every summary.",
        query="Lumenly product announcement AI",
    ),
    _record(
        "ca-002", "company_announcement", "Lumenly blog", "2026-07-15", None,
        "Lumenly opens Sydney and Bengaluru support hubs",
        "Lumenly announced expanded support coverage with new hubs in Sydney and Bengaluru, targeting improved response times across APAC. The post commits to publishing response-time targets.",
        query="Lumenly support expansion",
    ),
    _record(
        "rp-001", "industry_report", "APAC Commerce Insights 2026", "2026-02-11", None,
        "Retention analytics adoption still early in ANZ mid-market",
        "Survey of 380 ANZ mid-market retailers finds fewer than a third analyse customer feedback systematically; cost, setup effort and unclear ROI are the leading blockers.",
        query="ANZ retention analytics adoption report",
    ),
    _record(
        "rp-002", "industry_report", "Global Subscription Benchmark 2026", "2026-06-12", None,
        "Pricing and support lead mid-market churn narratives",
        "Across 1,200 churn interviews, pricing perception (38%) and support experience (27%) were the most cited reasons for leaving analytics vendors, ahead of missing features (21%).",
        query="subscription churn reasons benchmark",
    ),
    _record(
        "rd-011", "reddit", "Reddit — r/ecommerce", "2026-07-30", "AU",
        "Lumenly support has genuinely improved",
        "Credit where it is due: after complaining here in January, our last three tickets were answered within two hours and the agent walked us through the attribution difference. That is a real improvement.",
        author="u/aus_ops", query="Lumenly support improved",
    ),
    _record(
        "rd-012", "reddit", "Reddit — r/ecommerce", "2026-09-08", "GB",
        "Orbit Metrics cut prices and it shows",
        "Orbit Metrics dropped their entry plan again. For a small team the price gap to Lumenly is now hard to ignore, even though Lumenly's dashboards are better and the historical data is deeper.",
        author="u/uk_growth", query="Orbit Metrics pricing change",
    ),
    _record(
        "rd-013", "reddit", "Reddit — r/ecommerce", "2026-10-02", "IN",
        "Lumenly for India: still waiting on localisation",
        "We renewed despite the billing friction because the sentiment data is the best we have found. But without INR invoices and Hindi sentiment we cannot roll it out to the regional team, which caps the account.",
        author="u/d2c_blr", query="Lumenly India localisation renewal",
    ),
    _record(
        "tp-009", "review_platform", "Trustpilot", "2026-10-20", "AU",
        "Still too expensive for what we use",
        "We use maybe 20% of the platform and still pay for five seats minimum. The insight quality is good but the value for money argument is weak when Orbit Metrics covers our actual needs for less.",
        rating=2.5, author="verified-reviewer-9", query="Lumenly value for money",
    ),
]
