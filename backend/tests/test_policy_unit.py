from __future__ import annotations

from dataclasses import dataclass
from hypothesis import given, strategies as st

from app.policy import assert_same_org
from app.auth import UserContext


@dataclass
class _R:
    org_id: str | None


def test_cross_org_denied():
    user = UserContext(user_id="u1", org_id="org1", role="coach")
    try:
        assert_same_org(user, "org2")
        assert False, "Expected exception"
    except Exception as e:
        assert "Cross-org" in str(e)


@given(
    user_org=st.uuids().map(str),
    rec_org=st.one_of(st.none(), st.uuids().map(str)),
)
def test_assert_same_org_property(user_org: str, rec_org: str | None):
    user = UserContext(user_id="u", org_id=user_org, role="analyst")
    if rec_org is None or rec_org == user_org:
        # should not raise
        assert_same_org(user, rec_org)
    else:
        try:
            assert_same_org(user, rec_org)
            assert False, "Expected cross-org denial"
        except Exception as e:
            assert "Cross-org" in str(e)

