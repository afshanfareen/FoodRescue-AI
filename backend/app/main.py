import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import engine, Base
from app.api.routes import auth, donations, volunteers, ngos, admin, delivery, notifications, profiles

# Import all models to register them with SQLAlchemy
import app.models  # noqa: F401

app = FastAPI(
    title="FoodRescue AI API",
    description=(
        "AI-Assisted Hyperlocal Surplus Food Redistribution Platform. "
        "Connects food donors with NGOs and volunteers to reduce food waste."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving for uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "food_images"), exist_ok=True)
os.makedirs(os.path.join(settings.UPLOAD_DIR, "proof_images"), exist_ok=True)
os.makedirs(settings.AI_MODEL_DIR, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Routes
app.include_router(auth.router, prefix="/api")
app.include_router(donations.router, prefix="/api")
app.include_router(volunteers.router, prefix="/api")
app.include_router(ngos.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(delivery.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(profiles.router, prefix="/api")


@app.on_event("startup")
def create_tables():
    """Create all database tables on startup."""
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "FoodRescue AI API", "version": "1.0.0"}
