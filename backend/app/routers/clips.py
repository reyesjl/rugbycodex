from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import UserContext
from ..db import fetch_all, fetch_one, insert_returning, execute
from ..policy import can_read, clip_query_where_for_user


router = APIRouter(prefix="/api/v1", tags=["clips"])


@router.get("/clips")
async def list_clips(
    user: UserContext = Depends(can_read),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    where, params = await clip_query_where_for_user(user)
    params.update({"limit": limit, "offset": offset})
    sql = (
        "SELECT c.* FROM clips c WHERE "
        + where
        + " ORDER BY c.created_at DESC LIMIT %(limit)s OFFSET %(offset)s"
    )
    return await fetch_all(sql, params)


@router.get("/clips/{clip_id}")
async def get_clip(clip_id: str, user: UserContext = Depends(can_read)):
    where, params = await clip_query_where_for_user(user)
    params["clip_id"] = clip_id
    sql = "SELECT c.* FROM clips c WHERE c.id = %(clip_id)s AND " + where
    row = await fetch_one(sql, params)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return row


@router.post("/clips", status_code=status.HTTP_201_CREATED)
async def create_clip(body: Dict[str, Any], user: UserContext = Depends(can_read)):
    if user.role == "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    # force org_scope
    body.setdefault("org_id", user.org_id)
    columns = list(body.keys())
    vals = ",".join([f"%({c})s" for c in columns])
    sql = f"INSERT INTO clips ({','.join(columns)}) VALUES ({vals}) RETURNING *"
    return await insert_returning(sql, body)


@router.put("/clips/{clip_id}")
async def update_clip(clip_id: str, body: Dict[str, Any], user: UserContext = Depends(can_read)):
    if user.role == "player":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    # ensure org isolation on update
    where, params = await clip_query_where_for_user(user)
    params["clip_id"] = clip_id
    present = await fetch_one("SELECT c.id FROM clips c WHERE c.id=%(clip_id)s AND " + where, params)
    if not present:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    sets = ",".join([f"{k}=%({k})s" for k in body.keys()])
    body["id"] = clip_id
    await execute(f"UPDATE clips SET {sets} WHERE id=%(id)s", body)
    return await fetch_one("SELECT * FROM clips WHERE id=%(id)s", {"id": clip_id})


@router.delete("/clips/{clip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clip(clip_id: str, user: UserContext = Depends(can_read)):
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    where, params = await clip_query_where_for_user(user)
    params["clip_id"] = clip_id
    present = await fetch_one("SELECT c.id FROM clips c WHERE c.id=%(clip_id)s AND " + where, params)
    if present:
        await execute("DELETE FROM clips WHERE id=%(clip_id)s", {"clip_id": clip_id})
