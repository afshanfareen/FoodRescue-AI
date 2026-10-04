from sqlalchemy.orm import Session
from app.models.notification import Notification, NotificationType
from typing import Optional


def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    title: str,
    message: str,
    reference_id: Optional[int] = None,
    reference_type: Optional[str] = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        reference_id=reference_id,
        reference_type=reference_type,
    )
    db.add(notif)
    db.flush()
    return notif


def notify_donation_created(db: Session, user_id: int, donation_id: int, food_name: str):
    create_notification(
        db, user_id, NotificationType.DONATION_CREATED,
        "Donation Submitted",
        f"Your donation of '{food_name}' has been submitted and is pending quality screening.",
        reference_id=donation_id, reference_type="donation",
    )


def notify_quality_result(db: Session, user_id: int, donation_id: int, risk_level: str, status: str):
    title = "Quality Screening Complete"
    msg = f"AI-assisted quality screening result: Risk Level = {risk_level}, Status = {status}. This is a screening aid, not a regulatory certification."
    create_notification(
        db, user_id, NotificationType.QUALITY_RESULT, title, msg,
        reference_id=donation_id, reference_type="donation",
    )


def notify_donation_approved(db: Session, user_id: int, donation_id: int):
    create_notification(
        db, user_id, NotificationType.DONATION_APPROVED,
        "Donation Approved",
        "Your donation has passed quality screening and is now being matched with a volunteer.",
        reference_id=donation_id, reference_type="donation",
    )


def notify_donation_rejected(db: Session, user_id: int, donation_id: int, reason: str = ""):
    create_notification(
        db, user_id, NotificationType.DONATION_REJECTED,
        "Donation Flagged/Rejected",
        f"Your donation was flagged by quality screening. {reason}",
        reference_id=donation_id, reference_type="donation",
    )


def notify_volunteer_assigned(db: Session, user_id: int, donation_id: int, volunteer_name: str):
    create_notification(
        db, user_id, NotificationType.VOLUNTEER_ASSIGNED,
        "Volunteer Assigned",
        f"Volunteer {volunteer_name} has been assigned to pick up your donation.",
        reference_id=donation_id, reference_type="donation",
    )


def notify_volunteer_rescue_request(db: Session, volunteer_user_id: int, donation_id: int, food_name: str, distance_km: float):
    create_notification(
        db, volunteer_user_id, NotificationType.VOLUNTEER_ASSIGNED,
        "New Rescue Request",
        f"A rescue request for '{food_name}' is available {distance_km:.1f} km away.",
        reference_id=donation_id, reference_type="donation",
    )


def notify_pickup_completed(db: Session, user_id: int, delivery_id: int):
    create_notification(
        db, user_id, NotificationType.PICKUP_COMPLETED,
        "Pickup Confirmed",
        "The volunteer has confirmed pickup of your donation. Delivery in progress.",
        reference_id=delivery_id, reference_type="delivery",
    )


def notify_delivery_completed(db: Session, user_id: int, delivery_id: int):
    create_notification(
        db, user_id, NotificationType.DELIVERY_COMPLETED,
        "Delivery Completed",
        "Your donation has been successfully delivered! Thank you for helping reduce food waste.",
        reference_id=delivery_id, reference_type="delivery",
    )


def notify_ngo_donation_available(db, ngo_user_id: int, donation_id: int, food_name: str, quantity_kg: float, distance_km: float):
    """Notify an NGO that a donation is available within their radius."""
    create_notification(
        db, ngo_user_id, NotificationType.GENERAL,
        "Food Donation Available Near You",
        f"'{food_name}' ({quantity_kg:.1f} kg) is available {distance_km:.1f} km from your NGO. Log in to accept or decline.",
        reference_id=donation_id, reference_type="donation",
    )


def notify_ngo_donation_accepted(db, donor_user_id: int, ngo_name: str, donation_id: int, food_name: str):
    """Notify donor that an NGO accepted their donation."""
    create_notification(
        db, donor_user_id, NotificationType.DONATION_APPROVED,
        "NGO Accepted Your Donation",
        f"'{ngo_name}' has accepted your donation of '{food_name}'. A volunteer will be matched shortly.",
        reference_id=donation_id, reference_type="donation",
    )
