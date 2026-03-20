import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./ssc.db"
    
    # Security
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Premium Settings
    PREMIUM_COST: int = 1000  # in rupees
    PREMIUM_DURATION_DAYS: int = 30
    
    # Email Settings
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    
    # Admin
    ADMIN_EMAIL: str = "admin@ssc.com"
    ADMIN_PASSWORD: str = "admin123"
    
    # API
    API_TITLE: str = "SSC API"
    API_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Deployment / CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
