from datetime import datetime, timezone
from typing import Any, Dict, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings


bearer = HTTPBearer(auto_error=False)


class UserContext:
    def __init__(self, user_id: str, org_id: str, role: str, team_id: Optional[str] = None):
        self.user_id = user_id
        self.org_id = org_id
        self.role = role
        self.team_id = team_id


def decode_jwt(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
        iss = payload.get("iss")
        if iss and iss != settings.jwt_issuer:
            raise jwt.InvalidIssuerError("Invalid issuer")
        exp = payload.get("exp")
        if exp and datetime.now(timezone.utc).timestamp() > float(exp):
            raise jwt.ExpiredSignatureError("Token expired")
        return payload
    except jwt.PyJWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


def auth_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> UserContext:
    if credentials is None or not credentials.scheme.lower() == "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = decode_jwt(credentials.credentials)
    sub = payload.get("sub")
    org_id = payload.get("org_id")
    role = payload.get("role")
    team_id = payload.get("team_id")
    if not sub or not org_id or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return UserContext(user_id=str(sub), org_id=str(org_id), role=str(role), team_id=str(team_id) if team_id else None)


def require_roles(*roles: str):
    def dep(user: UserContext = Depends(auth_user)) -> UserContext:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return dep

