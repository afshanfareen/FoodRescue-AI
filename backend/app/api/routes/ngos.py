from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.ngo_profile import NGOProfile
from app.models.ngo_requirements import NGORequirement
from app.models.food_donation import FoodDonation, DonationStatus
from app.models.delivery import Delivery, DeliveryStatus
from app.ai.matching_service import haversine_distance
from app.services.audit_service import log_action
from app.schemas.profiles import NGOProfileUpdate, NGOProfileResponse, NGORequirementUpdate, NGORequirementResponse

router = APIRouter(prefix="/ngos", tags=["ngos"])


def _get_ngo_profile(user: User, db: Session) -> NGOProfile:
    profile = db.query(NGOProfile).filter(NGOProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="NGO profile not found")
    return profile


@router.get("/profile", response_model=NGOProfileResponse)
def get_ngo_profile(
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return _get_ngo_profile(current_user, db)


@router.put("/profile", response_model=NGOProfileResponse)
def update_ngo_profile(
    data: NGOProfileUpdate,
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    profile = _get_ngo_profile(current_user, db)
    for field, val in data.model_dump(exclude_none=True).items():
        setattr(profile, field, val)
    profile.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/requirements", response_model=Optional[NGORequirementResponse])
def get_requirements(
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    profile = _get_ngo_profile(current_user, db)
    req = db.query(NGORequirement).filter(NGORequirement.ngo_id == profile.id).first()
    return req


@router.put("/requirements", response_model=NGORequirementResponse)
def update_requirements(
    data: NGORequirementUpdate,
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    profile = _get_ngo_profile(current_user, db)
    req = db.query(NGORequirement).filter(NGORequirement.ngo_id == profile.id).first()
    if not req:
        req = NGORequirement(ngo_id=profile.id)
        db.add(req)

    for field, val in data.model_dump(exclude_none=True).items():
        setattr(req, field, val)
    req.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(req)
    return req


@router.get("/nearby")
def get_nearby_ngos(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_km: float = Query(25.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ngos = db.query(NGOProfile).filter(NGOProfile.is_approved == True).all()
    results = []
    for ngo in ngos:
        if ngo.latitude is None or ngo.longitude is None:
            continue
        dist = haversine_distance(lat, lon, ngo.latitude, ngo.longitude)
        if dist <= radius_km:
            results.append({
                "id": ngo.id,
                "name": ngo.user.name if ngo.user else "",
                "organization_name": ngo.organization_name,
                "latitude": ngo.latitude,
                "longitude": ngo.longitude,
                "address": ngo.address,
                "distance_km": round(dist, 2),
                "capacity_kg": ngo.capacity_kg,
                "beneficiary_count": ngo.beneficiary_count,
            })
    results.sort(key=lambda x: x["distance_km"])
    return results


@router.post("/{ngo_id}/accept-donation")
def accept_donation(
    ngo_id: int,
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    ngo = db.query(NGOProfile).filter(NGOProfile.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")

    if current_user.role == UserRole.NGO and ngo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    if donation.status not in (DonationStatus.DELIVERED,):
        raise HTTPException(status_code=400, detail="Donation must be delivered before NGO can confirm")

    donation.status = DonationStatus.COMPLETED
    donation.updated_at = datetime.now(timezone.utc)

    delivery = db.query(Delivery).filter(Delivery.donation_id == donation_id).first()
    if delivery:
        delivery.status = DeliveryStatus.COMPLETED
        # Update volunteer stats
        vol = delivery.volunteer
        if vol:
            vol.total_deliveries += 1
            from app.models.volunteer_profile import AvailabilityStatus as AS
            vol.availability_status = AS.AVAILABLE

    log_action(db, "NGO_CONFIRMED_RECEIPT", user_id=current_user.id, entity_type="donation", entity_id=donation.id)
    db.commit()
    return {"message": "Donation receipt confirmed. Thank you!"}


@router.get("/incoming-deliveries")
def get_incoming_deliveries(
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    profile = _get_ngo_profile(current_user, db)
    deliveries = db.query(Delivery).filter(Delivery.ngo_id == profile.id).order_by(Delivery.created_at.desc()).all()

    results = []
    for d in deliveries:
        donation = d.donation
        results.append({
            "delivery_id": d.id,
            "donation_id": d.donation_id,
            "food_name": donation.food_name if donation else None,
            "food_category": donation.food_category.value if donation else None,
            "quantity_kg": donation.quantity_kg if donation else None,
            "status": d.status.value,
            "assigned_at": d.assigned_at.isoformat() if d.assigned_at else None,
            "delivery_time": d.delivery_time.isoformat() if d.delivery_time else None,
        })
    return results


@router.get("/available-donations")
def get_available_donations_for_ngo(
    radius_km: float = Query(100.0, description="Search radius in km"),
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Return approved/matching donations within radius_km of this NGO."""
    profile = _get_ngo_profile(current_user, db)
    if profile.latitude is None or profile.longitude is None:
        raise HTTPException(status_code=400, detail="NGO location not set. Please update your profile with your address coordinates.")

    donations = db.query(FoodDonation).filter(
        FoodDonation.status.in_([DonationStatus.APPROVED, DonationStatus.MATCHING])
    ).all()

    results = []
    for d in donations:
        if d.latitude is None or d.longitude is None:
            continue
        distance = haversine_distance(profile.latitude, profile.longitude, d.latitude, d.longitude)
        if distance > radius_km:
            continue

        donor_name = None
        if d.donor and d.donor.user:
            donor_name = d.donor.user.name

        results.append({
            "id": d.id,
            "food_name": d.food_name,
            "food_category": d.food_category.value,
            "quantity_kg": d.quantity_kg,
            "estimated_meals": d.estimated_meals,
            "status": d.status.value,
            "quality_score": d.quality_score,
            "risk_level": d.risk_level.value if d.risk_level else None,
            "address": d.address,
            "latitude": d.latitude,
            "longitude": d.longitude,
            "distance_km": round(distance, 2),
            "cooked_at": d.cooked_at.isoformat() if d.cooked_at else None,
            "notes": d.notes,
            "donor_name": donor_name,
        })

    results.sort(key=lambda x: x["distance_km"])
    return results


@router.post("/{ngo_id}/accept-donation-offer")
def accept_donation_offer(
    ngo_id: int,
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """NGO proactively accepts an available donation (APPROVED/MATCHING)."""
    ngo = db.query(NGOProfile).filter(NGOProfile.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")
    if current_user.role == UserRole.NGO and ngo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status not in (DonationStatus.APPROVED, DonationStatus.MATCHING):
        raise HTTPException(status_code=400, detail=f"Donation is not available (status: {donation.status.value})")

    # Mark donation as matching/assigned to this NGO
    donation.status = DonationStatus.MATCHING
    donation.assigned_ngo_id = ngo_id
    donation.updated_at = datetime.now(timezone.utc)

    log_action(db, "NGO_ACCEPTED_DONATION", user_id=current_user.id, entity_type="donation", entity_id=donation_id)

    # Notify the donor
    from app.services.notification_service import notify_ngo_donation_accepted
    if donation.donor and donation.donor.user:
        notify_ngo_donation_accepted(
            db, donation.donor.user_id,
            ngo.organization_name or current_user.name,
            donation_id, donation.food_name
        )

    db.commit()
    return {"message": f"You have accepted the donation of '{donation.food_name}'. A volunteer will be assigned shortly."}


@router.post("/{ngo_id}/reject-donation-offer")
def reject_donation_offer(
    ngo_id: int,
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.NGO, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """NGO declines a donation offer (it stays available for other NGOs)."""
    ngo = db.query(NGOProfile).filter(NGOProfile.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")
    if current_user.role == UserRole.NGO and ngo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")

    log_action(db, "NGO_REJECTED_DONATION", user_id=current_user.id, entity_type="donation", entity_id=donation_id)
    db.commit()
    return {"message": "Donation declined. It remains available for other NGOs."}
