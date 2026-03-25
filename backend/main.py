"""FastAPI application entry point."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

import socketio
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from api import router as api_router
from cleanup import start_scheduler, stop_scheduler
from socket_manager import sio

UPLOAD_ROOT = Path(__file__).parent / "uploads"
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    start_scheduler()
    yield
    stop_scheduler()


fastapi_app = FastAPI(lifespan=lifespan)

fastapi_app.include_router(api_router, prefix="/api")

# Serve uploaded media files
fastapi_app.mount("/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")

# Serve built frontend in production
if FRONTEND_DIST.exists():
    fastapi_app.mount(
        "/assets",
        StaticFiles(directory=str(FRONTEND_DIST / "assets")),
        name="frontend-assets",
    )

    @fastapi_app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")


# Wrap FastAPI with Socket.IO ASGI middleware
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
