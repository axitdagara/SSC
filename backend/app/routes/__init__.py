from app.routes.auth import router as auth_router
from app.routes.players import router as players_router
from app.routes.premium import router as premium_router
from app.routes.performance import router as performance_router
from app.routes.dashboard import router as dashboard_router
from app.routes.admin import router as admin_router
from app.routes.finance import router as finance_router
from app.routes.notifications import router as notifications_router
from app.routes.matches import router as matches_router

__all__ = [
    "auth_router",
    "players_router", 
    "premium_router",
    "performance_router",
    "dashboard_router",
    "admin_router",
    "finance_router",
    "notifications_router",
    "matches_router",
]
