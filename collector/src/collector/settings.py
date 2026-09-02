"""수집기가 필요로 하는 환경 변수 선언.

값은 로컬에서는 `collector/.env`, Modal 에서는 Secret, GCP 에서는
Cloud Run Job 환경 변수로 주입한다.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    # --- 저장소 -------------------------------------------------------------
    database_url: str = Field(description="postgresql://user:pass@host:5432/db")

    # --- 원천 API -----------------------------------------------------------
    naver_client_id: str = Field(description="네이버 뉴스 검색 API client id")
    naver_client_secret: str = Field(description="네이버 뉴스 검색 API client secret")
    gemini_api_key: str = Field(description="Google AI Studio API key")
    tour_api_key: str = Field(default="", description="기관명 → place_id 연결용 (선택)")

    # --- 실행 옵션 ----------------------------------------------------------
    log_level: LogLevel = "INFO"
    dry_run: bool = Field(default=False, description="True 면 DB 에 쓰지 않는다")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """프로세스당 한 번만 읽는다."""
    return Settings()  # type: ignore[call-arg]
