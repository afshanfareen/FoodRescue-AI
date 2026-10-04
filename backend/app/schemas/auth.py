from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import UserRole


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    password: str
    role: UserRole

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    name: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    role: str
    status: str
    latitude: float | None
    longitude: float | None

    class Config:
        from_attributes = True
