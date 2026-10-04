from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User, UserRole
from app.models.donor_profile import DonorProfile
from app.schemas.profiles import DonorProfileUpdate, DonorProfileResponse

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/donor", response_model=DonorProfileResponse)
def get_donor_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    return profile


@router.put("/donor", response_model=DonorProfileResponse)
def update_donor_profile(
    data: DonorProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(profile, field, val)
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile
