from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.routers import auth, onboarding, plan, calendar, log, simulate, stt, recovery

settings = get_settings()

app = FastAPI(
    title="Bodify API",
    description="Multi-agent AI partner for your body transformation journey",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(plan.router, prefix="/plan", tags=["plan"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["onboarding"])
app.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
app.include_router(log.router, prefix="/log", tags=["log"])
app.include_router(simulate.router, prefix="/simulate", tags=["simulate"])
app.include_router(stt.router, prefix="/stt", tags=["stt"])
app.include_router(recovery.router, prefix="/recovery", tags=["recovery"])


@app.get("/health")
def health_check():
    return {"status": "ok"}
