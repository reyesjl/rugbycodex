from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Dict, Optional

import psycopg
from psycopg.rows import dict_row

from .config import get_settings


_pool: Optional[psycopg.AsyncConnection] = None


async def init_db() -> None:
    global _pool
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is not set")
    if _pool is None:
        _pool = await psycopg.AsyncConnection.connect(settings.database_url, row_factory=dict_row)


async def close_db() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_conn() -> psycopg.AsyncConnection:
    if _pool is None:
        raise RuntimeError("DB not initialized. Call init_db() first.")
    return _pool


@asynccontextmanager
async def tx() -> AsyncIterator[psycopg.AsyncConnection]:
    conn = get_conn()
    async with conn.transaction():
        yield conn


async def fetch_one(sql: str, params: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    conn = get_conn()
    async with conn.cursor() as cur:
        await cur.execute(sql, params or {})
        row = await cur.fetchone()
        return dict(row) if row else None


async def fetch_all(sql: str, params: Optional[Dict[str, Any]] = None) -> list[Dict[str, Any]]:
    conn = get_conn()
    async with conn.cursor() as cur:
        await cur.execute(sql, params or {})
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def execute(sql: str, params: Optional[Dict[str, Any]] = None) -> None:
    conn = get_conn()
    async with conn.cursor() as cur:
        await cur.execute(sql, params or {})


async def insert_returning(sql: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    conn = get_conn()
    async with conn.cursor() as cur:
        await cur.execute(sql, params or {})
        row = await cur.fetchone()
        if row is None:
            raise RuntimeError("insert_returning expected a row")
        return dict(row)

