import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Enum, Float, DateTime, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    DONOR = "DONOR"
    VOLUNTEER = "VOLUNTEER"
    NGO = "NGO"


class UserStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    PENDING = "PENDING"
    SUSPENDED = "SUSPENDED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    donor_profile = relationship("DonorProfile", back_populates="user", uselist=False)
    volunteer_profile = relationship("VolunteerProfile", back_populates="user", uselist=False)
    ngo_profile = relationship("NGOProfile", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")

    __table_args__ = (Index("ix_users_role_status", "role", "status"),)
