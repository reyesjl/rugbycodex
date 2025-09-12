from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..auth import UserContext, auth_user, require_roles
from ..db import fetch_all, fetch_one, insert_returning, execute
from ..resources import RESOURCES, ResourceDef
from ..policy import assert_same_org, can_read


# Admin-only generic CRUD mounted under /api/admin to avoid overlapping public routes
router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_roles("admin"))])


def org_filter_sql(res: ResourceDef) -> str:
    if res.org_id_column:
        return f"{res.org_id_column} = %(org_id)s"
    return "1=1"


def register_resource_routes(name: str, res: ResourceDef):
    base = f"/{name}"

    @router.get(base)
    async def list_items(
        user: UserContext = Depends(can_read),
        limit: int = Query(100, ge=1, le=500),
        offset: int = Query(0, ge=0),
    ):
        where = org_filter_sql(res)
        sql = f"SELECT * FROM {res.table} WHERE {where} ORDER BY {res.pk} DESC LIMIT %(limit)s OFFSET %(offset)s"
        params: Dict[str, Any] = {"org_id": user.org_id, "limit": limit, "offset": offset}
        if not res.org_id_column:
            # Not org-scoped: restrict access to admins for listing
            if user.role != "admin":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Listing restricted")
        return await fetch_all(sql, params)

    @router.get(f"{base}/{{item_id}}")
    async def get_item(item_id: str, user: UserContext = Depends(can_read)):
        sql = f"SELECT * FROM {res.table} WHERE {res.pk} = %(id)s"
        row = await fetch_one(sql, {"id": item_id})
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if res.org_id_column:
            assert_same_org(user, row.get(res.org_id_column))
        else:
            # Non org-scoped: admin-only read unless otherwise handled
            if user.role != "admin":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        return row

    if not res.read_only:
        @router.post(base, status_code=status.HTTP_201_CREATED)
        async def create_item(body: Dict[str, Any], user: UserContext = Depends(auth_user)):
            # Basic role gating: players cannot create
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


for name, res in RESOURCES.items():
    register_resource_routes(name, res)
