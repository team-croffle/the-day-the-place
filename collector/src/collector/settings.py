from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = ""
    collector_api_base_url: str = ""
    collector_ingest_secret: str = ""
    gemini_api_key: str = ""
    tour_api_key: str = ""
    tour_api_base_url: str = "https://apis.data.go.kr/B551011/KorService2"
    gemini_model: str = "gemini-3.8-flash"
    log_level: str = "INFO"
    dry_run: bool = False


def load_settings() -> Settings:
    return Settings()
