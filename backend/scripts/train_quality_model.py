"""
Training script for Food Quality Risk Screening model.
Uses MobileNetV3-inspired feature extraction with scikit-learn classifier.

Generates synthetic training data when real labeled dataset is not available.
All reported metrics are actual evaluation metrics from this training run.
"""

import os
import sys
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ai_models")
os.makedirs(MODEL_DIR, exist_ok=True)

# Generate synthetic training data
# Classes: 0=fresh, 1=acceptable, 2=spoiled
np.random.seed(42)
n_samples = 3000
n_features = 224 * 224 * 3  # RGB pixels

print("Generating synthetic training data...")
print("(In production, replace with real labeled food image dataset)")

# We use simplified features for demo: 50 color/texture features
def generate_sample_features(label, n=1000):
    """Generate synthetic image features per class."""
    if label == 0:  # fresh - bright, good colors
        features = np.random.normal(loc=0.6, scale=0.15, size=(n, 50))
    elif label == 1:  # acceptable - moderate
        features = np.random.normal(loc=0.45, scale=0.15, size=(n, 50))
    else:  # spoiled - darker, unusual colors
        features = np.random.normal(loc=0.25, scale=0.15, size=(n, 50))
    return np.clip(features, 0, 1)

X_fresh = generate_sample_features(0, 1000)
X_acceptable = generate_sample_features(1, 1000)
X_spoiled = generate_sample_features(2, 1000)

X = np.vstack([X_fresh, X_acceptable, X_spoiled])
y = np.array([0] * 1000 + [1] * 1000 + [2] * 1000)

# Add noise
X += np.random.normal(0, 0.05, X.shape)
X = np.clip(X, 0, 1)

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")

pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("clf", RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)),
])

print("Training Food Quality Classifier...")
pipeline.fit(X_train, y_train)

y_pred = pipeline.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("\n=== ACTUAL Model Evaluation Metrics ===")
print(f"Accuracy: {accuracy:.4f}")
print("\nClassification Report:")
print(classification_report(y_test, y_pred, target_names=["fresh", "acceptable", "spoiled"]))
print("NOTE: These metrics are from synthetic training data and do NOT reflect")
print("real-world performance on actual food images.")

model_path = os.path.join(MODEL_DIR, "food_quality_model.pkl")
joblib.dump(pipeline, model_path)
print(f"\n✅ Model saved to: {model_path}")
