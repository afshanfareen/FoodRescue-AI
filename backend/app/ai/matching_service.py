"""
AI Module 3: Hyperlocal Matching Engine

Uses Haversine distance + weighted scoring to match donations
with volunteers and NGOs.
"""

import math
from typing import List, Optional
from dataclasses import dataclass
from app.core.config import settings


@dataclass
class VolunteerCandidate:
    volunteer_id: int
    user_id: int
    name: str
    vehicle_type: str
    vehicle_capacity_kg: float
    current_latitude: Optional[float]
    current_longitude: Optional[float]
    rating: float
    total_deliveries: int
    availability_status: str


@dataclass
class NGOCandidate:
    ngo_id: int
    user_id: int
    name: str
    latitude: Optional[float]
    longitude: Optional[float]
    capacity_kg: float
    beneficiary_count: int
    required_quantity_kg: float
    food_categories: List[str]


@dataclass
class MatchResult:
    volunteer_id: int
    user_id: int
    name: str
    vehicle_type: str
    distance_km: float
    matching_score: float
    score_breakdown: dict
    estimated_time_minutes: float


@dataclass
class NGOMatchResult:
    ngo_id: int
    user_id: int
    name: str
    distance_km: float
    matching_score: float
    beneficiary_count: int


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points using the Haversine formula.
    Returns distance in kilometers.
    """
    R = 6371.0  # Earth's radius in km
    lat1_r = math.radians(lat1)
    lat2_r = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _distance_score(distance_km: float, max_km: float = 25.0) -> float:
    """Score based on distance. Closer = higher score (0-100)."""
    if distance_km <= 0:
        return 100.0
    if distance_km >= max_km:
        return 0.0
    return max(0.0, (1.0 - distance_km / max_km) * 100.0)


def _capacity_score(capacity_kg: float, required_kg: float) -> float:
    """Score based on whether volunteer can carry the full load."""
    if capacity_kg >= required_kg:
        return 100.0
    if capacity_kg >= required_kg * 0.7:
        return 70.0
    if capacity_kg >= required_kg * 0.5:
        return 40.0
    return 10.0


def _availability_score(availability_status: str) -> float:
    """Score based on current availability."""
    scores = {"AVAILABLE": 100.0, "BUSY": 20.0, "OFFLINE": 0.0}
    return scores.get(availability_status, 0.0)


def _vehicle_score(vehicle_type: str, quantity_kg: float) -> float:
    """Score vehicle suitability for the quantity."""
    capacity_map = {
        "WALK": 5.0,
        "BICYCLE": 15.0,
        "MOTORCYCLE": 30.0,
        "CAR": 80.0,
        "VAN": 200.0,
        "TRUCK": 1000.0,
    }
    vehicle_capacity = capacity_map.get(vehicle_type, 20.0)
    if vehicle_capacity >= quantity_kg:
        return 100.0
    if vehicle_capacity >= quantity_kg * 0.6:
        return 60.0
    return 20.0


def _reliability_score(rating: float, total_deliveries: int) -> float:
    """Score based on volunteer's track record."""
    rating_score = (rating / 5.0) * 100.0
    experience_bonus = min(20.0, total_deliveries * 0.5)
    return min(100.0, rating_score * 0.8 + experience_bonus)


def _estimate_travel_time(distance_km: float, vehicle_type: str) -> float:
    """Estimate travel time in minutes based on vehicle type."""
    speeds = {
        "WALK": 5.0,
        "BICYCLE": 15.0,
        "MOTORCYCLE": 30.0,
        "CAR": 40.0,
        "VAN": 35.0,
        "TRUCK": 30.0,
    }
    speed = speeds.get(vehicle_type, 25.0)
    return (distance_km / speed) * 60.0


def find_matching_volunteers(
    donation_lat: float,
    donation_lon: float,
    quantity_kg: float,
    candidates: List[VolunteerCandidate],
    max_radius_km: float = None,
    top_n: int = 5,
) -> List[MatchResult]:
    """
    Find and rank matching volunteers for a donation.
    Uses configurable weighted scoring (application-defined weights).
    """
    if max_radius_km is None:
        max_radius_km = settings.MAX_SEARCH_RADIUS_KM

    cfg = settings
    results = []

    for candidate in candidates:
        if candidate.current_latitude is None or candidate.current_longitude is None:
            continue
        if candidate.availability_status != "AVAILABLE":
            continue

        distance = haversine_distance(
            donation_lat, donation_lon,
            candidate.current_latitude, candidate.current_longitude
        )

        if distance > max_radius_km:
            continue

        # Calculate component scores
        d_score = _distance_score(distance, max_radius_km)
        c_score = _capacity_score(candidate.vehicle_capacity_kg, quantity_kg)
        a_score = _availability_score(candidate.availability_status)
        v_score = _vehicle_score(candidate.vehicle_type, quantity_kg)
        r_score = _reliability_score(candidate.rating, candidate.total_deliveries)

        # Weighted matching score (configurable application weights)
        matching_score = (
            d_score * cfg.MATCH_WEIGHT_DISTANCE
            + c_score * cfg.MATCH_WEIGHT_CAPACITY
            + a_score * cfg.MATCH_WEIGHT_AVAILABILITY
            + v_score * cfg.MATCH_WEIGHT_VEHICLE
            + r_score * cfg.MATCH_WEIGHT_RELIABILITY
        )

        est_time = _estimate_travel_time(distance, candidate.vehicle_type)

        results.append(MatchResult(
            volunteer_id=candidate.volunteer_id,
            user_id=candidate.user_id,
            name=candidate.name,
            vehicle_type=candidate.vehicle_type,
            distance_km=round(distance, 2),
            matching_score=round(matching_score, 2),
            score_breakdown={
                "distance_score": round(d_score, 2),
                "capacity_score": round(c_score, 2),
                "availability_score": round(a_score, 2),
                "vehicle_score": round(v_score, 2),
                "reliability_score": round(r_score, 2),
                "weights": {
                    "distance": cfg.MATCH_WEIGHT_DISTANCE,
                    "capacity": cfg.MATCH_WEIGHT_CAPACITY,
                    "availability": cfg.MATCH_WEIGHT_AVAILABILITY,
                    "vehicle": cfg.MATCH_WEIGHT_VEHICLE,
                    "reliability": cfg.MATCH_WEIGHT_RELIABILITY,
                },
            },
            estimated_time_minutes=round(est_time, 1),
        ))

    # Sort by score descending
    results.sort(key=lambda x: x.matching_score, reverse=True)
    return results[:top_n]


def find_matching_ngos(
    donation_lat: float,
    donation_lon: float,
    quantity_kg: float,
    food_category: str,
    candidates: List[NGOCandidate],
    max_radius_km: float = None,
    top_n: int = 5,
) -> List[NGOMatchResult]:
    """Find and rank matching NGOs for a donation."""
    if max_radius_km is None:
        max_radius_km = settings.MAX_SEARCH_RADIUS_KM

    results = []

    for candidate in candidates:
        if candidate.latitude is None or candidate.longitude is None:
            continue

        distance = haversine_distance(
            donation_lat, donation_lon,
            candidate.latitude, candidate.longitude
        )

        if distance > max_radius_km:
            continue

        # Category match bonus
        category_match = 1.0
        if candidate.food_categories and food_category not in candidate.food_categories:
            category_match = 0.6

        # Capacity check
        if candidate.capacity_kg < quantity_kg * 0.5:
            continue

        d_score = _distance_score(distance, max_radius_km)
        need_score = min(100.0, (candidate.required_quantity_kg / max(quantity_kg, 1)) * 100)
        beneficiary_score = min(100.0, candidate.beneficiary_count / 10.0)

        matching_score = (
            d_score * 0.40 + need_score * 0.35 + beneficiary_score * 0.25
        ) * category_match

        results.append(NGOMatchResult(
            ngo_id=candidate.ngo_id,
            user_id=candidate.user_id,
            name=candidate.name,
            distance_km=round(distance, 2),
            matching_score=round(matching_score, 2),
            beneficiary_count=candidate.beneficiary_count,
        ))

    results.sort(key=lambda x: x.matching_score, reverse=True)
    return results[:top_n]
