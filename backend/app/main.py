from __future__ import annotations

import logging

from fastapi import FastAPI

from .config import get_settings
from .db import init_db, close_db
from .routers.generic import router as generic_admin_router
from .routers.clips import router as clips_router
from .routers.factory import build_crud_router
from .resources import RESOURCES


settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger("rugbycodex.api")


app = FastAPI(title="RugbyCodex API", version="0.1.0")


@app.on_event("startup")
async def _startup():
    await init_db()
    logger.info("DB initialized")


@app.on_event("shutdown")
async def _shutdown():
    await close_db()
    logger.info("DB closed")


@app.get("/")
async def root():
    return {"message": "RugbyCodex API. See /docs", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Public API v1 routers
app.include_router(clips_router)

# Dedicated routers per resource under /api/v1 (excluding clips which is specialized)
for name, res in RESOURCES.items():
    # Exclude clips if present (we removed it from RESOURCES, but keep guard)
    if name == "clips":
        continue
    app.include_router(build_crud_router(res))

# Admin-only generic CRUD for all resources under /api/admin
app.include_router(generic_admin_router)
