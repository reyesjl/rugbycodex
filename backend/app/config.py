import os
from dataclasses import dataclass


@dataclass
class Settings:
    database_url: str
    jwt_secret: str
    jwt_issuer: str
    log_level: str = "info"


def get_settings() -> Settings:
    # Avoid importing dotenv by default; available if user wants to load .env.
    return Settings(
        database_url=os.environ.get("DATABASE_URL", ""),
        jwt_secret=os.environ.get("JWT_SECRET", "dev-secret"),
        jwt_issuer=os.environ.get("JWT_ISSUER", "rugbycodex"),
        log_level=os.environ.get("LOG_LEVEL", "info"),
    )

