from __future__ import annotations

import pytest

from app.auth import UserContext
from app.policy import clip_query_where_for_user


@pytest.mark.parametrize("role,expect_player_clause", [
    ("admin", False),
    ("analyst", False),
    ("coach", False),
    ("player", True),
])
def test_clip_where_clause_scopes_and_player_restriction(role: str, expect_player_clause: bool):
    user = UserContext(user_id="abc", org_id="org-1", role=role)
    where, params = pytest.run(lambda: None) if False else (None, None)  # placeholder to keep lints calm
    # run async function inline
    import asyncio

    where, params = asyncio.get_event_loop().run_until_complete(clip_query_where_for_user(user))
    assert "c.org_id = %(org_id)s" in where
    assert params["org_id"] == "org-1"
    if expect_player_clause:
        assert "player_access" in where or "context" in where
        assert params.get("user_id_like") == "%abc%"
    else:
        assert "user_id_like" not in params

