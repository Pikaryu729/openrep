from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from openrep import __version__
from openrep.api.routes import analytics, backup, exercises, sets, workouts
from openrep.core.config import settings
from openrep.core.migrate import run_migrations

API_PREFIX = "/api"


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    yield


# Everything the API serves lives under /api, leaving the whole root namespace
# to the bundled single-page app. They are served from one origin, and the SPA
# owns /exercises and /workouts as client-side routes — the same paths the API
# used to answer with JSON.
app = FastAPI(
    title="OpenRep API",
    version=__version__,
    lifespan=lifespan,
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=f"{API_PREFIX}/redoc",
    openapi_url=f"{API_PREFIX}/openapi.json",
)

# Vestigial for the normal paths (the dev server proxies /api, and the packaged
# app is same-origin), but kept so a UI can still be pointed at a remote backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix=API_PREFIX)
api.include_router(exercises.router)
api.include_router(workouts.router)
api.include_router(sets.router)
api.include_router(analytics.router)
api.include_router(backup.router)


@api.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__}


app.include_router(api)
