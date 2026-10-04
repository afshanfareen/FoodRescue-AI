from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/foodrescue"
    SECRET_KEY: str = "foodrescue-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    APP_ENV: str = "development"
    DEBUG: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10
    AI_MODEL_DIR: str = "ai_models"
    OSRM_URL: str = ""

    # Email (SMTP) settings for password reset
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "FoodRescue AI"
    APP_BASE_URL: str = "http://localhost:5173"

    # Matching weights
    MATCH_WEIGHT_DISTANCE: float = 0.40
    MATCH_WEIGHT_CAPACITY: float = 0.25
    MATCH_WEIGHT_AVAILABILITY: float = 0.20
    MATCH_WEIGHT_VEHICLE: float = 0.10
    MATCH_WEIGHT_RELIABILITY: float = 0.05

    # Quality score weights
    QUALITY_WEIGHT_IMAGE: float = 0.40
    QUALITY_WEIGHT_TEMPERATURE: float = 0.30
    QUALITY_WEIGHT_TIME: float = 0.20
    QUALITY_WEIGHT_FOOD_TYPE: float = 0.10

    # Quality thresholds (configurable prototype rules, NOT official standards)
    QUALITY_THRESHOLD_LOW_RISK: float = 70.0
    QUALITY_THRESHOLD_MEDIUM_RISK: float = 50.0

    # Max search radius km
    MAX_SEARCH_RADIUS_KM: float = 25.0

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
