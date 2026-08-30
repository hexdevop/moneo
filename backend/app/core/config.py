from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_user: str = "moneo"
    postgres_password: str = "moneo"
    postgres_db: str = "moneo"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    secret_key: str = "dev-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    # Set to true in production (served over HTTPS behind Caddy).
    cookie_secure: bool = False

    cors_origins: str = "http://localhost:5173"

    exchange_rate_api_url: str = "https://open.er-api.com/v6/latest"

    frontend_url: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Moneo <no-reply@moneo.local>"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
