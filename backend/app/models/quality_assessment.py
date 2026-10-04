from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.food_donation import RiskLevel


class QualityAssessment(Base):
    __tablename__ = "quality_assessments"

    id = Column(Integer, primary_key=True, index=True)
    donation_id = Column(Integer, ForeignKey("food_donations.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    image_score = Column(Float, nullable=True)
    temperature_score = Column(Float, nullable=True)
    time_score = Column(Float, nullable=True)
    food_type_score = Column(Float, nullable=True)
    overall_quality_score = Column(Float, nullable=False)
    risk_level = Column(Enum(RiskLevel), nullable=False)
    model_name = Column(String(100), nullable=True)
    model_version = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    assessment_notes = Column(String(500), nullable=True)
    assessment_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    donation = relationship("FoodDonation", back_populates="quality_assessment")
