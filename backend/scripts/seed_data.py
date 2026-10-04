"""
Seed data script for FoodRescue AI development/demo environment.
Creates sample users, profiles, and donations.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User, UserRole, UserStatus
from app.models.donor_profile import DonorProfile, OrganizationType, VerificationStatus
from app.models.volunteer_profile import VolunteerProfile, VehicleType, AvailabilityStatus
from app.models.ngo_profile import NGOProfile, VerificationStatus as NGOVerificationStatus
from app.models.food_donation import FoodDonation, FoodCategory, DonationStatus
from app.models.ngo_requirements import NGORequirement

import app.models  # noqa

Base.metadata.create_all(bind=engine)

db = SessionLocal()


def create_user(name, email, password, role, phone=None, lat=None, lon=None):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing
    user = User(
        name=name,
        email=email,
        phone=phone,
        password_hash=hash_password(password),
        role=role,
        status=UserStatus.ACTIVE,
        latitude=lat,
        longitude=lon,
    )
    db.add(user)
    db.flush()
    return user


print("Creating admin...")
admin = create_user("Admin User", "admin@foodrescue.ai", "Admin@1234", UserRole.ADMIN)
admin1 = create_user("Admin User", "admin1@foodrescue.ai", "Admin@1234", UserRole.ADMIN)
admin2 = create_user("Admin User", "admin2@foodrescue.ai", "Admin@1234", UserRole.ADMIN)

print("Creating donors...")
donor1 = create_user("Spice Garden Restaurant", "spicegarden@demo.com", "Donor@1234",
                     UserRole.DONOR, "9876543210", lat=12.9716, lon=77.5946)
donor2 = create_user("Grand Wedding Hall", "grandwedding@demo.com", "Donor@1234",
                     UserRole.DONOR, "9876543211", lat=12.9352, lon=77.6245)
donor3 = create_user("City College Cafeteria", "citycollege@demo.com", "Donor@1234",
                     UserRole.DONOR, "9876543212", lat=12.9279, lon=77.6271)

print("Creating donor profiles...")
dp1 = db.query(DonorProfile).filter(DonorProfile.user_id == donor1.id).first()
if not dp1:
    dp1 = DonorProfile(user_id=donor1.id, organization_name="Spice Garden Restaurant",
                       organization_type=OrganizationType.RESTAURANT, address="MG Road, Bengaluru",
                       latitude=12.9716, longitude=77.5946, verification_status=VerificationStatus.VERIFIED)
    db.add(dp1)

dp2 = db.query(DonorProfile).filter(DonorProfile.user_id == donor2.id).first()
if not dp2:
    dp2 = DonorProfile(user_id=donor2.id, organization_name="Grand Wedding Hall",
                       organization_type=OrganizationType.WEDDING_HALL, address="Koramangala, Bengaluru",
                       latitude=12.9352, longitude=77.6245, verification_status=VerificationStatus.VERIFIED)
    db.add(dp2)

dp3 = db.query(DonorProfile).filter(DonorProfile.user_id == donor3.id).first()
if not dp3:
    dp3 = DonorProfile(user_id=donor3.id, organization_name="City College Cafeteria",
                       organization_type=OrganizationType.COLLEGE, address="Indiranagar, Bengaluru",
                       latitude=12.9279, longitude=77.6271, verification_status=VerificationStatus.VERIFIED)
    db.add(dp3)

db.flush()

print("Creating volunteers...")
vol1 = create_user("Raj Kumar", "raj@demo.com", "Vol@1234", UserRole.VOLUNTEER, "9876543213",
                   lat=12.9500, lon=77.6100)
vol2 = create_user("Priya S", "priya@demo.com", "Vol@1234", UserRole.VOLUNTEER, "9876543214",
                   lat=12.9600, lon=77.5900)

vp1 = db.query(VolunteerProfile).filter(VolunteerProfile.user_id == vol1.id).first()
if not vp1:
    vp1 = VolunteerProfile(user_id=vol1.id, vehicle_type=VehicleType.MOTORCYCLE,
                           vehicle_capacity_kg=30.0, availability_status=AvailabilityStatus.AVAILABLE,
                           current_latitude=12.9500, current_longitude=77.6100,
                           rating=4.8, total_deliveries=24, is_approved=True)
    db.add(vp1)

vp2 = db.query(VolunteerProfile).filter(VolunteerProfile.user_id == vol2.id).first()
if not vp2:
    vp2 = VolunteerProfile(user_id=vol2.id, vehicle_type=VehicleType.CAR,
                           vehicle_capacity_kg=80.0, availability_status=AvailabilityStatus.AVAILABLE,
                           current_latitude=12.9600, current_longitude=77.5900,
                           rating=4.9, total_deliveries=38, is_approved=True)
    db.add(vp2)

db.flush()

print("Creating NGOs...")
ngo1 = create_user("Annapoorna Trust", "annapoorna@demo.com", "NGO@1234", UserRole.NGO, "9876543215",
                   lat=12.9800, lon=77.5800)
ngo2 = create_user("Hope Foundation", "hope@demo.com", "NGO@1234", UserRole.NGO, "9876543216",
                   lat=12.9200, lon=77.6100)

np1 = db.query(NGOProfile).filter(NGOProfile.user_id == ngo1.id).first()
if not np1:
    np1 = NGOProfile(user_id=ngo1.id, organization_name="Annapoorna Trust",
                     registration_number="NGO/KA/2019/0123", address="Malleswaram, Bengaluru",
                     latitude=12.9800, longitude=77.5800, capacity_kg=200.0,
                     beneficiary_count=500, is_approved=True,
                     verification_status=NGOVerificationStatus.VERIFIED)
    db.add(np1)

np2 = db.query(NGOProfile).filter(NGOProfile.user_id == ngo2.id).first()
if not np2:
    np2 = NGOProfile(user_id=ngo2.id, organization_name="Hope Foundation",
                     registration_number="NGO/KA/2020/0456", address="Whitefield, Bengaluru",
                     latitude=12.9200, longitude=77.6100, capacity_kg=150.0,
                     beneficiary_count=300, is_approved=True,
                     verification_status=NGOVerificationStatus.VERIFIED)
    db.add(np2)

db.flush()

# NGO Requirements
req1 = db.query(NGORequirement).filter(NGORequirement.ngo_id == np1.id).first()
if not req1:
    req1 = NGORequirement(ngo_id=np1.id, required_quantity_kg=50.0,
                          food_categories=["RICE", "BIRYANI", "CURRY", "MIXED_MEAL"],
                          notes="We serve lunch and dinner to 500+ people daily")
    db.add(req1)

req2 = db.query(NGORequirement).filter(NGORequirement.ngo_id == np2.id).first()
if not req2:
    req2 = NGORequirement(ngo_id=np2.id, required_quantity_kg=30.0,
                          food_categories=["RICE", "VEGETABLES", "FRUITS", "BREAD"],
                          notes="Feeding programme for underprivileged children")
    db.add(req2)

db.flush()

print("Creating sample donations...")
now = datetime.now(timezone.utc)

donations_data = [
    dict(food_name="Biryani", food_category=FoodCategory.BIRYANI, quantity_kg=25.0,
         estimated_meals=50, cooked_at=now - timedelta(hours=1), temperature_c=65.0,
         latitude=12.9716, longitude=77.5946, address="MG Road, Bengaluru",
         status=DonationStatus.APPROVED, quality_score=88.5, notes="Wedding leftovers"),
    dict(food_name="Dal and Rice", food_category=FoodCategory.RICE, quantity_kg=15.0,
         estimated_meals=30, cooked_at=now - timedelta(hours=2), temperature_c=62.0,
         latitude=12.9352, longitude=77.6245, address="Koramangala, Bengaluru",
         status=DonationStatus.COMPLETED, quality_score=91.2),
    dict(food_name="Mixed Vegetables", food_category=FoodCategory.VEGETABLES, quantity_kg=10.0,
         estimated_meals=20, cooked_at=now - timedelta(hours=3), temperature_c=55.0,
         latitude=12.9279, longitude=77.6271, address="Indiranagar, Bengaluru",
         status=DonationStatus.VOLUNTEER_ASSIGNED, quality_score=79.3),
    dict(food_name="Chapati and Sabzi", food_category=FoodCategory.CHAPATI, quantity_kg=8.0,
         estimated_meals=16, cooked_at=now - timedelta(hours=1.5), temperature_c=58.0,
         latitude=12.9716, longitude=77.5946, address="MG Road, Bengaluru",
         status=DonationStatus.CREATED),
]

for d_data in donations_data:
    d_data_copy = d_data.copy()
    status = d_data_copy.pop("status", DonationStatus.CREATED)

    # Find donor profile
    donor = db.query(DonorProfile).filter(DonorProfile.user_id == donor1.id).first()
    if not donor:
        continue

    existing = db.query(FoodDonation).filter(
        FoodDonation.food_name == d_data_copy["food_name"],
        FoodDonation.donor_id == donor.id,
    ).first()
    if not existing:
        donation = FoodDonation(donor_id=donor.id, status=status, **d_data_copy)
        db.add(donation)

db.commit()
print("\n✅ Seed data created successfully!")
print("\nDemo Credentials:")
print("=" * 50)
print("ADMIN:     admin@foodrescue.ai    / Admin@1234")
print("DONOR:     spicegarden@demo.com   / Donor@1234")
print("VOLUNTEER: raj@demo.com           / Vol@1234")
print("NGO:       annapoorna@demo.com    / NGO@1234")
print("=" * 50)
db.close()
