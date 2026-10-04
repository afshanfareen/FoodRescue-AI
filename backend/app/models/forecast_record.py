from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, Float, DateTime, Date, String, Boolean, ForeignKey
from app.core.database import Base


class ForecastRecord(Base):
    __tablename__ = "forecast_records"

    id = Column(Integer, primary_key=True, index=True)
    forecast_date = Column(Date, nullable=False, index=True)
    predicted_surplus_kg = Column(Float, nullable=False)
    actual_surplus_kg = Column(Float, nullable=True)
    model_name = Column(String(100), nullable=True)
    model_version = Column(String(50), nullable=True)
    confidence_interval_low = Column(Float, nullable=True)
    confidence_interval_high = Column(Float, nullable=True)
    is_demo_data = Column(Boolean, default=False)  # Clearly marks generated/demo data
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
