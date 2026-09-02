from __future__ import annotations

import pytest

from collector.settings import Settings

REQUIRED = {
    "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/geunal",
    "NAVER_CLIENT_ID": "id",
    "NAVER_CLIENT_SECRET": "secret",
    "GEMINI_API_KEY": "key",
}


def test_settings_load_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key, value in REQUIRED.items():
        monkeypatch.setenv(key, value)

    settings = Settings(_env_file=None)  # type: ignore[call-arg]

    assert settings.database_url == REQUIRED["DATABASE_URL"]
    assert settings.log_level == "INFO"
    assert settings.dry_run is False
    assert settings.tour_api_key == ""


def test_settings_require_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    for key, value in REQUIRED.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("DATABASE_URL")

    with pytest.raises(ValueError, match="database_url"):
        Settings(_env_file=None)  # type: ignore[call-arg]
