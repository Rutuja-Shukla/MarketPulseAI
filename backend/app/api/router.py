from fastapi import APIRouter

from app.api import routes_analysis, routes_auth, routes_ops, routes_outputs, routes_projects

api_router = APIRouter()
api_router.include_router(routes_auth.router)
api_router.include_router(routes_projects.router)
api_router.include_router(routes_analysis.router)
api_router.include_router(routes_outputs.router)
api_router.include_router(routes_ops.router)
