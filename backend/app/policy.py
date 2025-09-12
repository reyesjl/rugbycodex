from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status

from .auth import UserContext, auth_user
from .db import fetch_one


@dataclass
class Resource:
    name: str
    table: str
    pk: str = "id"
    org_id_column: Optional[str] = None
    read_only: bool = False
    # Optional: columns list can be used to validate payloads
    columns: Optional[list[str]] = None


async def get_org_policy(org_id: str, name: str) -> Optional[Dict[str, Any]]:
    row = await fetch_one(
        "SELECT rules FROM policies WHERE org_id = %(org_id)s AND name = %(name)s",
        {"org_id": org_id, "name": name},
    )
    return row["rules"] if row else None


def assert_same_org(user: UserContext, record_org_id: Optional[str]):
    if record_org_id and record_org_id != user.org_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-org access denied")


def can_admin_org(user: UserContext = Depends(auth_user)) -> UserContext:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user


def can_annotate(user: UserContext = Depends(auth_user)) -> UserContext:
    if user.role not in ("admin", "analyst", "coach"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Annotate not permitted for role")
    return user


def can_read(user: UserContext = Depends(auth_user)) -> UserContext:
    # Base read gate: user must be authenticated. Org isolation is enforced per-query by routers.
    return user


async def clip_query_where_for_user(user: UserContext) -> tuple[str, Dict[str, Any]]:
    # Base org isolation
    where = ["c.org_id = %(org_id)s"]
    params: Dict[str, Any] = {"org_id": user.org_id, "user_id": user.user_id}

    if user.role == "player":
        # Player restriction: only clips self-tagged in clip_metadata.context->'player_ids'
        # or curated exceptions after N days if policy says so.
        # Implementation note: context JSON schema is app-defined; here we use a pragmatic filter
        # that searches for the user_id in JSON text for demonstration. Replace with JSONB containment
        # when your data guarantees proper structure.
        where.append(
            "(" \
            "EXISTS (" \
            "  SELECT 1 FROM clip_metadata m " \
            "  WHERE m.clip_id = c.id AND m.context::text ILIKE %(user_id_like)s" \
            ") " \
            "OR EXISTS (" \
            "  SELECT 1 FROM clip_metadata m, policies p " \
            "  WHERE p.org_id = c.org_id AND p.name = 'player_access' " \
            "    AND (m.context->>'curated')::boolean IS TRUE AND m.clip_id = c.id " \
            "    AND c.created_at < now() - ((p.rules->>'player_can_view_curated_after_days')::int || ' days')::interval" \
            ")" \
            ")"
        )
        params["user_id_like"] = f"%{user.user_id}%"

    return " AND ".join(where), params

