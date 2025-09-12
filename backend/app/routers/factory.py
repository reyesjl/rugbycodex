from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import UserContext, auth_user
from ..db import fetch_all, fetch_one, insert_returning, execute
from ..policy import assert_same_org, can_read
from ..resources import ResourceDef


def build_crud_router(res: ResourceDef, base_prefix: str = "/api/v1") -> APIRouter:
    """Create a CRUD router for a specific resource with org isolation.

    - Players cannot create/update/delete.
    - Deletes require admin; enforce separately in higher-level routes if needed.
    - If the resource has no org column, listing and read are admin-only (conservative default).
    """

    router = APIRouter(prefix=base_prefix, tags=[res.name])
    base = f"/{res.name}"

    @router.get(base)
    async def list_items(
        user: UserContext = Depends(can_read),
        limit: int = Query(100, ge=1, le=500),
        offset: int = Query(0, ge=0),
    ):
        if not res.org_id_column and user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Listing restricted")
        where = f"{res.org_id_column} = %(org_id)s" if res.org_id_column else "1=1"
        sql = f"SELECT * FROM {res.table} WHERE {where} ORDER BY {res.pk} DESC LIMIT %(limit)s OFFSET %(offset)s"
        return await fetch_all(sql, {"org_id": user.org_id, "limit": limit, "offset": offset})

    @router.get(f"{base}/{{item_id}}")
    async def get_item(item_id: str, user: UserContext = Depends(can_read)):
        sql = f"SELECT * FROM {res.table} WHERE {res.pk} = %(id)s"
        row = await fetch_one(sql, {"id": item_id})
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if res.org_id_column:
            assert_same_org(user, row.get(res.org_id_column))
        elif user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        return row

    if not res.read_only:
        @router.post(base, status_code=status.HTTP_201_CREATED)
        async def create_item(body: Dict[str, Any], user: UserContext = Depends(auth_user)):
            if user.role == "player":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
            columns = list(body.keys())
            values = [f"%({c})s" for c in columns]
            if res.org_id_column and res.org_id_column not in body:
                body[res.org_id_column] = user.org_id
                columns.append(res.org_id_column)
                values.append(f"%({res.org_id_column})s")
            cols_sql = ",".join(columns)
            vals_sql = ",".join(values)
            sql = f"INSERT INTO {res.table} ({cols_sql}) VALUES ({vals_sql}) RETURNING *"
            return await insert_returning(sql, body)

        @router.put(f"{base}/{{item_id}}")
        async def update_item(item_id: str, body: Dict[str, Any], user: UserContext = Depends(auth_user)):
            if user.role == "player":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
            row = await fetch_one(f"SELECT * FROM {res.table} WHERE {res.pk}=%(id)s", {"id": item_id})
            if not row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
            if res.org_id_column:
                assert_same_org(user, row.get(res.org_id_column))
            sets = ",".join([f"{k}=%({k})s" for k in body.keys()])
            params = dict(body)
            params["id"] = item_id
            sql = f"UPDATE {res.table} SET {sets} WHERE {res.pk}=%(id)s"
            await execute(sql, params)
            return await fetch_one(f"SELECT * FROM {res.table} WHERE {res.pk}=%(id)s", {"id": item_id})

        @router.delete(f"{base}/{{item_id}}", status_code=status.HTTP_204_NO_CONTENT)
        async def delete_item(item_id: str, user: UserContext = Depends(auth_user)):
            if user.role != "admin":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
            row = await fetch_one(f"SELECT * FROM {res.table} WHERE {res.pk}=%(id)s", {"id": item_id})
            if not row:
                return
            if res.org_id_column:
                assert_same_org(user, row.get(res.org_id_column))
            await execute(f"DELETE FROM {res.table} WHERE {res.pk}=%(id)s", {"id": item_id})

    return router

