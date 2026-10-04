from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


class NGORequirement(Base):
    __tablename__ = "ngo_requirements"

    id = Column(Integer, primary_key=True, index=True)
    ngo_id = Column(Integer, ForeignKey("ngo_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    required_quantity_kg = Column(Float, default=50.0)
    food_categories = Column(JSON, default=list)  # list of FoodCategory values
    preferred_delivery_time_start = Column(String(10), nullable=True)
    preferred_delivery_time_end = Column(String(10), nullable=True)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    ngo = relationship("NGOProfile", back_populates="requirements")
