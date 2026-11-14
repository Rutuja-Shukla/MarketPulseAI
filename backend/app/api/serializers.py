from __future__ import annotations

from app.models.research import ResearchProject


def project_progress(project: ResearchProject) -> int:
    if project.status == "completed":
        return 100
    tasks = project.tasks or []
    if not tasks:
        return 0
    completed = len([task for task in tasks if task.status == "completed"])
    running = len([task for task in tasks if task.status == "running"])
    return int(((completed + running * 0.5) / len(tasks)) * 100)


def project_payload(project: ResearchProject) -> dict:
    config = project.configuration
    return {
        "id": project.id,
        "name": project.name,
        "mode": project.mode,
        "status": project.status,
        "is_demo": project.is_demo,
        "summary": project.summary,
        "current_stage": project.current_stage,
        "error_message": project.error_message,
        "evidence_count": project.evidence_count,
        "failure_count": project.failure_count,
        "opportunity_count": project.opportunity_count,
        "created_at": project.created_at,
        "completed_at": project.completed_at,
        "product_name": project.product_name,
        "company_name": project.company.name if project.company else "",
        "countries": list(config.countries or []) if config else [],
        "global_scope": bool(config.global_scope) if config else False,
        "progress": project_progress(project),
    }


def competitor_payload(competitor) -> dict:
    return {
        "id": competitor.id,
        "name": competitor.name,
        "website": competitor.website,
        "is_primary": competitor.is_primary,
        "positioning": competitor.positioning,
        "pricing_summary": competitor.pricing_summary,
        "strengths": list(competitor.strengths or []),
        "weaknesses": list(competitor.weaknesses or []),
        "sentiment_score": competitor.sentiment_score,
        "mention_count": competitor.mention_count,
        "source_count": competitor.source_count,
        "is_suggested": competitor.is_suggested,
        "observations": [
            {
                "dimension": observation.dimension,
                "value": observation.value,
                "score": observation.score,
                "evidence_id": str(observation.evidence_id) if observation.evidence_id else None,
            }
            for observation in competitor.observations
        ],
    }
