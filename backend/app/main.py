from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analytics, backup, exercises, sets, workouts
from app.core.config import settings
from app.core.migrate import run_migrations


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    yield


app = FastAPI(title="OpenRep API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(exercises.router)
app.include_router(workouts.router)
app.include_router(sets.router)
app.include_router(analytics.router)
app.include_router(backup.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
