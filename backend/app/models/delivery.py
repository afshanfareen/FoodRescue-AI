import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class DeliveryStatus(str, enum.Enum):
    ASSIGNED = "ASSIGNED"
    ACCEPTED = "ACCEPTED"
    PICKUP_IN_PROGRESS = "PICKUP_IN_PROGRESS"
    PICKED_UP = "PICKED_UP"
    DELIVERY_IN_PROGRESS = "DELIVERY_IN_PROGRESS"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Delivery(Base):
    __tablename__ = "deliveries"

    id = Column(Integer, primary_key=True, index=True)
    donation_id = Column(Integer, ForeignKey("food_donations.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteer_profiles.id"), nullable=False, index=True)
    ngo_id = Column(Integer, ForeignKey("ngo_profiles.id"), nullable=False, index=True)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    accepted_at = Column(DateTime, nullable=True)
    pickup_time = Column(DateTime, nullable=True)
    delivery_time = Column(DateTime, nullable=True)
    pickup_latitude = Column(Float, nullable=True)
    pickup_longitude = Column(Float, nullable=True)
    delivery_latitude = Column(Float, nullable=True)
    delivery_longitude = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=True)
    estimated_time_minutes = Column(Float, nullable=True)
    pickup_verified = Column(Boolean, default=False)
    delivery_verified = Column(Boolean, default=False)
    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.ASSIGNED, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    donation = relationship("FoodDonation", back_populates="delivery")
    volunteer = relationship("VolunteerProfile", back_populates="deliveries")
    ngo = relationship("NGOProfile", back_populates="deliveries")
    otp_verifications = relationship("OTPVerification", back_populates="delivery")
    proof_of_delivery = relationship("ProofOfDelivery", back_populates="delivery", uselist=False)
