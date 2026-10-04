from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class MatchingRecord(Base):
    __tablename__ = "matching_records"

    id = Column(Integer, primary_key=True, index=True)
    donation_id = Column(Integer, ForeignKey("food_donations.id", ondelete="CASCADE"), nullable=False, index=True)
    volunteer_id = Column(Integer, ForeignKey("volunteer_profiles.id"), nullable=True)
    ngo_id = Column(Integer, ForeignKey("ngo_profiles.id"), nullable=True)
    matching_score = Column(Float, nullable=True)
    distance_km = Column(Float, nullable=True)
    score_breakdown = Column(JSON, nullable=True)
    matched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    status = Column(String(50), default="SUGGESTED")

    donation = relationship("FoodDonation", back_populates="matching_records")
