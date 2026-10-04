"""
AI Module 1: Food Quality Risk Screening

IMPORTANT SAFETY NOTICE:
This module provides AI-ASSISTED food-quality risk screening only.
It is a screening aid to help prioritize review, NOT a regulatory
certification or guarantee of food safety.
Results should be reviewed by a human before acting on them.
All thresholds are configurable prototype/application rules and do NOT
represent official FSSAI, FDA, or any other regulatory body standards.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional
import numpy as np
from app.core.config import settings

logger = logging.getLogger(__name__)

MODEL_NAME = "FoodQualityClassifier"
MODEL_VERSION = "1.0"
FALLBACK_MODEL_NAME = "RuleBasedQualityScreener"
FALLBACK_MODEL_VERSION = "1.0"

# Configurable temperature thresholds (application prototype rules)
SAFE_HOT_FOOD_TEMP_MIN_C = 60.0
SAFE_COLD_FOOD_TEMP_MAX_C = 8.0
DANGER_ZONE_LOW_C = 8.0
DANGER_ZONE_HIGH_C = 60.0

# Time-based risk thresholds (configurable application rules, not regulatory)
MAX_SAFE_HOURS_BY_CATEGORY = {
    "RICE": 4,
    "BIRYANI": 4,
    "CURRY": 5,
    "VEGETABLES": 6,
    "BREAD": 8,
    "CHAPATI": 6,
    "FRUITS": 12,
    "BAKERY": 24,
    "MIXED_MEAL": 4,
    "OTHER": 5,
}


def _compute_temperature_score(temperature_c: Optional[float], food_category: str) -> float:
    """
    Score temperature suitability.
    Returns 0-100 score. Higher = better.
    NOTE: These are configurable application thresholds, not official standards.
    """
    if temperature_c is None:
        return 60.0  # Unknown temperature gets moderate score

    # Hot food: should be above 60°C
    if temperature_c >= SAFE_HOT_FOOD_TEMP_MIN_C:
        return 95.0
    # Cold food: should be below 8°C
    if temperature_c <= SAFE_COLD_FOOD_TEMP_MAX_C:
        return 90.0 if food_category in ["FRUITS", "BAKERY"] else 80.0
    # Danger zone
    if DANGER_ZONE_LOW_C < temperature_c < DANGER_ZONE_HIGH_C:
        # Score decreases as time in danger zone is unknown
        # Linear interpolation in danger zone
        mid = (DANGER_ZONE_LOW_C + DANGER_ZONE_HIGH_C) / 2
        if temperature_c < mid:
            # Near cold end
            score = 50.0 + (temperature_c - DANGER_ZONE_LOW_C) / (mid - DANGER_ZONE_LOW_C) * (-20)
        else:
            score = 30.0 + (DANGER_ZONE_HIGH_C - temperature_c) / (DANGER_ZONE_HIGH_C - mid) * 20
        return max(10.0, min(60.0, score))
    return 50.0


def _compute_time_score(cooked_at: datetime, food_category: str) -> float:
    """
    Score based on elapsed time since cooking.
    Returns 0-100. Higher = fresher.
    NOTE: Thresholds are configurable application rules, not regulatory standards.
    """
    now = datetime.now(timezone.utc)
    if cooked_at.tzinfo is None:
        cooked_at = cooked_at.replace(tzinfo=timezone.utc)
    elapsed_hours = (now - cooked_at).total_seconds() / 3600.0
    max_hours = MAX_SAFE_HOURS_BY_CATEGORY.get(food_category, 5)

    if elapsed_hours < 0:
        return 50.0  # Invalid timestamp
    if elapsed_hours <= max_hours * 0.5:
        return 100.0
    if elapsed_hours <= max_hours:
        return 100.0 - ((elapsed_hours - max_hours * 0.5) / (max_hours * 0.5)) * 50.0
    if elapsed_hours <= max_hours * 1.5:
        return 50.0 - ((elapsed_hours - max_hours) / (max_hours * 0.5)) * 40.0
    return max(0.0, 10.0 - (elapsed_hours - max_hours * 1.5) * 5.0)


def _compute_food_type_score(food_category: str) -> float:
    """
    Score based on food category perishability characteristics.
    Higher-risk categories get lower base scores.
    """
    risk_map = {
        "RICE": 70.0,
        "BIRYANI": 65.0,
        "CURRY": 72.0,
        "VEGETABLES": 78.0,
        "BREAD": 82.0,
        "CHAPATI": 80.0,
        "FRUITS": 85.0,
        "BAKERY": 75.0,
        "MIXED_MEAL": 68.0,
        "OTHER": 70.0,
    }
    return risk_map.get(food_category, 70.0)


def _analyze_image_rule_based(image_path: Optional[str]) -> tuple[float, str]:
    """
    Rule-based image analysis fallback when ML model is not available.
    Returns (score, method) where method is 'rule_based' or 'ml_model'.
    """
    if not image_path or not os.path.exists(image_path):
        return 70.0, "no_image"

    try:
        from PIL import Image
        img = Image.open(image_path).convert("RGB")
        img_array = np.array(img)

        # Simple heuristics: brightness, color variance
        brightness = img_array.mean()
        r_mean = img_array[:, :, 0].mean()
        g_mean = img_array[:, :, 1].mean()
        b_mean = img_array[:, :, 2].mean()

        # Very dark or very bright may indicate issues
        brightness_score = 100.0
        if brightness < 30:
            brightness_score = 40.0
        elif brightness < 60:
            brightness_score = 70.0
        elif brightness > 230:
            brightness_score = 60.0

        # Green foods tend to be fresh; unusual blue/purple may indicate spoilage
        color_score = 80.0
        if b_mean > r_mean * 1.5 and b_mean > g_mean * 1.5:
            color_score = 50.0  # Unusual blue dominance

        score = (brightness_score * 0.5 + color_score * 0.5)
        return min(95.0, max(20.0, score)), "rule_based"

    except Exception as e:
        logger.warning(f"Image analysis failed: {e}")
        return 70.0, "rule_based_fallback"


def _try_ml_image_analysis(image_path: Optional[str]) -> Optional[tuple[float, str, float]]:
    """
    Attempt ML-based image analysis. Returns (score, model_name, confidence) or None.
    """
    model_path = os.path.join(settings.AI_MODEL_DIR, "food_quality_model.pkl")
    if not os.path.exists(model_path):
        return None

    try:
        import joblib
        from PIL import Image

        model = joblib.load(model_path)
        img = Image.open(image_path).convert("RGB").resize((224, 224))
        features = np.array(img).flatten().reshape(1, -1) / 255.0
        proba = model.predict_proba(features)[0]
        # Classes: fresh(0), acceptable(1), spoiled(2)
        fresh_prob = proba[0]
        acceptable_prob = proba[1] if len(proba) > 1 else 0
        score = (fresh_prob * 100.0 + acceptable_prob * 60.0)
        confidence = float(max(proba))
        return min(100.0, score), MODEL_NAME, confidence

    except Exception as e:
        logger.warning(f"ML model inference failed: {e}")
        return None


def run_quality_screening(
    food_category: str,
    cooked_at: datetime,
    temperature_c: Optional[float],
    image_path: Optional[str] = None,
) -> dict:
    """
    Main quality screening function.

    Returns a screening result dict. This is an AI-ASSISTED screening aid,
    not a food safety certification.
    """
    cfg = settings

    # --- Image Score ---
    ml_result = _try_ml_image_analysis(image_path)
    if ml_result:
        image_score, used_model_name, confidence = ml_result
        prediction_method = "ml_model"
    else:
        image_score, prediction_method = _analyze_image_rule_based(image_path)
        used_model_name = FALLBACK_MODEL_NAME
        confidence = None

    # --- Temperature Score ---
    temp_score = _compute_temperature_score(temperature_c, food_category)

    # --- Time Score ---
    time_score = _compute_time_score(cooked_at, food_category)

    # --- Food Type Score ---
    food_type_score = _compute_food_type_score(food_category)

    # --- Weighted Overall Score ---
    overall_score = (
        image_score * cfg.QUALITY_WEIGHT_IMAGE
        + temp_score * cfg.QUALITY_WEIGHT_TEMPERATURE
        + time_score * cfg.QUALITY_WEIGHT_TIME
        + food_type_score * cfg.QUALITY_WEIGHT_FOOD_TYPE
    )
    overall_score = round(overall_score, 2)

    # --- Risk Classification (configurable prototype thresholds) ---
    if overall_score >= cfg.QUALITY_THRESHOLD_LOW_RISK:
        risk_level = "LOW"
    elif overall_score >= cfg.QUALITY_THRESHOLD_MEDIUM_RISK:
        risk_level = "MEDIUM"
    elif overall_score >= 30.0:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"

    freshness_probability = round(overall_score / 100.0, 4)
    risk_probability = round(1.0 - freshness_probability, 4)

    # Determine quality status
    if risk_level in ("HIGH", "CRITICAL"):
        quality_status = "REJECTED"
    elif risk_level == "MEDIUM":
        quality_status = "FLAGGED"
    else:
        quality_status = "APPROVED"

    return {
        "quality_score": overall_score,
        "risk_level": risk_level,
        "quality_status": quality_status,
        "freshness_probability": freshness_probability,
        "risk_probability": risk_probability,
        "image_score": round(image_score, 2),
        "temperature_score": round(temp_score, 2),
        "time_score": round(time_score, 2),
        "food_type_score": round(food_type_score, 2),
        "model_name": used_model_name,
        "model_version": MODEL_VERSION,
        "confidence": confidence,
        "prediction_method": prediction_method,
        "disclaimer": (
            "This is an AI-assisted food-quality risk screening result only. "
            "It is NOT a food safety certification or regulatory approval. "
            "All thresholds are configurable prototype application rules."
        ),
    }
