import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Enum, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class OrganizationType(str, enum.Enum):
    RESTAURANT = "RESTAURANT"
    HOTEL = "HOTEL"
    WEDDING_HALL = "WEDDING_HALL"
    HOSTEL = "HOSTEL"
    COLLEGE = "COLLEGE"
    CORPORATE_CAFETERIA = "CORPORATE_CAFETERIA"
    COMMUNITY_KITCHEN = "COMMUNITY_KITCHEN"
    INDIVIDUAL = "INDIVIDUAL"
    OTHER = "OTHER"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class DonorProfile(Base):
    __tablename__ = "donor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    organization_name = Column(String(300), nullable=True)
    organization_type = Column(Enum(OrganizationType), default=OrganizationType.OTHER)
    address = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="donor_profile")
    donations = relationship("FoodDonation", back_populates="donor")
