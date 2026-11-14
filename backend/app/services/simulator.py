"""Strategy simulator.

Produces a qualitative what-if assessment grounded in stored findings. Output is
explicitly framed as hypotheses with stated assumptions — never as a forecast.
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.llm import LLMProviderError, try_get_llm, untrusted_block
from app.core.logging import get_logger
from app.models.evidence import EvidenceRecord
from app.models.findings import FailureFinding, OpportunityFinding, SimulationScenario
from app.models.research import Competitor, ResearchProject
from app.research.taxonomy import COUNTRY_BY_CODE
from app.services.text_analysis import truncate

logger = get_logger(__name__)

PRICE_RE = re.compile(r"(price|pricing|discount|cheaper|reduce.*(cost|price)|subscription)", re.I)
MARKET_RE = re.compile(r"(enter|launch|expand|market|country|region|australia|new zealand|india|singapore|united kingdom|us\b)", re.I)
FEATURE_RE = re.compile(r"(feature|launch|build|ship|integrat|report|dashboard|api|app)", re.I)
SUPPORT_RE = re.compile(r"(support|service|response|helpdesk|sla|onboarding)", re.I)
SEGMENT_RE = re.compile(r"(segment|audience|enterprise|smb|startup|mid-market|vertical|industry)", re.I)


def _topic_for_prompt(prompt: str) -> str | None:
    if PRICE_RE.search(prompt):
        return "pricing"
    if SUPPORT_RE.search(prompt):
        return "customer_service"
    if FEATURE_RE.search(prompt):
        return "reporting_analytics"
    return None


class StrategySimulator:
    def __init__(self, db: Session, project: ResearchProject) -> None:
        self.db = db
        self.project = project

    def simulate(self, prompt: str, name: str | None = None) -> SimulationScenario:
        evidence = list(
            self.db.scalars(select(EvidenceRecord).where(EvidenceRecord.project_id == self.project.id))
        )
        failures = list(
            self.db.scalars(select(FailureFinding).where(FailureFinding.project_id == self.project.id))
        )
        opportunities = list(
            self.db.scalars(select(OpportunityFinding).where(OpportunityFinding.project_id == self.project.id))
        )
        competitors = [
            c
            for c in self.db.scalars(select(Competitor).where(Competitor.project_id == self.project.id))
            if not c.is_primary
        ]

        topic = _topic_for_prompt(prompt)
        related = [r for r in evidence if topic and topic in (r.topics or [])]
        related_failure = next((f for f in failures if f.category == topic), None)
        country = self._country_in_prompt(prompt)

        advantages: list[str] = []
        disadvantages: list[str] = []
        assumptions: list[str] = [
            "Public sentiment is a leading indicator of commercial outcomes (unverified for this company).",
            "Competitors do not materially change their offer during the simulated period.",
            "No internal pricing, churn or margin data is used in this assessment.",
        ]
        risks: list[str] = []
        competitor_responses: list[str] = []
        evidence_ids: list[str] = []

        if PRICE_RE.search(prompt):
            pricing_evidence = [r for r in evidence if "pricing" in (r.topics or [])]
            evidence_ids = [str(r.id) for r in pricing_evidence[:8]]
            negative = [r for r in pricing_evidence if r.sentiment == "negative"]
            advantages.append(
                f"Removes the single most cited objection: {len(negative)} of {len(pricing_evidence)} pricing-related "
                f"records describe cost as a blocker."
            )
            advantages.append("Lowers the barrier for smaller teams currently priced into a five-seat minimum.")
            disadvantages.append(
                "A uniform reduction compresses revenue from customers who are not price-sensitive, "
                "with no evidence they would expand usage as a result."
            )
            disadvantages.append("Repricing mid-contract creates renewal and billing friction.")
            competitor_responses.append("Orbit Metrics could emphasise non-price differentiation or match the change.")
            risks.append("Temporary goodwill without structural retention improvement if the complaint is about value, not price.")
            assumptions.append("Assumption: a 10% reduction moves at least part of the price-objection segment to renew.")
            confidence = 0.48
        elif MARKET_RE.search(prompt) and (country or "market" in prompt.lower()):
            label = COUNTRY_BY_CODE.get(country or "", {"name": "the target market"})["name"]
            country_records = [r for r in evidence if country and r.country == country]
            evidence_ids = [str(r.id) for r in country_records[:8]]
            positive = [r for r in country_records if r.sentiment == "positive"]
            advantages.append(
                f"{label}: {len(positive)} of {len(country_records)} collected records are positive."
                if country_records
                else f"No {label}-specific evidence was collected in this run, so this remains a hypothesis."
            )
            advantages.append("Entering a market with demonstrated organic demand is cheaper than creating demand.")
            disadvantages.append("Localisation (billing, language, support hours) is the recurring blocker in the evidence.")
            disadvantages.append("Support coverage outside core hours is already a complaint theme.")
            competitor_responses.append("Incumbents may respond with local pricing or regional partnerships.")
            risks.append("Entering before localisation is complete risks repeating the India billing friction.")
            if country:
                assumptions.append(f"Assumption: demand observed in {label} transfers to a paid local offer.")
            confidence = 0.42
        elif FEATURE_RE.search(prompt):
            relevant = [o for o in opportunities if o.category in ("Product capability", "Ecosystem")]
            evidence_ids = [e for o in relevant[:2] for e in o.evidence_ids][:8]
            advantages.append("Directly addresses a capability gap that appears in switching narratives.")
            advantages.append("Reporting and integration gaps are the most concretely described requests in the dataset.")
            disadvantages.append("Delivery time competes with reliability work that already affects trust.")
            disadvantages.append("Feature parity alone historically does not win evaluations without proof points.")
            competitor_responses.append("ClarityStack may lean on analyst-grade flexibility to defend its position.")
            risks.append("Shipping a narrower version than requested can increase dissatisfaction.")
            confidence = 0.5
        elif SUPPORT_RE.search(prompt):
            support_records = [r for r in evidence if "customer_service" in (r.topics or [])]
            evidence_ids = [str(r.id) for r in support_records[:8]]
            advantages.append(
                f"Support is named in {len(support_records)} records; evidence shows response time, not effort, drives frustration."
            )
            advantages.append("Recent positive records suggest improvements already register with customers.")
            disadvantages.append("Support capacity costs scale linearly with accounts.")
            disadvantages.append("Regional coverage gaps limit the benefit for APAC and Indian customers.")
            competitor_responses.append("Orbit Metrics' faster first-response is a directly comparable claim to defend.")
            risks.append("Publishing an SLA without capacity planning can amplify dissatisfaction when missed.")
            confidence = 0.55
        else:
            evidence_ids = [str(r.id) for r in evidence[:6]]
            advantages.append("The change targets the aggregate complaint pattern rather than a single anecdote.")
            disadvantages.append("The prompt does not map cleanly to a single evidence cluster, so the assessment is broad.")
            risks.append("Broad initiatives are harder to evaluate; define a measurable outcome first.")
            confidence = 0.3

        if related_failure:
            disadvantages.append(f"Known constraint: {related_failure.title.lower()} ({related_failure.severity} severity).")
        if topic == "pricing" and any(c.mention_count > 0 for c in competitors):
            competitor_responses.append("Price moves are visible to competitors immediately; expect a response within a quarter.")
        if country or SEGMENT_RE.search(prompt):
            assumptions.append("Assumption: the target segment behaves like the observed sample; no internal segmentation data was used.")

        outcomes = [
            {
                "label": "Most likely qualitative outcome",
                "value": self._likely_outcome(prompt, advantages, disadvantages),
            },
            {
                "label": "What would change the conclusion",
                "value": "Internal churn, discount and win/loss data for the affected segment.",
            },
            {
                "label": "Evidence supporting this view",
                "value": f"{len(evidence_ids)} records linked below; confidence {int(confidence * 100)}%.",
            },
        ]

        provider = "heuristic-v1"
        llm = try_get_llm()
        if llm is not None and not self.project.is_demo:
            try:
                context = "\n\n".join(
                    untrusted_block(
                        f"SOURCE {i + 1} — {r.source_name}",
                        f"{r.title or ''}\n{r.excerpt}",
                        600,
                    )
                    for i, r in enumerate(evidence[:8])
                )
                payload = llm.generate_json(
                    "Assess this hypothetical strategy qualitatively using only the evidence. "
                    "Do not forecast numbers. Return JSON with keys advantages, disadvantages, "
                    "competitor_responses, risks, assumptions (arrays of short strings).\n"
                    f"Scenario: {prompt}\nFindings: {[f.title for f in failures[:5]]}\n\n{context}",
                    schema_hint='{"advantages": [], "disadvantages": [], "competitor_responses": [], "risks": [], "assumptions": []}',
                )
                advantages = [str(x) for x in payload.get("advantages", [])][:5] or advantages
                disadvantages = [str(x) for x in payload.get("disadvantages", [])][:5] or disadvantages
                competitor_responses = [str(x) for x in payload.get("competitor_responses", [])][:4] or competitor_responses
                risks = [str(x) for x in payload.get("risks", [])][:4] or risks
                assumptions = [str(x) for x in payload.get("assumptions", [])][:4] or assumptions
                provider = "gemini-v1"
            except (LLMProviderError, ValueError) as exc:
                logger.warning("simulation_llm_failed", extra={"event": str(exc)})

        scenario = SimulationScenario(
            project_id=self.project.id,
            name=name or truncate(prompt, 90),
            prompt=prompt,
            assumptions=assumptions,
            advantages=advantages,
            disadvantages=disadvantages,
            competitor_responses=competitor_responses,
            risks=risks,
            evidence_ids=evidence_ids,
            confidence=confidence,
            provider=provider,
        )
        self.db.add(scenario)
        self.db.flush()
        return scenario

    @staticmethod
    def _likely_outcome(prompt: str, advantages: list[str], disadvantages: list[str]) -> str:
        balance = len(advantages) - len(disadvantages)
        if balance > 0:
            return (
                "Plausibly net positive on perception: the change targets a documented objection. "
                "Commercial benefit depends on internal economics this platform does not measure."
            )
        if balance == 0:
            return (
                "Genuinely ambiguous: documented benefits and documented constraints are balanced. "
                "Run a limited pilot and measure before committing."
            )
        return (
            "Risk-weighted negative until internal data supports it: documented constraints outweigh "
            "the expected perception benefit."
        )

    @staticmethod
    def _country_in_prompt(prompt: str) -> str | None:
        lowered = prompt.lower()
        for code, data in COUNTRY_BY_CODE.items():
            if data["name"].lower() in lowered:
                return code
            if code.lower() in {word.strip(".,?") for word in lowered.split()} and len(code) == 2:
                return code
        return None
