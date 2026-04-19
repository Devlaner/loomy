"""Production config sanity checks (Phase 3.1)."""

import pytest

from app.config import DEFAULT_SECRET_KEY, Settings


def _prod_settings(**overrides: object) -> Settings:
    base: dict[str, object] = {
        "environment": "production",
        "secret_key": "x" * 48,
        "database_url": "postgresql://app:strongpw@db.internal/loomy",
        "frontend_url": "https://app.example.com",
    }
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_accepts_well_formed_production_config() -> None:
    s = _prod_settings()
    assert s.environment == "production"


def test_rejects_default_secret_key_in_production() -> None:
    with pytest.raises(ValueError, match="SECRET_KEY"):
        _prod_settings(secret_key=DEFAULT_SECRET_KEY)


def test_rejects_short_secret_key_in_production() -> None:
    with pytest.raises(ValueError, match="SECRET_KEY"):
        _prod_settings(secret_key="too-short")


def test_rejects_default_postgres_credentials_in_production() -> None:
    with pytest.raises(ValueError, match="DATABASE_URL"):
        _prod_settings(database_url="postgresql://postgres:postgres@db/loomy")


def test_rejects_localhost_frontend_url_in_production() -> None:
    with pytest.raises(ValueError, match="FRONTEND_URL"):
        _prod_settings(frontend_url="http://localhost:5173")


def test_development_accepts_defaults() -> None:
    s = Settings(environment="development")
    assert s.environment == "development"
