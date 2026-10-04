from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.donor_profile import OrganizationType
from app.models.volunteer_profile import VehicleType, AvailabilityStatus


class DonorProfileUpdate(BaseModel):
    organization_name: Optional[str] = None
    organization_type: Optional[OrganizationType] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DonorProfileResponse(BaseModel):
    id: int
    user_id: int
    organization_name: Optional[str]
    organization_type: Optional[str]
    address: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    verification_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class VolunteerProfileUpdate(BaseModel):
    vehicle_type: Optional[VehicleType] = None
    vehicle_capacity_kg: Optional[float] = None
    availability_status: Optional[AvailabilityStatus] = None
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None


class VolunteerProfileResponse(BaseModel):
    id: int
    user_id: int
    vehicle_type: Optional[str]
    vehicle_capacity_kg: float
    availability_status: str
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    rating: float
    total_deliveries: int
    is_approved: bool

    class Config:
        from_attributes = True


class NGOProfileUpdate(BaseModel):
    organization_name: Optional[str] = None
    registration_number: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity_kg: Optional[float] = None
    beneficiary_count: Optional[int] = None


class NGOProfileResponse(BaseModel):
    id: int
    user_id: int
    organization_name: Optional[str]
    registration_number: Optional[str]
    address: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    capacity_kg: float
    beneficiary_count: int
    verification_status: str
    is_approved: bool

    class Config:
        from_attributes = True


class NGORequirementUpdate(BaseModel):
    required_quantity_kg: Optional[float] = None
    food_categories: Optional[List[str]] = None
    preferred_delivery_time_start: Optional[str] = None
    preferred_delivery_time_end: Optional[str] = None
    notes: Optional[str] = None


class NGORequirementResponse(BaseModel):
    id: int
    ngo_id: int
    required_quantity_kg: float
    food_categories: Optional[List[str]]
    notes: Optional[str]

    class Config:
        from_attributes = True
