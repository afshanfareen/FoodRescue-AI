from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User, UserRole, UserStatus
from app.models.food_donation import FoodDonation, DonationStatus
from app.models.delivery import Delivery, DeliveryStatus
from app.models.volunteer_profile import VolunteerProfile, AvailabilityStatus
from app.models.ngo_profile import NGOProfile, VerificationStatus as NGOVerificationStatus
from app.models.donor_profile import DonorProfile
from app.models.audit_log import AuditLog
from app.models.matching_record import MatchingRecord
from app.ai.matching_service import (
    find_matching_volunteers, VolunteerCandidate,
    find_matching_ngos, NGOCandidate
)
from app.models.ngo_requirements import NGORequirement
from app.services.notification_service import notify_volunteer_rescue_request
from app.services.audit_service import log_action

router = APIRouter(prefix="/admin", tags=["admin"])
admin_dep = Depends(require_role(UserRole.ADMIN))


@router.get("/dashboard")
def get_dashboard(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    total_donations = db.query(FoodDonation).count()
    completed = db.query(FoodDonation).filter(FoodDonation.status == DonationStatus.COMPLETED).count()
    active_rescues = db.query(FoodDonation).filter(
        FoodDonation.status.in_([
            DonationStatus.VOLUNTEER_ASSIGNED, DonationStatus.PICKUP_IN_PROGRESS,
            DonationStatus.PICKED_UP, DonationStatus.DELIVERY_IN_PROGRESS,
        ])
    ).count()
    pending_approvals_vol = db.query(VolunteerProfile).filter(VolunteerProfile.is_approved == False).count()
    pending_approvals_ngo = db.query(NGOProfile).filter(NGOProfile.is_approved == False).count()
    active_volunteers = db.query(VolunteerProfile).filter(
        VolunteerProfile.availability_status == AvailabilityStatus.AVAILABLE
    ).count()
    registered_ngos = db.query(NGOProfile).filter(NGOProfile.is_approved == True).count()
    total_users = db.query(User).count()

    # Food rescued (sum of completed donations)
    food_rescued = db.query(func.sum(FoodDonation.quantity_kg)).filter(
        FoodDonation.status == DonationStatus.COMPLETED
    ).scalar() or 0.0

    estimated_meals = db.query(func.sum(FoodDonation.estimated_meals)).filter(
        FoodDonation.status == DonationStatus.COMPLETED
    ).scalar() or 0

    return {
        "total_donations": total_donations,
        "completed_rescues": completed,
        "active_rescues": active_rescues,
        "food_rescued_kg": round(food_rescued, 2),
        "estimated_meals": estimated_meals,
        "pending_approvals": pending_approvals_vol + pending_approvals_ngo,
        "active_volunteers": active_volunteers,
        "registered_ngos": registered_ngos,
        "total_users": total_users,
    }


@router.get("/users")
def get_all_users(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if role:
        try:
            q = q.filter(User.role == UserRole(role))
        except ValueError:
            pass
    if status:
        try:
            q = q.filter(User.status == UserStatus(status))
        except ValueError:
            pass
    users = q.offset(skip).limit(limit).all()
    result = []
    for u in users:
        is_approved = None
        if u.role == UserRole.VOLUNTEER and u.volunteer_profile:
            is_approved = u.volunteer_profile.is_approved
        elif u.role == UserRole.NGO and u.ngo_profile:
            is_approved = u.ngo_profile.is_approved
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role.value,
            "status": u.status.value,
            "is_approved": is_approved,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })
    return result


@router.put("/users/{user_id}/status")
def update_user_status(
    user_id: int,
    new_status: str,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent suspending admin accounts
    if user.role == UserRole.ADMIN and new_status == "SUSPENDED":
        raise HTTPException(status_code=403, detail="Admin accounts cannot be suspended.")
    try:
        user.status = UserStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    user.updated_at = datetime.now(timezone.utc)
    log_action(db, "USER_STATUS_CHANGED", user_id=current_user.id,
               entity_type="user", entity_id=user_id,
               new_values={"status": new_status})
    db.commit()
    return {"message": f"User status updated to {new_status}"}


@router.put("/volunteers/{profile_id}/approve")
def approve_volunteer(
    profile_id: int,
    approved: bool = True,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    # Accept either VolunteerProfile.id or User.id
    profile = db.query(VolunteerProfile).filter(VolunteerProfile.id == profile_id).first()
    if not profile:
        profile = db.query(VolunteerProfile).filter(VolunteerProfile.user_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Volunteer profile not found")
    profile.is_approved = approved
    profile.updated_at = datetime.now(timezone.utc)
    log_action(db, "VOLUNTEER_APPROVED" if approved else "VOLUNTEER_REJECTED",
               user_id=current_user.id, entity_type="volunteer_profile", entity_id=profile.id)
    db.commit()
    return {"message": f"Volunteer {'approved' if approved else 'rejected'}"}


@router.put("/ngos/{profile_id}/approve")
def approve_ngo(
    profile_id: int,
    approved: bool = True,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    # Accept either NGOProfile.id or User.id
    profile = db.query(NGOProfile).filter(NGOProfile.id == profile_id).first()
    if not profile:
        profile = db.query(NGOProfile).filter(NGOProfile.user_id == profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="NGO profile not found")
    profile.is_approved = approved
    profile.verification_status = NGOVerificationStatus.VERIFIED if approved else NGOVerificationStatus.REJECTED
    profile.updated_at = datetime.now(timezone.utc)
    log_action(db, "NGO_APPROVED" if approved else "NGO_REJECTED",
               user_id=current_user.id, entity_type="ngo_profile", entity_id=profile.id)
    db.commit()
    return {"message": f"NGO {'approved' if approved else 'rejected'}"}


@router.get("/donations")
def get_all_donations(
    status: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    q = db.query(FoodDonation)
    if status:
        try:
            q = q.filter(FoodDonation.status == DonationStatus(status))
        except ValueError:
            pass
    donations = q.order_by(FoodDonation.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": d.id,
            "food_name": d.food_name,
            "food_category": d.food_category.value,
            "quantity_kg": d.quantity_kg,
            "status": d.status.value,
            "risk_level": d.risk_level.value if d.risk_level else None,
            "quality_score": d.quality_score,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "donor_id": d.donor_id,
        }
        for d in donations
    ]


@router.get("/deliveries")
def get_all_deliveries(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    deliveries = db.query(Delivery).order_by(Delivery.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": d.id,
            "donation_id": d.donation_id,
            "volunteer_id": d.volunteer_id,
            "ngo_id": d.ngo_id,
            "status": d.status.value,
            "distance_km": d.distance_km,
            "pickup_verified": d.pickup_verified,
            "delivery_verified": d.delivery_verified,
            "assigned_at": d.assigned_at.isoformat() if d.assigned_at else None,
            "delivery_time": d.delivery_time.isoformat() if d.delivery_time else None,
        }
        for d in deliveries
    ]


@router.post("/donations/{donation_id}/trigger-matching")
def trigger_matching(
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Admin-triggered matching for an approved donation."""
    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status not in (DonationStatus.APPROVED, DonationStatus.MATCHING):
        raise HTTPException(status_code=400, detail="Donation must be APPROVED for matching")
    if donation.latitude is None:
        raise HTTPException(status_code=400, detail="Donation has no location set")

    donation.status = DonationStatus.MATCHING
    db.commit()

    # Get available volunteers
    vol_profiles = db.query(VolunteerProfile).filter(
        VolunteerProfile.availability_status == AvailabilityStatus.AVAILABLE,
        VolunteerProfile.is_approved == True,
    ).all()

    candidates = []
    for vp in vol_profiles:
        user = vp.user
        candidates.append(VolunteerCandidate(
            volunteer_id=vp.id,
            user_id=vp.user_id,
            name=user.name if user else "Volunteer",
            vehicle_type=vp.vehicle_type.value if vp.vehicle_type else "MOTORCYCLE",
            vehicle_capacity_kg=vp.vehicle_capacity_kg,
            current_latitude=vp.current_latitude,
            current_longitude=vp.current_longitude,
            rating=vp.rating,
            total_deliveries=vp.total_deliveries,
            availability_status=vp.availability_status.value,
        ))

    matches = find_matching_volunteers(
        donation.latitude, donation.longitude,
        donation.quantity_kg, candidates,
    )

    # Save matching records
    for match in matches:
        mr = MatchingRecord(
            donation_id=donation.id,
            volunteer_id=match.volunteer_id,
            matching_score=match.matching_score,
            distance_km=match.distance_km,
            score_breakdown=match.score_breakdown,
            status="SUGGESTED",
        )
        db.add(mr)
        # Notify volunteer
        notify_volunteer_rescue_request(
            db, match.user_id, donation.id,
            donation.food_name, match.distance_km
        )

    db.commit()
    return {
        "message": f"Matching complete. {len(matches)} volunteer(s) notified.",
        "matches": [
            {
                "volunteer_id": m.volunteer_id,
                "name": m.name,
                "distance_km": m.distance_km,
                "matching_score": m.matching_score,
                "vehicle_type": m.vehicle_type,
                "estimated_time_minutes": m.estimated_time_minutes,
            }
            for m in matches
        ],
    }


@router.get("/analytics")
def get_analytics(
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    completed = db.query(FoodDonation).filter(FoodDonation.status == DonationStatus.COMPLETED).all()
    total_kg = sum(d.quantity_kg for d in completed)
    total_meals = sum(d.estimated_meals or int(d.quantity_kg * 2.5) for d in completed)
    total_rescues = len(completed)

    # Avg pickup/delivery times
    completed_deliveries = db.query(Delivery).filter(Delivery.status == DeliveryStatus.COMPLETED).all()
    pickup_times = [
        (d.pickup_time - d.accepted_at).total_seconds() / 60
        for d in completed_deliveries
        if d.pickup_time and d.accepted_at
    ]
    delivery_times = [
        (d.delivery_time - d.pickup_time).total_seconds() / 60
        for d in completed_deliveries
        if d.delivery_time and d.pickup_time
    ]
    distances = [d.distance_km for d in completed_deliveries if d.distance_km]

    total_donations = db.query(FoodDonation).count()
    success_rate = (total_rescues / total_donations * 100) if total_donations > 0 else 0

    # Estimated CO2 saved: ~2.5 kg CO2e per kg of food rescued (configurable estimate)
    CO2_FACTOR_KG_PER_KG_FOOD = 2.5
    estimated_co2_saved_kg = total_kg * CO2_FACTOR_KG_PER_KG_FOOD

    # Donations by category
    from sqlalchemy import func
    category_stats = db.query(
        FoodDonation.food_category,
        func.count(FoodDonation.id).label("count"),
        func.sum(FoodDonation.quantity_kg).label("total_kg"),
    ).group_by(FoodDonation.food_category).all()

    # Donations over time (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent = db.query(
        func.date(FoodDonation.created_at).label("date"),
        func.count(FoodDonation.id).label("count"),
        func.sum(FoodDonation.quantity_kg).label("total_kg"),
    ).filter(
        FoodDonation.created_at >= thirty_days_ago
    ).group_by(func.date(FoodDonation.created_at)).order_by("date").all()

    return {
        "summary": {
            "food_rescued_kg": round(total_kg, 2),
            "estimated_meals": total_meals,
            "completed_rescues": total_rescues,
            "avg_pickup_time_minutes": round(sum(pickup_times) / len(pickup_times), 1) if pickup_times else 0,
            "avg_delivery_time_minutes": round(sum(delivery_times) / len(delivery_times), 1) if delivery_times else 0,
            "avg_distance_km": round(sum(distances) / len(distances), 2) if distances else 0,
            "success_rate_pct": round(success_rate, 1),
            "estimated_co2_saved_kg": round(estimated_co2_saved_kg, 1),
            "co2_disclaimer": "Estimated using configurable factor of 2.5 kg CO2e per kg food. Not an exact measurement.",
        },
        "by_category": [
            {"category": r.food_category.value, "count": r.count, "total_kg": round(float(r.total_kg or 0), 2)}
            for r in category_stats
        ],
        "over_time": [
            {"date": str(r.date), "count": r.count, "total_kg": round(float(r.total_kg or 0), 2)}
            for r in recent
        ],
    }


@router.get("/audit-logs")
def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]




@router.put("/donations/{donation_id}/approve")
def admin_approve_donation(
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Admin manually approves a donation (CREATED or QUALITY_CHECK -> APPROVED)."""
    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status not in (DonationStatus.CREATED, DonationStatus.QUALITY_CHECK):
        raise HTTPException(status_code=400, detail=f"Cannot approve donation in status {donation.status.value}")
    donation.status = DonationStatus.APPROVED
    donation.updated_at = datetime.now(timezone.utc)
    log_action(db, "DONATION_APPROVED", user_id=current_user.id,
               entity_type="donation", entity_id=donation_id)
    db.commit()
    return {"message": "Donation approved"}


@router.put("/donations/{donation_id}/reject")
def admin_reject_donation(
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Admin rejects a donation."""
    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status in (DonationStatus.COMPLETED, DonationStatus.REJECTED, DonationStatus.CANCELLED):
        raise HTTPException(status_code=400, detail=f"Cannot reject donation in status {donation.status.value}")
    donation.status = DonationStatus.REJECTED
    donation.updated_at = datetime.now(timezone.utc)
    log_action(db, "DONATION_REJECTED", user_id=current_user.id,
               entity_type="donation", entity_id=donation_id)
    db.commit()
    return {"message": "Donation rejected"}
@router.get("/forecasts")
def get_forecasts(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    from app.ai.forecasting import forecast_7day
    from sqlalchemy import func

    # Calculate historical avg from actual data
    avg_result = db.query(func.avg(FoodDonation.quantity_kg)).filter(
        FoodDonation.status == DonationStatus.COMPLETED
    ).scalar()
    historical_avg = float(avg_result) if avg_result else 80.0

    forecasts = forecast_7day(historical_avg=historical_avg)
    return {
        "forecasts": forecasts,
        "disclaimer": "Forecasts are AI-generated estimates based on historical patterns. Demo data is clearly marked.",
        "historical_avg_kg": round(historical_avg, 1),
    }


@router.put("/donations/{donation_id}/undo-reject")
def admin_undo_reject(
    donation_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Undo a rejected donation - restore it to CREATED for re-review."""
    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status != DonationStatus.REJECTED:
        raise HTTPException(status_code=400, detail=f"Donation is not rejected (status: {donation.status.value})")
    donation.status = DonationStatus.CREATED
    donation.updated_at = datetime.now(timezone.utc)
    log_action(db, "DONATION_UNDO_REJECTED", user_id=current_user.id,
               entity_type="donation", entity_id=donation_id)
    db.commit()
    return {"message": "Donation restored to CREATED for re-review"}


@router.post("/donations/{donation_id}/assign-delivery")
def admin_assign_delivery(
    donation_id: int,
    volunteer_id: int,
    ngo_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Admin manually assigns a volunteer and NGO to an approved donation."""
    from app.models.volunteer_profile import VolunteerProfile, AvailabilityStatus
    from app.models.ngo_profile import NGOProfile
    from app.models.delivery import Delivery, DeliveryStatus
    from app.core.security import generate_otp, hash_otp
    from app.models.otp_verification import OTPVerification, OTPType
    from app.ai.matching_service import haversine_distance

    donation = db.query(FoodDonation).filter(FoodDonation.id == donation_id).first()
    if not donation:
        raise HTTPException(status_code=404, detail="Donation not found")
    if donation.status not in (DonationStatus.APPROVED, DonationStatus.MATCHING):
        raise HTTPException(status_code=400, detail=f"Donation must be APPROVED or MATCHING (is {donation.status.value})")

    volunteer = db.query(VolunteerProfile).filter(VolunteerProfile.id == volunteer_id).first()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    ngo = db.query(NGOProfile).filter(NGOProfile.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")

    # Check 100km constraint
    if donation.latitude and volunteer.current_latitude:
        dist_v = haversine_distance(donation.latitude, donation.longitude,
                                    volunteer.current_latitude, volunteer.current_longitude)
        if dist_v > 100:
            raise HTTPException(status_code=400, detail=f"Volunteer is {dist_v:.1f} km away - exceeds 100 km limit")
    if donation.latitude and ngo.latitude:
        dist_n = haversine_distance(donation.latitude, donation.longitude,
                                    ngo.latitude, ngo.longitude)
        if dist_n > 100:
            raise HTTPException(status_code=400, detail=f"NGO is {dist_n:.1f} km away - exceeds 100 km limit")

    existing = db.query(Delivery).filter(Delivery.donation_id == donation_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="A delivery already exists for this donation")

    dist_km = haversine_distance(
        volunteer.current_latitude or 0, volunteer.current_longitude or 0,
        ngo.latitude or 0, ngo.longitude or 0
    ) if (volunteer.current_latitude and ngo.latitude) else None

    delivery = Delivery(
        donation_id=donation.id,
        volunteer_id=volunteer_id,
        ngo_id=ngo_id,
        distance_km=dist_km,
        status=DeliveryStatus.ASSIGNED,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(delivery)
    db.flush()

    donation.status = DonationStatus.VOLUNTEER_ASSIGNED
    volunteer.availability_status = AvailabilityStatus.BUSY

    otp = generate_otp()
    db.add(OTPVerification(
        delivery_id=delivery.id,
        otp_type=OTPType.PICKUP,
        otp_hash=hash_otp(otp),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=15),
    ))

    log_action(db, "ADMIN_ASSIGNED_DELIVERY", user_id=current_user.id,
               entity_type="delivery", entity_id=delivery.id)
    db.commit()

    return {
        "message": "Delivery assigned successfully",
        "delivery_id": delivery.id,
        "pickup_otp": otp,
        "volunteer_name": volunteer.user.name if volunteer.user else str(volunteer_id),
        "ngo_name": ngo.organization_name or str(ngo_id),
    }


@router.get("/available-volunteers")
def get_available_volunteers(
    lat: float = Query(None),
    lon: float = Query(None),
    radius_km: float = Query(100.0),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Get approved available volunteers, optionally filtered by proximity."""
    from app.models.volunteer_profile import VolunteerProfile, AvailabilityStatus
    from app.ai.matching_service import haversine_distance
    vols = db.query(VolunteerProfile).filter(
        VolunteerProfile.is_approved == True,
        VolunteerProfile.availability_status == AvailabilityStatus.AVAILABLE,
    ).all()
    results = []
    for v in vols:
        dist = None
        if lat and lon and v.current_latitude and v.current_longitude:
            dist = round(haversine_distance(lat, lon, v.current_latitude, v.current_longitude), 2)
            if dist > radius_km:
                continue
        results.append({
            "id": v.id,
            "user_id": v.user_id,
            "name": v.user.name if v.user else "",
            "vehicle_type": v.vehicle_type.value if v.vehicle_type else None,
            "vehicle_capacity_kg": v.vehicle_capacity_kg,
            "rating": v.rating,
            "total_deliveries": v.total_deliveries,
            "distance_km": dist,
        })
    results.sort(key=lambda x: (x["distance_km"] or 999))
    return results


@router.get("/available-ngos")
def get_available_ngos(
    lat: float = Query(None),
    lon: float = Query(None),
    radius_km: float = Query(100.0),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Get approved NGOs, optionally filtered by proximity."""
    from app.models.ngo_profile import NGOProfile
    from app.ai.matching_service import haversine_distance
    ngos = db.query(NGOProfile).filter(NGOProfile.is_approved == True).all()
    results = []
    for n in ngos:
        dist = None
        if lat and lon and n.latitude and n.longitude:
            dist = round(haversine_distance(lat, lon, n.latitude, n.longitude), 2)
            if dist > radius_km:
                continue
        results.append({
            "id": n.id,
            "user_id": n.user_id,
            "name": n.organization_name or (n.user.name if n.user else ""),
            "address": n.address,
            "capacity_kg": n.capacity_kg,
            "beneficiary_count": n.beneficiary_count,
            "distance_km": dist,
        })
    results.sort(key=lambda x: (x["distance_km"] or 999))
    return results
