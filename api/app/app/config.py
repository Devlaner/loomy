import logging
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

DEFAULT_SECRET_KEY = "change-me-in-production"  # noqa: S105

Environment = Literal["development", "production", "test"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    environment: Environment = "development"

    database_url: str = "postgresql://postgres:postgres@localhost:5432/loomy"

    secret_key: str = DEFAULT_SECRET_KEY
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    redis_url: str = "redis://localhost:6379/0"

    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/auth/github/callback"

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"

    frontend_url: str = "http://localhost:5173"

    # Comma-separated CIDRs (e.g. "10.0.0.0/8,172.16.0.0/12") of reverse
    # proxies/load balancers allowed to set X-Forwarded-For. Left empty by
    # default: a client-supplied XFF is never trusted unless the direct
    # TCP peer is in this list, so rate limiting can't be bypassed by
    # sending an arbitrary XFF header directly to an exposed API.
    trusted_proxy_cidrs: str = ""

    email_backend: Literal["console", "smtp"] = "console"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from_address: str = "no-reply@loomy.app"
    email_from_name: str = "Loomy"

    password_reset_expire_minutes: int = 60

    # S3 / MinIO object storage. Used for user avatars, board logos,
    # template thumbnails, exports, and any other user-uploaded file.
    # Leave s3_endpoint_url empty to disable uploads entirely.
    #
    # All app assets live in a single bucket with per-kind prefixes
    # (e.g. `avatars/{user_id}/...`, `boards/{board_id}/logo/...`).
    s3_endpoint_url: str = ""
    s3_region: str = "us-east-1"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "loomy-assets"
    s3_presigned_url_expire_seconds: int = 3600
    s3_force_path_style: bool = True
    s3_public_endpoint_url: str = ""

    @model_validator(mode="after")
    def _enforce_production_invariants(self) -> "Settings":
        if self.environment == "production":
            problems: list[str] = []
            if self.secret_key == DEFAULT_SECRET_KEY or len(self.secret_key) < 32:
                problems.append(
                    "SECRET_KEY must be a strong random value (>=32 chars)"
                )
            if "postgres:postgres@" in self.database_url:
                problems.append(
                    "DATABASE_URL uses default postgres/postgres credentials"
                )
            if self.frontend_url.startswith("http://localhost"):
                problems.append("FRONTEND_URL must not point at localhost")
            if problems:
                raise ValueError(
                    "Invalid production configuration:\n  - "
                    + "\n  - ".join(problems)
                )
        elif self.secret_key == DEFAULT_SECRET_KEY:
            logger.warning("Using default SECRET_KEY (dev only)")
        return self


settings = Settings()
