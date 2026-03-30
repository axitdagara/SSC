from fastapi import FastAPI
from fastapi import Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from app.config import settings
from app.middleware import LoggingMiddleware, RateLimitMiddleware
from app.middleware.auth import security
from app.utils.firestore_data import DatabaseUnavailableError, init_db
from app.utils.logger import logger
from app.routes import (
    auth_router,
    players_router,
    premium_router,
    performance_router,
    dashboard_router,
    admin_router,
    finance_router,
    notifications_router,
    matches_router,
)

# Create FastAPI app
app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    description="Cricket Player Management & Performance Tracking SaaS Platform"
)

# Add CORS middleware
allowed_origins = settings.cors_origins_list or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials="*" not in allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

API_PREFIX = "/api"

# Include routers
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(players_router, prefix=API_PREFIX)
app.include_router(premium_router, prefix=API_PREFIX)
app.include_router(performance_router, prefix=API_PREFIX)
app.include_router(dashboard_router, prefix=API_PREFIX)
app.include_router(admin_router, prefix=API_PREFIX)
app.include_router(finance_router, prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
app.include_router(matches_router, prefix=API_PREFIX)


@app.on_event("startup")
async def startup_event():
    """Initialize database connection on startup"""
    logger.info("🚀 Running startup initialization...")
    try:
        init_db()
        logger.info("✅ Database connected and ready")
    except Exception as e:
        logger.error(f"❌ DB init failed: {str(e)}")
        # Continue anyway - routes will handle connection errors


@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Welcome to SSC API",
        "version": settings.API_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
@app.get(f"{API_PREFIX}/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


def custom_openapi():
    """Customize OpenAPI schema"""
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="SSC - Sculpt Soft Cricketers API",
        version=settings.API_VERSION,
        description="Complete cricket player management system with premium subscriptions",
        routes=app.routes,
    )
    
    openapi_schema["info"]["x-logo"] = {
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


@app.exception_handler(DatabaseUnavailableError)
async def database_unavailable_handler(request: Request, exc: DatabaseUnavailableError):
    return JSONResponse(
        status_code=503,
        content={"detail": str(exc)},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
