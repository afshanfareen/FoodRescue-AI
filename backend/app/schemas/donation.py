from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, List
from app.models.food_donation import FoodCategory, DonationStatus, RiskLevel


class DonationCreate(BaseModel):
    food_name: str
    food_category: FoodCategory
    quantity_kg: float
    estimated_meals: Optional[int] = None
    cooked_at: datetime
    temperature_c: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("quantity_kg")
    @classmethod
    def positive_quantity(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v


class DonationUpdate(BaseModel):
    food_name: Optional[str] = None
    food_category: Optional[FoodCategory] = None
    quantity_kg: Optional[float] = None
    estimated_meals: Optional[int] = None
    temperature_c: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class QualityAssessmentResponse(BaseModel):
    id: int
    image_score: Optional[float]
    temperature_score: Optional[float]
    time_score: Optional[float]
    food_type_score: Optional[float]
    overall_quality_score: float
    risk_level: str
    model_name: Optional[str]
    model_version: Optional[str]
    confidence: Optional[float]
    assessment_notes: Optional[str]
    assessment_timestamp: datetime

    class Config:
        from_attributes = True


class DonationResponse(BaseModel):
    id: int
    donor_id: int
    food_name: str
    food_category: str
    quantity_kg: float
    estimated_meals: Optional[int]
    cooked_at: datetime
    reported_at: datetime
    temperature_c: Optional[float]
    latitude: Optional[float]
    longitude: Optional[float]
    address: Optional[str]
    quality_score: Optional[float]
    risk_level: Optional[str]
    quality_status: Optional[str]
    expiry_estimate: Optional[datetime]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    quality_assessment: Optional[QualityAssessmentResponse] = None
    images: Optional[List[dict]] = []

    class Config:
        from_attributes = True
