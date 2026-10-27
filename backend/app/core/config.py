from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration settings for EcoSentinel."""

    # Project metadata
    PROJECT_NAME: str = "EcoSentinel"
    VERSION: str = "0.1.0"
    API_PREFIX: str = "/api"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Server configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Cross-Origin Resource Sharing (CORS)
    # Restricted by default to local frontend development servers
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []

    # Database configuration placeholder (Milestone 1/2 does NOT require a running DB)
    DATABASE_URL: Optional[str] = None

    # OpenAQ API v3 Provider Configuration
    # Free API key can be obtained at: https://explore.openaq.org/register
    OPENAQ_API_KEY: Optional[str] = None
    OPENAQ_BASE_URL: str = "https://api.openaq.org/v3"
    OPENAQ_TIMEOUT_SECONDS: float = 10.0

    # Data Quality Rules
    STALE_DATA_THRESHOLD_HOURS: int = 24

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
