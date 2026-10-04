from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.user import User, UserRole, UserStatus
from app.models.donor_profile import DonorProfile
from app.models.volunteer_profile import VolunteerProfile
from app.models.ngo_profile import NGOProfile
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, db: Session = Depends(get_db), request: Request = None):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=req.name,
        email=req.email,
        phone=req.phone,
        password_hash=hash_password(req.password),
        role=req.role,
        status=UserStatus.ACTIVE,
    )
    # Volunteers and NGOs start as pending approval
    if req.role in (UserRole.VOLUNTEER, UserRole.NGO):
        user.status = UserStatus.ACTIVE  # Allow login but mark profile as pending

    db.add(user)
    db.flush()

    # Create role-specific profile
    if req.role == UserRole.DONOR:
        profile = DonorProfile(user_id=user.id)
        db.add(profile)
    elif req.role == UserRole.VOLUNTEER:
        profile = VolunteerProfile(user_id=user.id, is_approved=False)
        db.add(profile)
    elif req.role == UserRole.NGO:
        profile = NGOProfile(user_id=user.id, is_approved=False)
        db.add(profile)

    db.commit()
    db.refresh(user)

    log_action(db, "USER_REGISTERED", user_id=user.id, entity_type="user", entity_id=user.id)
    db.commit()

    token = create_access_token(
        {"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        name=user.name,
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(status_code=403, detail="Account suspended. Contact support.")
    if user.status == UserStatus.INACTIVE:
        raise HTTPException(status_code=403, detail="Account is inactive.")

    log_action(db, "USER_LOGIN", user_id=user.id, entity_type="user", entity_id=user.id)
    db.commit()

    token = create_access_token(
        {"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(
        access_token=token,
        user_id=user.id,
        role=user.role.value,
        name=user.name,
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    # JWT is stateless; client discards token
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
def forgot_password(email: str, db: Session = Depends(get_db)):
    """Generate a password reset token. In production this would email the link."""
    from app.core.security import create_access_token
    from datetime import timedelta
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email address.")
    reset_token = create_access_token(
        {"sub": str(user.id), "purpose": "password_reset"},
        expires_delta=timedelta(minutes=30),
    )
    # Build the reset URL pointing to the frontend reset page
    reset_url = f"{settings.APP_BASE_URL}/reset-password?token={reset_token}"

    # Send email via SMTP
    from app.services.email_service import send_password_reset_email
    email_sent = send_password_reset_email(
        to_address=user.email,
        user_name=user.name,
        reset_url=reset_url,
    )

    if email_sent:
        return {
            "message": f"Password reset link sent to {user.email}. Check your inbox (and spam folder).",
            "email_sent": True,
        }
    else:
        # SMTP not configured — return token directly so dev/demo still works
        return {
            "message": (
                "SMTP is not configured. In production, set SMTP_USER and SMTP_PASSWORD in .env. "
                "For now, use the reset_token below directly."
            ),
            "email_sent": False,
            "reset_token": reset_token,
            "reset_url": reset_url,
            "expires_in_minutes": 30,
        }


@router.post("/reset-password")
def reset_password(token: str, new_password: str, db: Session = Depends(get_db)):
    """Reset password using token from forgot-password."""
    from app.core.security import decode_access_token, hash_password
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    payload = decode_access_token(token)
    if not payload or payload.get("purpose") != "password_reset":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Password reset successfully. You can now log in."}
