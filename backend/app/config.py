import json
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_name: str = "DataExtractionTool"
    app_env: str = "development"
    secret_key: str = "change-me"
    debug: bool = True

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/data_extraction"
    database_url_sync: str = "postgresql://postgres:postgres@localhost:5432/data_extraction"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Anthropic
    anthropic_api_key: str = ""

    # JWT
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15
    jwt_refresh_token_expire_days: int = 7

    # File Storage
    upload_dir: str = "./storage/uploads"
    export_dir: str = "./storage/exports"
    max_upload_size_mb: int = 50

    # CORS
    cors_origins: str = '["http://localhost:5173","http://localhost:3000"]'

    # Embeddings
    embedding_model: str = "all-MiniLM-L6-v2"

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    @property
    def cors_origins_list(self) -> list[str]:
        return json.loads(self.cors_origins)

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def export_path(self) -> Path:
        path = Path(self.export_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()
