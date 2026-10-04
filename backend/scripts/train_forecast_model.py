"""
Training script for Surplus Forecasting model.
Uses RandomForestRegressor on historical donation patterns.
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai_models")
os.makedirs(MODEL_DIR, exist_ok=True)

print("Generating synthetic historical surplus data...")
print("(Replace with actual donation history for production use)")

np.random.seed(42)
n_days = 365 * 2  # 2 years

dates = pd.date_range(start="2024-01-01", periods=n_days, freq="D")
dow = dates.dayofweek  # 0=Mon
month = dates.month
is_weekend = (dow >= 5).astype(int)
is_festival_month = month.isin([1, 4, 8, 10, 11]).astype(int)
day_of_year = dates.dayofyear

# Base surplus depends on day of week + festivals
base_surplus = 60 + dow * 10 + is_weekend * 40 + is_festival_month * 60
noise = np.random.normal(0, 15, n_days)
surplus_kg = np.maximum(0, base_surplus + noise)

# Historical average
hist_avg = surplus_kg.mean()

df = pd.DataFrame({
    "day_of_week": dow,
    "month": month,
    "is_weekend": is_weekend,
    "is_festival_month": is_festival_month,
    "day_of_year": day_of_year,
    "historical_avg": hist_avg,
    "surplus_kg": surplus_kg,
})

X = df[["day_of_week", "month", "is_weekend", "is_festival_month", "day_of_year", "historical_avg"]].values
y = df["surplus_kg"].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")

model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
print("Training Surplus Forecast Model...")
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print("\n=== ACTUAL Model Evaluation Metrics ===")
print(f"MAE:  {mae:.2f} kg")
print(f"RMSE: {rmse:.2f} kg")
print(f"R²:   {r2:.4f}")
print("NOTE: These metrics are from synthetic data and do NOT reflect")
print("real-world performance without actual historical donation data.")

model_path = os.path.join(MODEL_DIR, "surplus_forecast_model.pkl")
joblib.dump(model, model_path)
print(f"\n✅ Forecast model saved to: {model_path}")
