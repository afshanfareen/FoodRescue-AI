from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import generate_otp, hash_otp, verify_otp
from app.models.user import User, UserRole
from app.models.volunteer_profile import VolunteerProfile, AvailabilityStatus
from app.models.food_donation import FoodDonation, DonationStatus, is_valid_transition
from app.models.delivery import Delivery, DeliveryStatus
from app.models.otp_verification import OTPVerification, OTPType
from app.models.matching_record import MatchingRecord
from app.ai.matching_service import find_matching_volunteers, VolunteerCandidate, haversine_distance
from app.services.notification_service import notify_volunteer_assigned, notify_pickup_completed, notify_delivery_completed
from app.services.audit_service import log_action
from app.schemas.profiles import VolunteerProfileUpdate, VolunteerProfileResponse

router = APIRouter(prefix="/volunteers", tags=["volunteers"])

MAX_OTP_ATTEMPTS = 5
OTP_EXPIRY_MINUTES = 15


def _get_volunteer_profile(user: User, db: Session) -> VolunteerProfile:
    profile = db.query(VolunteerProfile).filter(VolunteerProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Volunteer profile not found")
    return profile


@router.get("/profile", response_model=VolunteerProfileResponse)
def get_my_profile(
    current_user: User = Depends(require_role(UserRole.VOLUNTEER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return _get_volunteer_profile(current_user, db)


@router.put("/profile", response_model=VolunteerProfileResponse)
def update_profile(
    data: VolunteerProfileUpdate,
    current_user: User = Depends(require_role(UserRole.VOLUNTEER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    profile = _get_volunteer_profile(current_user, db)
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(profile, field, val)
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/location")
def update_location(
    latitude: float,
    longitude: float,
    current_user: User = Depends(require_role(UserRole.VOLUNTEER)),
    db: Session = Depends(get_db),
):
    profile = _get_volunteer_profile(current_user, db)
    profile.current_latitude = latitude
    profile.current_longitude = longitude
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Location updated", "latitude": latitude, "longitude": longitude}


@router.put("/availability")
def update_availability(
    availability_status: str,
    current_user: User = Depends(require_role(UserRole.VOLUNTEER)),
    db: Session = Depends(get_db),
):
    try:
        avail = AvailabilityStatus(availability_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid availability status")

    profile = _get_volunteer_profile(current_user, db)
    profile.availability_status = avail
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Availability updated", "status": avail.value}


@router.get("/nearby")
def get_nearby_rescues(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(25.0),
    current_user: User = Depends(require_role(UserRole.VOLUNTEER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Get nearby donations available for rescue."""
    donations = db.query(FoodDonation).filter(
        FoodDonation.status.in_([DonationStatus.APPROVED, DonationStatus.MATCHING])
    ).all()

    results = []
    for d in donations:
        if d.latitude is None or d.longitude is None:
            continue
        dist = haversine_distance(lat, lon, d.latitude, d.longitude)
        if dist <= radius_km:
            results.append({
                "id": d.id,
                "food_name": d.food_name,
                "food_category": d.food_category.value,
                "quantity_kg": d.quantity_kg,
                "estimated_meals": d.estimated_meals,
                "distance_km": round(dist, 2),
                "latitude": d.latitude,
                "longitude": d.longitude,
                "address": d.address,
                "status": d.status.value,
                "quality_score": d.quality_score,
                "risk_level": d.risk_level.value if d.risk_level else None,
                "created_at": d.created_at.isoformat(),
            })

    results.sort(key=lambda x: x["distance_km"])
    return results


@router.post("/{volunteer_id}/accept")
def accept_rescue(
    volunteer_id: int,
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.VOLUNTEER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Accept a rescue assignment. Uses transaction to prevent race conditions."""
    profile = db.query(VolunteerProfile).filter(VolunteerProfile.id == volunteer_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    # Authorization: volunteer can only accept for themselves
    if current_user.role == UserRole.VOLUNTEER and profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Use SELECT FOR UPDATE to prevent race conditions
    donation = db.query(FoodDonation).filter(
        FoodDonation.id == donation_id
    ).with_for_update().first()

    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    if donation.status not in (DonationStatus.APPROVED, DonationStatus.MATCHING, DonationStatus.VOLUNTEER_ASSIGNED):
        raise HTTPException(status_code=409, detail=f"Donation already assigned or not available. Status: {donation.status.value}")

    # Find best NGO for this donation
    from app.models.ngo_profile import NGOProfile
    from app.ai.matching_service import find_matching_ngos, NGOCandidate
    from app.models.ngo_requirements import NGORequirement

    ngos = db.query(NGOProfile).filter(NGOProfile.is_approved == True).all()
    ngo_candidates = []
    for ngo in ngos:
        req = db.query(NGORequirement).filter(NGORequirement.ngo_id == ngo.id).first()
        req_qty = req.required_quantity_kg if req else 50.0
        food_cats = req.food_categories if req else []
        ngo_user = ngo.user
        ngo_candidates.append(NGOCandidate(
            ngo_id=ngo.id,
            user_id=ngo.user_id,
            name=ngo_user.name if ngo_user else "NGO",
            latitude=ngo.latitude,
            longitude=ngo.longitude,
            capacity_kg=ngo.capacity_kg,
            beneficiary_count=ngo.beneficiary_count,
            required_quantity_kg=req_qty,
            food_categories=food_cats or [],
        ))

    ngo_matches = find_matching_ngos(
        donation.latitude or 0, donation.longitude or 0,
        donation.quantity_kg,
        donation.food_category.value,
        ngo_candidates,
    )

    if not ngo_matches:
        raise HTTPException(status_code=404, detail="No suitable NGO found for this donation")

    best_ngo = ngo_matches[0]

    # Create delivery record
    delivery = Delivery(
        donation_id=donation.id,
        volunteer_id=volunteer_id,
        ngo_id=best_ngo.ngo_id,
        distance_km=best_ngo.distance_km,
        estimated_time_minutes=best_ngo.distance_km / 25.0 * 60,
        status=DeliveryStatus.ACCEPTED,
        accepted_at=datetime.now(timezone.utc),
    )
    db.add(delivery)
    db.flush()

    donation.status = DonationStatus.VOLUNTEER_ASSIGNED
    profile.availability_status = AvailabilityStatus.BUSY

    # Generate pickup OTP
    otp = generate_otp()
    otp_record = OTPVerification(
        delivery_id=delivery.id,
        otp_type=OTPType.PICKUP,
        otp_hash=hash_otp(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES),
    )
    db.add(otp_record)

    log_action(db, "VOLUNTEER_ACCEPTED_RESCUE", user_id=current_user.id,
               entity_type="delivery", entity_id=delivery.id)
    db.commit()

    return {
        "message": "Rescue accepted successfully",
        "delivery_id": delivery.id,
        "donation_id": donation.id,
        "ngo_id": best_ngo.ngo_id,
        "pickup_otp": otp,
        "otp_expires_at": otp_record.expires_at.isoformat(),
        "disclaimer": "Share pickup OTP with the donor to confirm collection",
    }


@router.post("/deliveries/{delivery_id}/verify-pickup")
def verify_pickup_otp(
    delivery_id: int,
    otp: str,
    current_user: User = Depends(require_role(UserRole.VOLUNTEER)),
    db: Session = Depends(get_db),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    profile = _get_volunteer_profile(current_user, db)
    if delivery.volunteer_id != profile.id:
        raise HTTPException(status_code=403, detail="Access denied")

    otp_record = db.query(OTPVerification).filter(
        OTPVerification.delivery_id == delivery_id,
        OTPVerification.otp_type == OTPType.PICKUP,
        OTPVerification.is_used == False,
    ).first()

    if not otp_record:
        raise HTTPException(status_code=404, detail="No active pickup OTP found")

    now = datetime.now(timezone.utc)
    if otp_record.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="OTP has expired")

    if otp_record.attempt_count >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Maximum OTP attempts exceeded")

    otp_record.attempt_count += 1

    if not verify_otp(otp, otp_record.otp_hash):
        db.commit()
        remaining = MAX_OTP_ATTEMPTS - otp_record.attempt_count
        raise HTTPException(status_code=400, detail=f"Invalid OTP. {remaining} attempts remaining")

    otp_record.is_used = True
    otp_record.verified_at = now
    delivery.pickup_verified = True
    delivery.pickup_time = now
    delivery.status = DeliveryStatus.PICKED_UP

    # Update donation status
    donation = delivery.donation
    donation.status = DonationStatus.PICKED_UP
    donation.updated_at = now

    # Generate delivery OTP
    delivery_otp = generate_otp()
    delivery_otp_record = OTPVerification(
        delivery_id=delivery.id,
        otp_type=OTPType.DELIVERY,
        otp_hash=hash_otp(delivery_otp),
        expires_at=now + timedelta(hours=4),  # Longer for delivery
    )
    db.add(delivery_otp_record)

    notify_pickup_completed(db, donation.donor.user_id if donation.donor else current_user.id, delivery.id)
    log_action(db, "PICKUP_VERIFIED", user_id=current_user.id, entity_type="delivery", entity_id=delivery.id)
    db.commit()

    return {
        "message": "Pickup verified successfully",
        "delivery_otp": delivery_otp,
        "delivery_otp_expires_at": delivery_otp_record.expires_at.isoformat(),
        "next_step": "Proceed to NGO and verify delivery with the delivery OTP",
    }


@router.post("/deliveries/{delivery_id}/start-delivery")
def start_delivery(
    delivery_id: int,
    current_user: User = Depends(require_role(UserRole.VOLUNTEER)),
    db: Session = Depends(get_db),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    profile = _get_volunteer_profile(current_user, db)
    if delivery.volunteer_id != profile.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if delivery.status != DeliveryStatus.PICKED_UP:
        raise HTTPException(status_code=400, detail="Pickup must be verified before starting delivery")

    delivery.status = DeliveryStatus.DELIVERY_IN_PROGRESS
    donation = delivery.donation
    donation.status = DonationStatus.DELIVERY_IN_PROGRESS
    donation.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Delivery started"}


@router.post("/deliveries/{delivery_id}/verify-delivery")
def verify_delivery_otp(
    delivery_id: int,
    otp: str,
    current_user: User = Depends(require_role(UserRole.VOLUNTEER)),
    db: Session = Depends(get_db),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    profile = _get_volunteer_profile(current_user, db)
    if delivery.volunteer_id != profile.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if delivery.status != DeliveryStatus.DELIVERY_IN_PROGRESS:
        raise HTTPException(status_code=400, detail="Delivery must be in progress to verify")

    otp_record = db.query(OTPVerification).filter(
        OTPVerification.delivery_id == delivery_id,
        OTPVerification.otp_type == OTPType.DELIVERY,
        OTPVerification.is_used == False,
    ).first()

    if not otp_record:
        raise HTTPException(status_code=404, detail="No active delivery OTP found")

    now = datetime.now(timezone.utc)
    if otp_record.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=400, detail="OTP has expired")

    if otp_record.attempt_count >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Maximum OTP attempts exceeded")

    otp_record.attempt_count += 1
    if not verify_otp(otp, otp_record.otp_hash):
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")

    otp_record.is_used = True
    otp_record.verified_at = now
    delivery.delivery_verified = True
    delivery.delivery_time = now
    delivery.status = DeliveryStatus.DELIVERED

    donation = delivery.donation
    donation.status = DonationStatus.DELIVERED
    donation.updated_at = now

    notify_delivery_completed(db, donation.donor.user_id if donation.donor else current_user.id, delivery.id)
    log_action(db, "DELIVERY_VERIFIED", user_id=current_user.id, entity_type="delivery", entity_id=delivery.id)
    db.commit()

    return {"message": "Delivery verified. Please upload proof of delivery."}


@router.get("/my-deliveries")
def get_my_deliveries(
    current_user: User = Depends(require_role(UserRole.VOLUNTEER)),
    db: Session = Depends(get_db),
):
    profile = _get_volunteer_profile(current_user, db)
    deliveries = db.query(Delivery).filter(Delivery.volunteer_id == profile.id).order_by(Delivery.created_at.desc()).all()
    return [_delivery_dict(d) for d in deliveries]


def _delivery_dict(d: Delivery) -> dict:
    return {
        "id": d.id,
        "donation_id": d.donation_id,
        "volunteer_id": d.volunteer_id,
        "ngo_id": d.ngo_id,
        "assigned_at": d.assigned_at.isoformat() if d.assigned_at else None,
        "accepted_at": d.accepted_at.isoformat() if d.accepted_at else None,
        "pickup_time": d.pickup_time.isoformat() if d.pickup_time else None,
        "delivery_time": d.delivery_time.isoformat() if d.delivery_time else None,
        "distance_km": d.distance_km,
        "estimated_time_minutes": d.estimated_time_minutes,
        "pickup_verified": d.pickup_verified,
        "delivery_verified": d.delivery_verified,
        "status": d.status.value,
    }
