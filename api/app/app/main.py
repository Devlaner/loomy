from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import settings
from app.core.rate_limit import RateLimitMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield


app = FastAPI(
    title="Loomy API",
    description="Open-source collaborative whiteboard API",
    version="0.0.1",
    lifespan=lifespan,
)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if settings.frontend_url:
    base = settings.frontend_url.rstrip("/")
    if base not in origins:
        origins.append(base)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware, requests_per_minute=120)
app.include_router(api_router, prefix="")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
