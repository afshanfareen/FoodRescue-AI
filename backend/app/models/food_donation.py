import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Enum, Float, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class FoodCategory(str, enum.Enum):
    RICE = "RICE"
    BIRYANI = "BIRYANI"
    CURRY = "CURRY"
    VEGETABLES = "VEGETABLES"
    BREAD = "BREAD"
    CHAPATI = "CHAPATI"
    FRUITS = "FRUITS"
    BAKERY = "BAKERY"
    MIXED_MEAL = "MIXED_MEAL"
    OTHER = "OTHER"


class DonationStatus(str, enum.Enum):
    CREATED = "CREATED"
    QUALITY_CHECK = "QUALITY_CHECK"
    APPROVED = "APPROVED"
    MATCHING = "MATCHING"
    VOLUNTEER_ASSIGNED = "VOLUNTEER_ASSIGNED"
    PICKUP_IN_PROGRESS = "PICKUP_IN_PROGRESS"
    PICKED_UP = "PICKED_UP"
    DELIVERY_IN_PROGRESS = "DELIVERY_IN_PROGRESS"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class RiskLevel(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# Valid state transitions
VALID_TRANSITIONS = {
    DonationStatus.CREATED: [DonationStatus.QUALITY_CHECK, DonationStatus.CANCELLED],
    DonationStatus.QUALITY_CHECK: [DonationStatus.APPROVED, DonationStatus.REJECTED, DonationStatus.CANCELLED],
    DonationStatus.APPROVED: [DonationStatus.MATCHING, DonationStatus.EXPIRED, DonationStatus.CANCELLED],
    DonationStatus.MATCHING: [DonationStatus.VOLUNTEER_ASSIGNED, DonationStatus.EXPIRED, DonationStatus.CANCELLED],
    DonationStatus.VOLUNTEER_ASSIGNED: [DonationStatus.PICKUP_IN_PROGRESS, DonationStatus.MATCHING, DonationStatus.CANCELLED],
    DonationStatus.PICKUP_IN_PROGRESS: [DonationStatus.PICKED_UP, DonationStatus.CANCELLED],
    DonationStatus.PICKED_UP: [DonationStatus.DELIVERY_IN_PROGRESS],
    DonationStatus.DELIVERY_IN_PROGRESS: [DonationStatus.DELIVERED],
    DonationStatus.DELIVERED: [DonationStatus.COMPLETED],
    DonationStatus.COMPLETED: [],
    DonationStatus.REJECTED: [],
    DonationStatus.EXPIRED: [],
    DonationStatus.CANCELLED: [],
}


def is_valid_transition(current: DonationStatus, next_status: DonationStatus) -> bool:
    return next_status in VALID_TRANSITIONS.get(current, [])


class FoodDonation(Base):
    __tablename__ = "food_donations"

    id = Column(Integer, primary_key=True, index=True)
    donor_id = Column(Integer, ForeignKey("donor_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    food_name = Column(String(300), nullable=False)
    food_category = Column(Enum(FoodCategory), nullable=False)
    quantity_kg = Column(Float, nullable=False)
    estimated_meals = Column(Integer, nullable=True)
    cooked_at = Column(DateTime, nullable=False)
    reported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    temperature_c = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String(500), nullable=True)
    quality_score = Column(Float, nullable=True)
    risk_level = Column(Enum(RiskLevel), nullable=True)
    quality_status = Column(String(50), nullable=True)
    expiry_estimate = Column(DateTime, nullable=True)
    status = Column(Enum(DonationStatus), default=DonationStatus.CREATED, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    donor = relationship("DonorProfile", back_populates="donations")
    images = relationship("FoodImage", back_populates="donation")
    quality_assessment = relationship("QualityAssessment", back_populates="donation", uselist=False)
    delivery = relationship("Delivery", back_populates="donation", uselist=False)
    matching_records = relationship("MatchingRecord", back_populates="donation")

    __table_args__ = (Index("ix_donations_status_created", "status", "created_at"),)
