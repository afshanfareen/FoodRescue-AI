from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class NotificationType(str, enum.Enum):
    DONATION_CREATED = "DONATION_CREATED"
    QUALITY_RESULT = "QUALITY_RESULT"
    DONATION_APPROVED = "DONATION_APPROVED"
    DONATION_REJECTED = "DONATION_REJECTED"
    VOLUNTEER_ASSIGNED = "VOLUNTEER_ASSIGNED"
    VOLUNTEER_ACCEPTED = "VOLUNTEER_ACCEPTED"
    PICKUP_STARTED = "PICKUP_STARTED"
    PICKUP_COMPLETED = "PICKUP_COMPLETED"
    DELIVERY_STARTED = "DELIVERY_STARTED"
    DELIVERY_COMPLETED = "DELIVERY_COMPLETED"
    NO_VOLUNTEER_FOUND = "NO_VOLUNTEER_FOUND"
    GENERAL = "GENERAL"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(String(1000), nullable=False)
    is_read = Column(Boolean, default=False)
    reference_id = Column(Integer, nullable=True)  # donation_id or delivery_id
    reference_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="notifications")
