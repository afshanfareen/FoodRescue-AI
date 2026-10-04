import os
import shutil
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.food_donation import FoodDonation, DonationStatus, FoodCategory, RiskLevel, is_valid_transition
from app.models.food_image import FoodImage
from app.models.quality_assessment import QualityAssessment
from app.models.donor_profile import DonorProfile
from app.schemas.donation import DonationCreate, DonationUpdate, DonationResponse
from app.services.notification_service import notify_donation_created, notify_quality_result, notify_donation_approved, notify_donation_rejected
from app.services.audit_service import log_action
from app.ai.quality_screening import run_quality_screening

router = APIRouter(prefix="/donations", tags=["donations"])


def get_donor_profile(user: User, db: Session) -> DonorProfile:
    profile = db.query(DonorProfile).filter(DonorProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    return profile


@router.post("", response_model=DonationResponse, status_code=201)
def create_donation(
    food_name: str = Form(...),
    food_category: str = Form(...),
    quantity_kg: float = Form(...),
    estimated_meals: Optional[int] = Form(None),
    cooked_at: str = Form(...),
    temperature_c: Optional[float] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    address: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_role(UserRole.DONOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    # Parse and validate
    try:
        category = FoodCategory(food_category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid food category: {food_category}")
    try:
        cooked_dt = datetime.fromisoformat(cooked_at)
        if cooked_dt.tzinfo is None:
            cooked_dt = cooked_dt.replace(tzinfo=timezone.utc)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid cooked_at datetime format")

    if quantity_kg <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    donor_profile = get_donor_profile(current_user, db)

    donation = FoodDonation(
        donor_id=donor_profile.id,
        food_name=food_name,
        food_category=category,
        quantity_kg=quantity_kg,
        estimated_meals=estimated_meals,
        cooked_at=cooked_dt,
        temperature_c=temperature_c,
        latitude=latitude,
        longitude=longitude,
        address=address,
        notes=notes,
        status=DonationStatus.CREATED,
    )
    db.add(donation)
    db.flush()

    # Handle image upload
    image_path = None
    if image and image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            raise HTTPException(status_code=400, detail="Invalid image format")
        upload_dir = os.path.join(settings.UPLOAD_DIR, "food_images")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"donation_{donation.id}_{int(datetime.now().timestamp())}{ext}"
        image_path = os.path.join(upload_dir, filename)
        with open(image_path, "wb") as f:
            shutil.copyfileobj(image.file, f)

        food_img = FoodImage(
            donation_id=donation.id,
            image_path=image_path,
            image_url=f"/uploads/food_images/{filename}",
            uploaded_by=current_user.id,
        )
        db.add(food_img)

    db.commit()
    db.refresh(donation)

    notify_donation_created(db, current_user.id, donation.id, food_name)
    log_action(db, "DONATION_CREATED", user_id=current_user.id, entity_type="donation", entity_id=donation.id)
    db.commit()

    return _build_response(donation)


@router.get("", response_model=List[DonationResponse])
def list_donations(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(FoodDonation).options(
        joinedload(FoodDonation.quality_assessment),
        joinedload(FoodDonation.images),
    )

    if current_user.role == UserRole.DONOR:
        profile = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
        if profile:
            q = q.filter(FoodDonation.donor_id == profile.id)
        else:
            return []
    elif current_user.role == UserRole.VOLUNTEER:
        # Volunteers see approved+ donations
        q = q.filter(FoodDonation.status.in_([
            DonationStatus.APPROVED, DonationStatus.MATCHING,
            DonationStatus.VOLUNTEER_ASSIGNED, DonationStatus.PICKUP_IN_PROGRESS,
        ]))
    elif current_user.role == UserRole.NGO:
        q = q.filter(FoodDonation.status.in_([
            DonationStatus.APPROVED, DonationStatus.MATCHING,
            DonationStatus.VOLUNTEER_ASSIGNED, DonationStatus.PICKUP_IN_PROGRESS,
            DonationStatus.PICKED_UP, DonationStatus.DELIVERY_IN_PROGRESS,
        ]))
    # Admin sees all

    if status:
        try:
            s = DonationStatus(status)
            q = q.filter(FoodDonation.status == s)
        except ValueError:
            pass

    donations = q.order_by(FoodDonation.created_at.desc()).offset(skip).limit(limit).all()
    return [_build_response(d) for d in donations]


@router.get("/{donation_id}", response_model=DonationResponse)
def get_donation(
    donation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    donation = db.query(FoodDonation).options(
        joinedload(FoodDonation.quality_assessment),
        joinedload(FoodDonation.images),
    ).filter(FoodDonation.id == donation_id).first()

    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    # Authorization
    if current_user.role == UserRole.DONOR:
        profile = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
        if not profile or donation.donor_id != profile.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return _build_response(donation)


@router.put("/{donation_id}", response_model=DonationResponse)
def update_donation(
    donation_id: int,
    data: DonationUpdate,
    current_user: User = Depends(require_role(UserRole.DONOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    if current_user.role == UserRole.DONOR:
        profile = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
        if not profile or donation.donor_id != profile.id:
            raise HTTPException(status_code=403, detail="Access denied")

    if donation.status not in (DonationStatus.CREATED, DonationStatus.QUALITY_CHECK):
        raise HTTPException(status_code=400, detail="Cannot update donation in current status")

    for field, val in data.model_dump(exclude_none=True).items():
        setattr(donation, field, val)

    donation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(donation)
    return _build_response(donation)


@router.delete("/{donation_id}", status_code=204)
def cancel_donation(
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.DONOR, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    if current_user.role == UserRole.DONOR:
        profile = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
        if not profile or donation.donor_id != profile.id:
            raise HTTPException(status_code=403, detail="Access denied")

    if not is_valid_transition(donation.status, DonationStatus.CANCELLED):
        raise HTTPException(status_code=400, detail=f"Cannot cancel donation in status {donation.status}")

    donation.status = DonationStatus.CANCELLED
    donation.updated_at = datetime.now(timezone.utc)
    log_action(db, "DONATION_CANCELLED", user_id=current_user.id, entity_type="donation", entity_id=donation.id)
    db.commit()


@router.post("/{donation_id}/quality-check", response_model=DonationResponse)
def run_quality_check(
    donation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    donation = db.query(FoodDonation).options(
        joinedload(FoodDonation.images)
    ).filter(FoodDonation.id == donation_id).first()

    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    # Auth: donor can check own; admin can check any
    if current_user.role == UserRole.DONOR:
        profile = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
        if not profile or donation.donor_id != profile.id:
            raise HTTPException(status_code=403, detail="Access denied")

    if donation.status not in (DonationStatus.CREATED, DonationStatus.QUALITY_CHECK):
        raise HTTPException(status_code=400, detail="Quality check already completed or donation not in valid state")

    # Get image path if available
    image_path = None
    if donation.images:
        image_path = donation.images[0].image_path

    # Run AI quality screening
    donation.status = DonationStatus.QUALITY_CHECK
    result = run_quality_screening(
        food_category=donation.food_category.value,
        cooked_at=donation.cooked_at,
        temperature_c=donation.temperature_c,
        image_path=image_path,
    )

    # Save assessment
    existing_qa = db.query(QualityAssessment).filter(QualityAssessment.donation_id == donation.id).first()
    if existing_qa:
        qa = existing_qa
    else:
        qa = QualityAssessment(donation_id=donation.id)
        db.add(qa)

    qa.image_score = result["image_score"]
    qa.temperature_score = result["temperature_score"]
    qa.time_score = result["time_score"]
    qa.food_type_score = result["food_type_score"]
    qa.overall_quality_score = result["quality_score"]
    qa.risk_level = RiskLevel(result["risk_level"])
    qa.model_name = result["model_name"]
    qa.model_version = result["model_version"]
    qa.confidence = result.get("confidence")
    qa.assessment_notes = result.get("disclaimer")

    # Update donation
    donation.quality_score = result["quality_score"]
    donation.risk_level = RiskLevel(result["risk_level"])
    donation.quality_status = result["quality_status"]

    if result["quality_status"] == "APPROVED":
        donation.status = DonationStatus.APPROVED
        # Estimate expiry
        from app.ai.quality_screening import MAX_SAFE_HOURS_BY_CATEGORY
        max_h = MAX_SAFE_HOURS_BY_CATEGORY.get(donation.food_category.value, 5)
        donation.expiry_estimate = donation.cooked_at + timedelta(hours=max_h)
        notify_donation_approved(db, current_user.id, donation.id)
    else:
        donation.status = DonationStatus.REJECTED
        notify_donation_rejected(db, current_user.id, donation.id,
                                  f"Quality score: {result['quality_score']:.1f}, Risk: {result['risk_level']}")

    notify_quality_result(db, current_user.id, donation.id, result["risk_level"], result["quality_status"])
    log_action(db, "QUALITY_CHECK_RUN", user_id=current_user.id, entity_type="donation", entity_id=donation.id,
               new_values={"risk_level": result["risk_level"], "quality_score": result["quality_score"]})

    db.commit()
    db.refresh(donation)
    return _build_response(donation)


def _build_response(donation: FoodDonation) -> dict:
    images = []
    if donation.images:
        for img in donation.images:
            images.append({"id": img.id, "image_url": img.image_url, "image_path": img.image_path})

    qa = None
    if donation.quality_assessment:
        q = donation.quality_assessment
        qa = {
            "id": q.id,
            "image_score": q.image_score,
            "temperature_score": q.temperature_score,
            "time_score": q.time_score,
            "food_type_score": q.food_type_score,
            "overall_quality_score": q.overall_quality_score,
            "risk_level": q.risk_level.value if q.risk_level else None,
            "model_name": q.model_name,
            "model_version": q.model_version,
            "confidence": q.confidence,
            "assessment_notes": q.assessment_notes,
            "assessment_timestamp": q.assessment_timestamp.isoformat() if q.assessment_timestamp else None,
        }

    return {
        "id": donation.id,
        "donor_id": donation.donor_id,
        "food_name": donation.food_name,
        "food_category": donation.food_category.value,
        "quantity_kg": donation.quantity_kg,
        "estimated_meals": donation.estimated_meals,
        "cooked_at": donation.cooked_at.isoformat() if donation.cooked_at else None,
        "reported_at": donation.reported_at.isoformat() if donation.reported_at else None,
        "temperature_c": donation.temperature_c,
        "latitude": donation.latitude,
        "longitude": donation.longitude,
        "address": donation.address,
        "quality_score": donation.quality_score,
        "risk_level": donation.risk_level.value if donation.risk_level else None,
        "quality_status": donation.quality_status,
        "expiry_estimate": donation.expiry_estimate.isoformat() if donation.expiry_estimate else None,
        "status": donation.status.value,
        "notes": donation.notes,
        "created_at": donation.created_at.isoformat() if donation.created_at else None,
        "updated_at": donation.updated_at.isoformat() if donation.updated_at else None,
        "quality_assessment": qa,
        "images": images,
    }
