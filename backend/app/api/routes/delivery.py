import os
import shutil
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.delivery import Delivery, DeliveryStatus
from app.models.proof_of_delivery import ProofOfDelivery
from app.models.volunteer_profile import VolunteerProfile
from app.services.audit_service import log_action

router = APIRouter(prefix="/deliveries", tags=["deliveries"])


@router.get("/{delivery_id}")
def get_delivery(
    delivery_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # Authorization check
    if current_user.role == UserRole.VOLUNTEER:
        profile = db.query(VolunteerProfile).filter(VolunteerProfile.user_id == current_user.id).first()
        if not profile or delivery.volunteer_id != profile.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.NGO:
        from app.models.ngo_profile import NGOProfile
        ngo = db.query(NGOProfile).filter(NGOProfile.user_id == current_user.id).first()
        if not ngo or delivery.ngo_id != ngo.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.DONOR:
        from app.models.donor_profile import DonorProfile
        donor = db.query(DonorProfile).filter(DonorProfile.user_id == current_user.id).first()
        if not donor or delivery.donation.donor_id != donor.id:
            raise HTTPException(status_code=403, detail="Access denied")

    return _delivery_detail(delivery)


@router.post("/{delivery_id}/proof")
def upload_proof_of_delivery(
    delivery_id: int,
    notes: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_user: User = Depends(require_role(UserRole.VOLUNTEER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if current_user.role == UserRole.VOLUNTEER:
        profile = db.query(VolunteerProfile).filter(VolunteerProfile.user_id == current_user.id).first()
        if not profile or delivery.volunteer_id != profile.id:
            raise HTTPException(status_code=403, detail="Access denied")

    if delivery.status not in (DeliveryStatus.DELIVERED, DeliveryStatus.COMPLETED):
        raise HTTPException(status_code=400, detail="Proof can only be uploaded after delivery")

    image_path = None
    image_url = None
    if image and image.filename:
        ext = os.path.splitext(image.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            raise HTTPException(status_code=400, detail="Invalid image format")
        upload_dir = os.path.join(settings.UPLOAD_DIR, "proof_images")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"proof_{delivery_id}_{int(datetime.now().timestamp())}{ext}"
        image_path = os.path.join(upload_dir, filename)
        with open(image_path, "wb") as f:
            shutil.copyfileobj(image.file, f)
        image_url = f"/uploads/proof_images/{filename}"

    existing_proof = db.query(ProofOfDelivery).filter(ProofOfDelivery.delivery_id == delivery_id).first()
    if existing_proof:
        proof = existing_proof
    else:
        proof = ProofOfDelivery(delivery_id=delivery_id)
        db.add(proof)

    if image_path:
        proof.image_path = image_path
        proof.image_url = image_url
    if notes:
        proof.notes = notes
    if latitude:
        proof.latitude = latitude
    if longitude:
        proof.longitude = longitude
    proof.uploaded_by = current_user.id

    delivery.status = DeliveryStatus.COMPLETED
    log_action(db, "PROOF_OF_DELIVERY_UPLOADED", user_id=current_user.id,
               entity_type="delivery", entity_id=delivery_id)
    db.commit()

    return {
        "message": "Proof of delivery uploaded successfully",
        "proof_id": proof.id,
        "image_url": image_url,
    }


def _delivery_detail(delivery: Delivery) -> dict:
    proof = delivery.proof_of_delivery
    donation = delivery.donation
    volunteer = delivery.volunteer
    ngo = delivery.ngo

    return {
        "id": delivery.id,
        "donation_id": delivery.donation_id,
        "volunteer_id": delivery.volunteer_id,
        "ngo_id": delivery.ngo_id,
        "status": delivery.status.value,
        "assigned_at": delivery.assigned_at.isoformat() if delivery.assigned_at else None,
        "accepted_at": delivery.accepted_at.isoformat() if delivery.accepted_at else None,
        "pickup_time": delivery.pickup_time.isoformat() if delivery.pickup_time else None,
        "delivery_time": delivery.delivery_time.isoformat() if delivery.delivery_time else None,
        "distance_km": delivery.distance_km,
        "estimated_time_minutes": delivery.estimated_time_minutes,
        "pickup_verified": delivery.pickup_verified,
        "delivery_verified": delivery.delivery_verified,
        "donation": {
            "food_name": donation.food_name if donation else None,
            "food_category": donation.food_category.value if donation else None,
            "quantity_kg": donation.quantity_kg if donation else None,
            "address": donation.address if donation else None,
            "latitude": donation.latitude if donation else None,
            "longitude": donation.longitude if donation else None,
        } if donation else None,
        "ngo": {
            "id": ngo.id,
            "organization_name": ngo.organization_name,
            "address": ngo.address,
            "latitude": ngo.latitude,
            "longitude": ngo.longitude,
        } if ngo else None,
        "proof_of_delivery": {
            "image_url": proof.image_url,
            "notes": proof.notes,
            "uploaded_at": proof.uploaded_at.isoformat() if proof else None,
        } if proof else None,
    }
