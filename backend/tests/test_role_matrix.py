from __future__ import annotations

import pytest

import asyncio
from app.auth import UserContext
from app.routers.clips import create_clip


@pytest.mark.parametrize("role,expect_forbidden", [
    ("admin", False),
    ("analyst", False),
    ("coach", False),
    ("player", True),
])
def test_players_cannot_create_clips(role: str, expect_forbidden: bool):
    user = UserContext(user_id="u1", org_id="org1", role=role)
    body = {"media_id": "m", "start_ms": 0, "end_ms": 1000}
    if expect_forbidden:
        with pytest.raises(Exception) as e:
            # create_clip applies role gate before DB operations
            _ = asyncio.get_event_loop().run_until_complete(create_clip(body=body, user=user))  # type: ignore
        assert "403" in str(e.value) or "Forbidden" in str(e.value)
    else:
        # We cannot hit DB here, but we ensure the function does not raise at role gate.
        try:
            _ = asyncio.get_event_loop().run_until_complete(create_clip(body=body, user=user))  # type: ignore
        except Exception as ex:
            # Allowed to raise later due to missing DB; just not for 403 role gate.
            assert "403" not in str(ex)
