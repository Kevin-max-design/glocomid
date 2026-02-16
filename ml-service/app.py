"""
GlucoMind ML API — FastAPI Microservice
========================================
Serves glucose predictions, risk assessments, and pattern insights.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy as np
import joblib
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="GlucoMind ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model and metadata at startup
MODEL = None
METADATA = None

@app.on_event("startup")
def load_model():
    global MODEL, METADATA
    model_path = os.path.join(os.path.dirname(__file__), "models", "glucose_predictor.joblib")
    meta_path = os.path.join(os.path.dirname(__file__), "models", "model_metadata.json")
    
    if os.path.exists(model_path):
        MODEL = joblib.load(model_path)
        print("✅ Model loaded successfully")
    else:
        print("⚠️  No trained model found. Run train_model.py first.")
    
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            METADATA = json.load(f)
        print("✅ Metadata loaded successfully")


class PredictionInput(BaseModel):
    glucose_mean_24h: float = 120
    glucose_std_24h: float = 30
    glucose_min_24h: float = 80
    glucose_max_24h: float = 200
    last_glucose: float = 130
    glucose_rate_of_change: float = 0
    total_basal_24h: float = 20
    total_bolus_24h: float = 15
    total_insulin_24h: float = 35
    total_carbs_24h: float = 200
    hour_sin: float = 0
    hour_cos: float = 1
    basal_dose: float = 20
    icr: float = 10
    isf: float = 50
    reading_count_24h: int = 6


class PredictionOutput(BaseModel):
    predicted_glucose: float
    risk_level: str
    pattern_insight: str
    confidence: str
    dawn_phenomenon_flag: bool = False


def classify_risk(glucose_value: float) -> str:
    """Classify risk level based on predicted glucose."""
    if glucose_value < 70:
        return "high"  # hypoglycemia risk
    elif glucose_value < 140:
        return "low"
    elif glucose_value < 220:
        return "moderate"
    else:
        return "high"


def detect_dawn_phenomenon(input_data: PredictionInput, predicted: float) -> bool:
    """Detect possible dawn phenomenon pattern."""
    # Rule: if bedtime glucose was reasonable but predicted fasting is high
    evening_ok = input_data.last_glucose < 180
    fasting_high = predicted > 200
    return evening_ok and fasting_high


def generate_insight(input_data: PredictionInput, predicted: float, risk: str, dawn_flag: bool) -> str:
    """Generate human-readable clinical insight."""
    insights = []
    
    if dawn_flag:
        insights.append("⚠️ Possible dawn phenomenon detected. Consider adjusting basal insulin timing or dose.")
    
    if risk == "high" and predicted > 250:
        if input_data.total_carbs_24h > 300:
            insights.append("High carb intake yesterday may be contributing to elevated glucose.")
        if input_data.total_bolus_24h < 10:
            insights.append("Low bolus insulin coverage. Review carb-to-insulin ratio.")
        if input_data.total_basal_24h < 10:
            insights.append("Insufficient basal coverage. Consider basal dose adjustment.")
    
    if risk == "high" and predicted < 70:
        insights.append("⚠️ Hypoglycemia risk. Consider reducing overnight insulin or having a bedtime snack.")
    
    if risk == "moderate":
        if predicted > 180:
            insights.append("Glucose trending above target. Monitor and adjust as needed.")
        if input_data.glucose_std_24h > 60:
            insights.append("High glucose variability detected. Focus on consistent meal timing and insulin dosing.")
    
    if risk == "low":
        insights.append("✅ Glucose is well-controlled. Keep up the great management!")
    
    if input_data.glucose_max_24h - input_data.glucose_min_24h > 200:
        insights.append("Large glucose swings observed. Consider spreading carb intake across meals.")
    
    if not insights:
        insights.append("Continue monitoring glucose levels and maintaining regular insulin schedule.")
    
    return " ".join(insights)


@app.post("/predict", response_model=PredictionOutput)
async def predict(input_data: PredictionInput):
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")
    
    # Build feature vector in same order as training
    feature_cols = METADATA["feature_columns"]
    
    # Build input dict with computed derived features
    input_dict = input_data.dict()
    
    # Add derived features that were computed during training
    input_dict["bedtime_glucose"] = input_data.last_glucose  # approximation
    input_dict["evening_mean_glucose"] = input_data.glucose_mean_24h  # approximation
    input_dict["evening_glucose_trend"] = input_data.glucose_rate_of_change * 2  # approximation
    input_dict["meal_count"] = max(1, int(input_data.total_carbs_24h / 60))  # estimated meals
    input_dict["insulin_carb_ratio_actual"] = (
        input_data.total_insulin_24h / max(input_data.total_carbs_24h, 1)
    )
    input_dict["glucose_range_24h"] = input_data.glucose_max_24h - input_data.glucose_min_24h
    input_dict["glucose_cv"] = (
        input_data.glucose_std_24h / max(input_data.glucose_mean_24h, 1) * 100
    )
    
    # Create feature array in correct order
    features = []
    for col in feature_cols:
        features.append(float(input_dict.get(col, 0)))
    
    X = np.array([features])
    predicted_glucose = float(MODEL.predict(X)[0])
    predicted_glucose = round(max(30, min(500, predicted_glucose)), 1)
    
    # Risk assessment
    risk_level = classify_risk(predicted_glucose)
    
    # Dawn phenomenon detection
    dawn_flag = detect_dawn_phenomenon(input_data, predicted_glucose)
    
    # Pattern insight
    pattern_insight = generate_insight(input_data, predicted_glucose, risk_level, dawn_flag)
    
    # Confidence assessment
    if input_data.reading_count_24h >= 6:
        confidence = "high"
    elif input_data.reading_count_24h >= 3:
        confidence = "medium"
    else:
        confidence = "low"
    
    return PredictionOutput(
        predicted_glucose=predicted_glucose,
        risk_level=risk_level,
        pattern_insight=pattern_insight,
        confidence=confidence,
        dawn_phenomenon_flag=dawn_flag,
    )


class AdvancedPredictionInput(BaseModel):
    glucose_values_7d: list[float]  # List of all glucose values from last 7 days
    insulin_total_7d: float
    carbs_total_7d: float
    avg_sleep_7d: float = 7.0
    avg_steps_7d: float = 5000


@app.post("/advanced-predict")
async def advanced_predict(data: AdvancedPredictionInput):
    """
    Generate predictive risk metrics based on 7-day history.
    Uses heuristic models since we don't have training data for these specific risks yet.
    """
    # 1. 24hr Hyperglycemia Risk
    # Risk increases if recents are high or trend is rising
    recent_avg = np.mean(data.glucose_values_7d[-10:]) if data.glucose_values_7d else 120
    hyper_risk = 0
    if recent_avg > 180: hyper_risk += 40
    if recent_avg > 250: hyper_risk += 30
    if data.carbs_total_7d / 7 > 250: hyper_risk += 20
    hyper_risk = min(95, hyper_risk + 5)  # Baseline 5%

    # 2. Night Hypoglycemia Risk
    # Risk increases if variability is high or recent lows occurred
    lows_count = sum(1 for v in data.glucose_values_7d if v < 70)
    hypo_risk = 0
    if lows_count > 2: hypo_risk += 50
    if lows_count > 0: hypo_risk += 20
    if data.insulin_total_7d / 7 > 50: hypo_risk += 15  # High insulin load
    hypo_risk = min(95, max(1, hypo_risk))

    # 3. 3-Day Trend Direction
    # Linear regression slope on last 3 days of data
    if len(data.glucose_values_7d) >= 10:
        recent_values = data.glucose_values_7d[-20:] # Approx last 2-3 days
        slope = np.polyfit(range(len(recent_values)), recent_values, 1)[0]
        if slope > 1.5: trend = "Rapidly Rising ↗️"
        elif slope > 0.5: trend = "Slowly Rising ↗️"
        elif slope < -1.5: trend = "Rapidly Falling ↘️"
        elif slope < -0.5: trend = "Slowly Falling ↘️"
        else: trend = "Stable ➡️"
    else:
        trend = "Insufficient Data"

    # 4. Insulin Resistance Trend
    # Proxy: Avg daily insulin / Avg daily glucose
    # If ratio increases, resistance might be increasing
    resistance_trend = "Stable"
    if data.insulin_total_7d > 350 and np.mean(data.glucose_values_7d) > 180:
        resistance_trend = "Increasing ⚠️"
    
    return {
        "hyper_risk_24h": round(hyper_risk),
        "hypo_risk_night": round(hypo_risk),
        "trend_3day": trend,
        "insulin_resistance_trend": resistance_trend
    }



@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": MODEL is not None,
        "service": "GlucoMind ML Service",
    }


@app.get("/model-info")
async def model_info():
    if METADATA is None:
        return {"error": "No metadata available"}
    return {
        "model_type": METADATA.get("model_type"),
        "training_samples": METADATA.get("training_samples"),
        "test_metrics": METADATA.get("test_metrics"),
        "top_features": dict(list(METADATA.get("feature_importance", {}).items())[:10]),
    }
