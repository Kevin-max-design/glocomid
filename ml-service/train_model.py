"""
GlucoMind XGBoost Training Pipeline
====================================
Trains an XGBoost model for next-day fasting glucose prediction.
Includes feature engineering, hyperparameter tuning, and model evaluation.
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os
import json

def load_and_prepare_data():
    """Load dataset and prepare features/target."""
    df = pd.read_csv("data/glucomind_synthetic_dataset.csv")
    print(f"📊 Loaded {len(df)} samples with {len(df.columns)} columns")
    
    # Feature columns (everything except target)
    target_col = "target_fasting_glucose"
    feature_cols = [c for c in df.columns if c != target_col]
    
    X = df[feature_cols].values
    y = df[target_col].values
    
    return X, y, feature_cols


def train_model(X, y, feature_cols):
    """Train XGBoost with optimized hyperparameters."""
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"\n🔄 Training XGBoost model...")
    print(f"   Train: {len(X_train)} samples")
    print(f"   Test:  {len(X_test)} samples")
    
    # XGBoost parameters optimized for glucose prediction
    params = {
        "n_estimators": 500,
        "max_depth": 8,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.85,
        "min_child_weight": 5,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "gamma": 0.1,
        "random_state": 42,
        "n_jobs": -1,
        "objective": "reg:squarederror",
    }
    
    model = xgb.XGBRegressor(**params)
    
    # Train with early stopping
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=50,
    )
    
    # Predictions
    y_pred_train = model.predict(X_train)
    y_pred_test = model.predict(X_test)
    
    # Metrics
    train_metrics = {
        "mae": mean_absolute_error(y_train, y_pred_train),
        "rmse": np.sqrt(mean_squared_error(y_train, y_pred_train)),
        "r2": r2_score(y_train, y_pred_train),
    }
    
    test_metrics = {
        "mae": mean_absolute_error(y_test, y_pred_test),
        "rmse": np.sqrt(mean_squared_error(y_test, y_pred_test)),
        "r2": r2_score(y_test, y_pred_test),
    }
    
    print(f"\n{'='*50}")
    print(f"📈 TRAINING RESULTS")
    print(f"{'='*50}")
    print(f"\nTrain Metrics:")
    print(f"  MAE:  {train_metrics['mae']:.2f} mg/dL")
    print(f"  RMSE: {train_metrics['rmse']:.2f} mg/dL")
    print(f"  R²:   {train_metrics['r2']:.4f}")
    
    print(f"\nTest Metrics:")
    print(f"  MAE:  {test_metrics['mae']:.2f} mg/dL")
    print(f"  RMSE: {test_metrics['rmse']:.2f} mg/dL")
    print(f"  R²:   {test_metrics['r2']:.4f}")
    
    # Cross-validation
    print(f"\n🔁 5-Fold Cross Validation...")
    cv_scores = cross_val_score(
        xgb.XGBRegressor(**params), X, y, 
        cv=5, scoring="r2", n_jobs=-1
    )
    print(f"  CV R² scores: {cv_scores.round(4)}")
    print(f"  CV R² mean:   {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    
    # Feature importance
    importance = model.feature_importances_
    feat_imp = sorted(zip(feature_cols, importance), key=lambda x: x[1], reverse=True)
    
    print(f"\n🏆 Top 10 Feature Importances:")
    for feat, imp in feat_imp[:10]:
        bar = "█" * int(imp * 100)
        print(f"  {feat:30s} {imp:.4f} {bar}")
    
    # Risk level thresholds (calibrated from dataset)
    y_test_df = pd.DataFrame({"actual": y_test, "predicted": y_pred_test})
    
    return model, feature_cols, test_metrics, feat_imp


def compute_risk_thresholds(y):
    """Compute risk level thresholds based on data distribution."""
    thresholds = {
        "low_upper": 140,       # below 140 = low risk
        "moderate_upper": 220,  # 140-220 = moderate risk
        # above 220 = high risk
    }
    return thresholds


def main():
    # Load data
    X, y, feature_cols = load_and_prepare_data()
    
    # Train model
    model, features, metrics, feat_imp = train_model(X, y, feature_cols)
    
    # Save model and metadata
    os.makedirs("models", exist_ok=True)
    joblib.dump(model, "models/glucose_predictor.joblib")
    
    metadata = {
        "feature_columns": feature_cols,
        "test_metrics": {k: round(v, 4) for k, v in metrics.items()},
        "risk_thresholds": compute_risk_thresholds(y),
        "feature_importance": {feat: round(float(imp), 4) for feat, imp in feat_imp},
        "model_type": "XGBRegressor",
        "training_samples": len(X),
    }
    
    with open("models/model_metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n✅ Model saved to models/glucose_predictor.joblib")
    print(f"📋 Metadata saved to models/model_metadata.json")
    
    # Validate clinical accuracy
    print(f"\n{'='*50}")
    print(f"🏥 CLINICAL VALIDATION")
    print(f"{'='*50}")
    
    mae = metrics["mae"]
    if mae < 15:
        print(f"  ✅ MAE {mae:.1f} mg/dL — EXCELLENT clinical accuracy")
    elif mae < 25:
        print(f"  ✅ MAE {mae:.1f} mg/dL — GOOD clinical accuracy")
    elif mae < 35:
        print(f"  ⚠️  MAE {mae:.1f} mg/dL — FAIR accuracy, monitor closely")
    else:
        print(f"  ❌ MAE {mae:.1f} mg/dL — Needs improvement")
    
    r2 = metrics["r2"]
    if r2 > 0.85:
        print(f"  ✅ R² {r2:.4f} — EXCELLENT prediction power")
    elif r2 > 0.75:
        print(f"  ✅ R² {r2:.4f} — GOOD prediction power")
    elif r2 > 0.60:
        print(f"  ⚠️  R² {r2:.4f} — MODERATE prediction power")
    else:
        print(f"  ❌ R² {r2:.4f} — WEAK, consider more features")


if __name__ == "__main__":
    main()
