"""
AI Module 2: Surplus Forecasting

Predicts future food surplus using historical donation data.
Uses RandomForestRegressor as baseline model.

NOTE: Displayed metrics are actual evaluation metrics from model training.
Demo/seed data is clearly marked with is_demo_data=True.
"""

import os
import logging
from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
import numpy as np

logger = logging.getLogger(__name__)

MODEL_NAME = "SurplusForecastModel"
MODEL_VERSION = "1.0"


def _get_day_features(target_date: date) -> dict:
    """Extract date-based features for forecasting."""
    # Simple festival/event flags (configurable)
    major_festival_months = {1: "Pongal", 4: "Ugadi", 8: "Independence", 10: "Dussehra", 11: "Diwali"}
    month = target_date.month
    dow = target_date.weekday()  # 0=Monday, 6=Sunday

    is_weekend = 1 if dow >= 5 else 0
    is_festival_month = 1 if month in major_festival_months else 0

    return {
        "day_of_week": dow,
        "month": month,
        "is_weekend": is_weekend,
        "is_festival_month": is_festival_month,
        "day_of_year": target_date.timetuple().tm_yday,
    }


def _load_model():
    """Try to load trained model from disk."""
    from app.core.config import settings
    model_path = os.path.join(settings.AI_MODEL_DIR, "surplus_forecast_model.pkl")
    if not os.path.exists(model_path):
        return None
    try:
        import joblib
        return joblib.load(model_path)
    except Exception as e:
        logger.warning(f"Could not load forecast model: {e}")
        return None


def _rule_based_forecast(target_date: date, historical_avg: float = 80.0) -> dict:
    """
    Rule-based fallback forecast when ML model is unavailable.
    Clearly identified as rule-based estimate.
    """
    features = _get_day_features(target_date)
    base = historical_avg

    # Adjust for day of week
    dow_multipliers = {0: 0.8, 1: 0.85, 2: 0.9, 3: 1.0, 4: 1.2, 5: 1.5, 6: 1.3}
    base *= dow_multipliers.get(features["day_of_week"], 1.0)

    # Adjust for festivals
    if features["is_festival_month"]:
        base *= 1.4

    return {
        "predicted_surplus_kg": round(base, 1),
        "model_name": "RuleBasedForecaster",
        "model_version": "1.0",
        "confidence_interval_low": round(base * 0.7, 1),
        "confidence_interval_high": round(base * 1.3, 1),
        "is_demo_data": True,
        "method": "rule_based_fallback",
    }


def forecast_surplus(target_date: date, historical_avg: float = 80.0) -> dict:
    """Generate surplus forecast for a given date."""
    model = _load_model()
    features = _get_day_features(target_date)

    if model is not None:
        try:
            X = np.array([[
                features["day_of_week"],
                features["month"],
                features["is_weekend"],
                features["is_festival_month"],
                features["day_of_year"],
                historical_avg,
            ]])
            prediction = float(model.predict(X)[0])
            prediction = max(0.0, prediction)
            return {
                "predicted_surplus_kg": round(prediction, 1),
                "model_name": MODEL_NAME,
                "model_version": MODEL_VERSION,
                "confidence_interval_low": round(prediction * 0.8, 1),
                "confidence_interval_high": round(prediction * 1.2, 1),
                "is_demo_data": False,
                "method": "ml_model",
            }
        except Exception as e:
            logger.warning(f"ML forecast failed: {e}")

    return _rule_based_forecast(target_date, historical_avg)


def forecast_7day(start_date: Optional[date] = None, historical_avg: float = 80.0) -> List[dict]:
    """Generate 7-day surplus forecast."""
    if start_date is None:
        start_date = date.today() + timedelta(days=1)

    results = []
    for i in range(7):
        target = start_date + timedelta(days=i)
        fc = forecast_surplus(target, historical_avg)
        fc["forecast_date"] = target.isoformat()
        fc["day_name"] = target.strftime("%A")
        results.append(fc)
    return results
