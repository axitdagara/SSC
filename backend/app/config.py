import os
from pydantic_settings import BaseSettings


def env_first(keys: list[str], default: str) -> str:
    for key in keys:
        value = os.getenv(key)
        if value is not None and str(value).strip() != "":
            return value
    return default


def env_first_int(keys: list[str], default: int) -> int:
    value = env_first(keys, str(default))
    try:
        return int(value)
    except ValueError:
        return default


def env_first_bool(keys: list[str], default: bool) -> bool:
    value = env_first(keys, "true" if default else "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = env_first(["DATABASE_URL", "DATABASEURL"], "sqlite:///./ssc.db")
    
    # Security
    SECRET_KEY: str = env_first(["SECRET_KEY", "SECRETKEY"], "dev-secret-key-change-in-production")
    ALGORITHM: str = env_first(["ALGORITHM"], "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = env_first_int(
        ["ACCESS_TOKEN_EXPIRE_MINUTES", "ACCESSTOKENEXPIREMINUTES"],
        30,
    )
    
    # Premium Settings
    PREMIUM_COST: int = env_first_int(["PREMIUM_COST", "PREMIUMCOST"], 1000)  # in rupees
    PREMIUM_DURATION_DAYS: int = env_first_int(
        ["PREMIUM_DURATION_DAYS", "PREMIUMDURATIONDAYS"],
        30,
    )
    
    # Email Settings
    SMTP_SERVER: str = env_first(["SMTP_SERVER", "SMTPSERVER"], "smtp.gmail.com")
    SMTP_PORT: int = env_first_int(["SMTP_PORT", "SMTPPORT"], 587)
    SMTP_USER: str = env_first(["SMTP_USER", "SMTPUSER"], "")
    SMTP_PASSWORD: str = env_first(["SMTP_PASSWORD", "SMTPPASSWORD"], "")
    
    # Admin
    ADMIN_EMAIL: str = env_first(["ADMIN_EMAIL", "ADMINEMAIL"], "admin@ssc.com")
    ADMIN_PASSWORD: str = env_first(["ADMIN_PASSWORD", "ADMINPASSWORD"], "admin123")
    
    # API
    API_TITLE: str = env_first(["API_TITLE", "APITITLE"], "SSC API")
    API_VERSION: str = env_first(["API_VERSION", "APIVERSION"], "1.0.0")
    DEBUG: bool = env_first_bool(["DEBUG"], False)

    # Deployment / CORS
    CORS_ORIGINS: str = env_first(
        ["CORS_ORIGINS", "CORSORIGINS"],
        "http://localhost:3000,http://127.0.0.1:3000",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
