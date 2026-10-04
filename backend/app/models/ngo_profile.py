import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Enum, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class NGOProfile(Base):
    __tablename__ = "ngo_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    organization_name = Column(String(300), nullable=True)
    registration_number = Column(String(100), nullable=True)
    address = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    capacity_kg = Column(Float, default=100.0)
    beneficiary_count = Column(Integer, default=0)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.PENDING)
    is_approved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="ngo_profile")
    deliveries = relationship("Delivery", back_populates="ngo")
    requirements = relationship("NGORequirement", back_populates="ngo")
