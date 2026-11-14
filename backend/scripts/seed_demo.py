"""Seed the demonstration workspace.

Usage:
    cd backend && python -m scripts.seed_demo

Creates the demo analyst, a completed demo project and its evidence exactly once.
Safe to run repeatedly and after deployments.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.models.research import ResearchProject  # noqa: E402
from app.services.demo_seed import DEMO_EMAIL, DEMO_PASSWORD, seed_demo_workspace  # noqa: E402


def main() -> int:
    init_db()
    with SessionLocal() as db:
        created = seed_demo_workspace(db)
        project = db.scalars(
            select(ResearchProject).where(ResearchProject.is_demo.is_(True))
        ).first()
        print("demo workspace created" if created else "demo workspace already present")
        print(f"demo user: {DEMO_EMAIL}")
        print(f"demo password: {DEMO_PASSWORD}")
        if project is not None:
            print(f"demo project: {project.name} ({project.id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
