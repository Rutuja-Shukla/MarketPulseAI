from __future__ import annotations

import html
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_project
from app.core.ratelimit import enforce_ai_limit
from app.db.session import get_db
from app.models.chat import ChatMessage, ChatConversation
from app.models.findings import RoadmapItem, SimulationScenario
from app.models.reporting import Report
from app.models.research import ResearchProject
from app.models.user import User
from app.schemas.analysis import (
    ChatMessageIn,
    ChatMessageOut,
    ReportOut,
    RoadmapItemOut,
    RoadmapUpdate,
    ScenarioIn,
    ScenarioOut,
    SimulationComparisonIn,
)
from app.services.assistant import answer, get_or_create_conversation
from app.services.report_builder import ReportBuilder
from app.services.simulator import StrategySimulator

router = APIRouter(tags=["outputs"])


# ---------------------------------------------------------------------- report
@router.get("/projects/{project_id}/report", response_model=ReportOut)
def get_report(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)):
    report = db.scalars(
        select(Report)
        .where(Report.project_id == project.id)
        .order_by(Report.version.desc())
    ).first()
    if report is None:
        raise HTTPException(
            status_code=404,
            detail="No report has been generated for this project yet. Run the analysis first.",
        )
    return report


@router.post("/projects/{project_id}/report/regenerate", response_model=ReportOut)
def regenerate_report(
    project: ResearchProject = Depends(get_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not project.evidence:
        raise HTTPException(status_code=409, detail="No evidence is stored for this project yet")
    enforce_ai_limit(user.id, cost=1, scope="report")
    report = ReportBuilder(db, project).generate(
        provider="demo-dataset+heuristic-v1" if project.is_demo else "template-v1"
    )
    db.commit()
    db.refresh(report)
    return report


@router.get("/projects/{project_id}/report/export")
def export_report(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)) -> Response:
    report = db.scalars(
        select(Report).where(Report.project_id == project.id).order_by(Report.version.desc())
    ).first()
    if report is None:
        raise HTTPException(status_code=404, detail="No report has been generated for this project yet")

    parts = [
        "<!doctype html><html><head><meta charset='utf-8'>",
        f"<title>{html.escape(report.title)}</title>",
        "<style>",
        "@page { size: A4; margin: 18mm 16mm; }",
        "body{font-family:'Helvetica Neue',Arial,sans-serif;color:#182A3A;background:#fff;line-height:1.55;max-width:760px;margin:0 auto;padding:24px}",
        "h1{font-family:Georgia,'Times New Roman',serif;font-size:30px;margin:0 0 6px}",
        "h2{font-family:Georgia,serif;font-size:19px;margin:28px 0 8px;border-bottom:1px solid #E5E3DC;padding-bottom:6px}",
        ".meta{color:#68727C;font-size:12px;letter-spacing:.04em;text-transform:uppercase}",
        ".demo{background:#FBF3E6;border:1px solid #C49A5B;padding:10px 14px;font-size:12px;margin:18px 0}",
        "p{font-size:13.5px}",
        ".item{border-left:2px solid #E5E3DC;padding:2px 0 2px 12px;margin:12px 0}",
        ".item h3{font-size:13.5px;margin:0 0 2px}",
        ".item .meta{margin-bottom:4px}",
        ".quote{color:#68727C;font-style:italic;font-size:12.5px}",
        "ul,ol{padding-left:18px;font-size:13px}",
        "a{color:#173B64;word-break:break-all}",
        ".foot{margin-top:32px;border-top:1px solid #E5E3DC;padding-top:10px;color:#68727C;font-size:11px}",
        "@media print{.no-print{display:none}}",
        "</style></head><body>",
        "<div class='no-print' style='margin-bottom:16px'>",
        "<button onclick='window.print()' style='background:#173B64;color:#fff;border:0;padding:10px 16px;border-radius:4px;cursor:pointer'>Print / Save as PDF</button>",
        "</div>",
        f"<div class='meta'>MarketPulse AI · Executive intelligence report · v{report.version}</div>",
        f"<h1>{html.escape(report.title)}</h1>",
        f"<div class='meta'>{html.escape(project.company.name)} · generated {report.generated_at.strftime('%d %B %Y') if report.generated_at else ''}</div>",
    ]
    if report.is_demo:
        parts.append(
            "<div class='demo'><strong>DEMO DATA</strong> — illustrative findings generated from a "
            "synthetic corpus. Not live market research.</div>"
        )
    parts.append(f"<h2>Executive summary</h2><p>{html.escape(report.executive_summary)}</p>")
    for section in report.sections:
        parts.append(f"<h2>{html.escape(str(section.get('title', '')))}</h2>")
        if section.get("body"):
            parts.append(f"<p>{html.escape(str(section.get('body')))}</p>")
        for item in section.get("items", []):
            if isinstance(item, str):
                parts.append(f"<p>{html.escape(item)}</p>")
                continue
            title = html.escape(str(item.get("title", "")))
            meta = html.escape(str(item.get("meta", "")))
            body = html.escape(str(item.get("body", "")))
            quote = html.escape(str(item.get("quote", "")))
            url = item.get("url")
            parts.append("<div class='item'>")
            parts.append(f"<h3>{title}</h3>")
            if meta:
                parts.append(f"<div class='meta'>{meta}</div>")
            if body:
                parts.append(f"<p>{body}</p>")
            if quote:
                parts.append(f"<p class='quote'>{quote}</p>")
            if url:
                parts.append(f"<p><a href='{html.escape(str(url))}'>{html.escape(str(url))}</a></p>")
            parts.append("</div>")
    parts.append("<h2>Research limitations</h2><ul>")
    for limitation in report.limitations:
        parts.append(f"<li>{html.escape(str(limitation))}</li>")
    parts.append("</ul>")
    parts.append(
        "<div class='foot'>Generated by MarketPulse AI. Findings are derived from the evidence listed "
        "in the report and do not constitute financial advice.</div></body></html>"
    )
    filename = f"marketpulse-{project.id}-report-v{report.version}.html"
    return Response(
        content="".join(parts),
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# --------------------------------------------------------------------- roadmap
@router.get("/projects/{project_id}/roadmap", response_model=list[RoadmapItemOut])
def get_roadmap(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)):
    items = list(
        db.scalars(
            select(RoadmapItem)
            .where(RoadmapItem.project_id == project.id)
            .order_by(RoadmapItem.order_index, RoadmapItem.created_at)
        )
    )
    if not items and project.evidence:
        from app.services.analysis_engine import AnalysisEngine

        AnalysisEngine(db, project).build_roadmap()
        db.commit()
        items = list(
            db.scalars(
                select(RoadmapItem)
                .where(RoadmapItem.project_id == project.id)
                .order_by(RoadmapItem.order_index)
            )
        )
    return items


@router.patch("/projects/{project_id}/roadmap/{item_id}", response_model=RoadmapItemOut)
def update_roadmap_item(
    item_id: uuid.UUID,
    payload: RoadmapUpdate,
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
):
    item = db.get(RoadmapItem, item_id)
    if item is None or item.project_id != project.id:
        raise HTTPException(status_code=404, detail="Roadmap item not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.get("/projects/{project_id}/roadmap/export")
def export_roadmap(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)) -> Response:
    items = list(
        db.scalars(
            select(RoadmapItem)
            .where(RoadmapItem.project_id == project.id)
            .order_by(RoadmapItem.order_index)
        )
    )
    lines = [
        f"# Product roadmap — {project.company.name}",
        "",
        f"Generated by MarketPulse AI from {project.evidence_count} evidence records."
        + (" **DEMO DATA — illustrative only.**" if project.is_demo else ""),
        "",
    ]
    for horizon, title in (
        ("immediate", "Immediate priorities"),
        ("short_term", "Short-term improvements"),
        ("medium_term", "Medium-term initiatives"),
        ("long_term", "Long-term strategic investments"),
    ):
        subset = [item for item in items if item.horizon == horizon]
        if not subset:
            continue
        lines += [f"## {title}", ""]
        for item in subset:
            lines += [
                f"### {item.title}",
                f"- Priority: {item.priority}",
                f"- Complexity: {item.complexity}",
                f"- Confidence: {int(item.confidence * 100)}%",
                f"- Status: {item.status}",
                f"- Problem: {item.problem or 'n/a'}",
                f"- Improvement: {item.improvement or 'n/a'}",
                f"- Success metrics: {', '.join(item.success_metrics or []) or 'not defined'}",
            ]
            if item.notes:
                lines.append(f"- Notes: {item.notes}")
            lines.append("")
    return Response(
        content="\n".join(lines),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="marketpulse-{project.id}-roadmap.md"'
        },
    )


# ------------------------------------------------------------------ simulator
@router.get("/projects/{project_id}/scenarios", response_model=list[ScenarioOut])
def list_scenarios(project: ResearchProject = Depends(get_project), db: Session = Depends(get_db)):
    return list(
        db.scalars(
            select(SimulationScenario)
            .where(SimulationScenario.project_id == project.id)
            .order_by(SimulationScenario.created_at.desc())
        )
    )


@router.post("/projects/{project_id}/simulate", response_model=ScenarioOut, status_code=201)
def simulate(
    payload: ScenarioIn,
    project: ResearchProject = Depends(get_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not project.evidence:
        raise HTTPException(status_code=409, detail="Run the analysis before simulating scenarios")
    enforce_ai_limit(user.id, cost=2, scope="simulator")
    scenario = StrategySimulator(db, project).simulate(payload.prompt, payload.name)
    db.commit()
    db.refresh(scenario)
    return scenario


@router.post("/projects/{project_id}/simulate/compare", response_model=list[ScenarioOut], status_code=201)
def compare_scenarios(
    payload: SimulationComparisonIn,
    project: ResearchProject = Depends(get_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not project.evidence:
        raise HTTPException(status_code=409, detail="Run the analysis before simulating scenarios")
    enforce_ai_limit(user.id, cost=len(payload.scenarios), scope="simulator")
    simulator = StrategySimulator(db, project)
    scenarios = [simulator.simulate(item.prompt, item.name) for item in payload.scenarios]
    db.commit()
    for scenario in scenarios:
        db.refresh(scenario)
    return scenarios


@router.delete("/projects/{project_id}/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scenario(
    scenario_id: uuid.UUID,
    project: ResearchProject = Depends(get_project),
    db: Session = Depends(get_db),
) -> None:
    scenario = db.get(SimulationScenario, scenario_id)
    if scenario is None or scenario.project_id != project.id:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(scenario)
    db.commit()


# ------------------------------------------------------------------ assistant
@router.get("/projects/{project_id}/chat")
def chat_history(
    project: ResearchProject = Depends(get_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    conversation = db.scalars(
        select(ChatConversation)
        .where(
            ChatConversation.project_id == project.id,
            ChatConversation.user_id == user.id,
        )
        .order_by(ChatConversation.created_at.asc())
    ).first()
    if conversation is None:
        return {"conversation_id": None, "messages": [], "suggestions": _suggestions(project)}
    messages = list(
        db.scalars(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation.id)
            .order_by(ChatMessage.created_at.asc())
        )
    )
    return {
        "conversation_id": str(conversation.id),
        "messages": [ChatMessageOut.model_validate(message).model_dump() for message in messages],
        "suggestions": _suggestions(project),
    }


@router.post("/projects/{project_id}/chat", response_model=ChatMessageOut)
def chat(
    payload: ChatMessageIn,
    project: ResearchProject = Depends(get_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not project.evidence:
        raise HTTPException(
            status_code=409,
            detail="The assistant answers only from stored evidence. Run an analysis first.",
        )
    enforce_ai_limit(user.id, cost=1, scope="assistant")
    conversation = get_or_create_conversation(db, project, user.id)
    db.add(
        ChatMessage(
            conversation_id=conversation.id,
            role="user",
            content=payload.content.strip(),
            provider="user",
        )
    )
    db.flush()
    message = answer(db, project, conversation, payload.content.strip())
    db.commit()
    db.refresh(message)
    return message


def _suggestions(project: ResearchProject) -> list[str]:
    return [
        "What are the three most important problems?",
        "Why is pricing perceived as a weakness?",
        "Show me the evidence behind the top finding.",
        "Which opportunity should we prioritise?",
        "How do our complaints compare with competitors?",
        "What additional research would improve confidence?",
    ]
