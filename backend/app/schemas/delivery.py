from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.delivery import DeliveryStatus


class DeliveryResponse(BaseModel):
    id: int
    donation_id: int
    volunteer_id: int
    ngo_id: int
    assigned_at: datetime
    accepted_at: Optional[datetime]
    pickup_time: Optional[datetime]
    delivery_time: Optional[datetime]
    distance_km: Optional[float]
    estimated_time_minutes: Optional[float]
    pickup_verified: bool
    delivery_verified: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class OTPVerifyRequest(BaseModel):
    otp: str


class OTPResponse(BaseModel):
    otp: str
    expires_at: datetime
    message: str


class ProofOfDeliveryCreate(BaseModel):
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ProofOfDeliveryResponse(BaseModel):
    id: int
    delivery_id: int
    image_url: Optional[str]
    notes: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    uploaded_at: datetime

    class Config:
        from_attributes = True
