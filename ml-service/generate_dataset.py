"""
GlucoMind Synthetic T1D Dataset Generator v2
=============================================
Improved version with stronger physiological correlations.

Key improvements:
- Fasting glucose directly driven by overnight insulin coverage, bedtime glucose,
  dawn phenomenon, and carb-insulin balance
- More realistic glucose trajectories with proper carry-over between days
- Better noise calibration
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import os

np.random.seed(42)

SITES = ["abdomen_left", "abdomen_right", "thigh_left", "thigh_right", "arm_left", "arm_right"]


def generate_patient():
    """Generate a virtual T1D patient."""
    basal_need = np.random.uniform(12, 32)  # actual physiological basal need
    return {
        "age": np.random.randint(18, 36),
        "weight": np.random.normal(70, 12),
        "icr": np.random.uniform(6, 18),
        "isf": np.random.uniform(25, 70),
        "basal_dose": basal_need * np.random.uniform(0.7, 1.3),  # prescribed dose (may not match need)
        "basal_need": basal_need,
        "dawn_strength": np.random.uniform(0.0, 1.8),
        "carb_sensitivity": np.random.uniform(0.7, 1.4),
        "insulin_sensitivity": np.random.uniform(0.7, 1.3),
        "baseline_glucose": np.random.uniform(95, 155),
    }


def simulate_patient_days(patient, n_days=30):
    """Simulate multiple days for a patient with proper carry-over relationships."""
    rows = []
    
    prev_bedtime_glucose = patient["baseline_glucose"]
    
    for day in range(n_days):
        # === SIMULATE TODAY'S DATA ===
        
        # Meals
        meals = []
        total_carbs = 0
        meal_count = 0
        
        for meal_type, prob, hr_range, carb_range in [
            ("breakfast", 0.9, (6.5, 9.5), (25, 80)),
            ("lunch",     0.95, (11.5, 14.0), (35, 95)),
            ("dinner",    0.95, (18.0, 21.0), (40, 110)),
            ("snack",     0.5, (10, 22), (10, 35)),
        ]:
            if np.random.random() < prob:
                hr = np.random.uniform(*hr_range)
                carbs = np.random.uniform(*carb_range)
                meals.append({"hour": hr, "carbs": carbs, "type": meal_type})
                total_carbs += carbs
                meal_count += 1
        
        # Bolus insulin for meals
        total_bolus = 0
        for meal in meals:
            if np.random.random() > 0.05:  # 5% miss rate
                dose_accuracy = np.random.uniform(0.6, 1.4)
                bolus = meal["carbs"] / patient["icr"] * dose_accuracy
                total_bolus += bolus
        
        # Basal insulin
        missed_basal = np.random.random() < 0.03
        basal_taken = 0 if missed_basal else patient["basal_dose"]
        total_insulin = total_bolus + basal_taken
        
        # === SIMULATE GLUCOSE TRAJECTORY ===
        
        # Generate realistic glucose readings throughout the day
        reading_times = sorted(set([
            np.random.uniform(6.5, 8.0),    # fasting
            np.random.uniform(11.5, 12.5),  # pre-lunch
            np.random.uniform(13.5, 15.0),  # post-lunch
            np.random.uniform(17.5, 18.5),  # pre-dinner
            np.random.uniform(20.0, 21.5),  # post-dinner
            np.random.uniform(21.5, 23.0),  # bedtime
        ] + [np.random.uniform(8, 22) for _ in range(np.random.randint(0, 3))]))
        
        # Fasting glucose is driven by:
        # 1. Previous bedtime glucose
        # 2. Overnight basal coverage (prescribed vs needed)
        # 3. Dawn phenomenon
        # 4. Random physiological noise
        
        basal_coverage_ratio = basal_taken / max(patient["basal_need"], 1)
        overnight_insulin_effect = (basal_coverage_ratio - 1.0) * patient["isf"] * 0.4
        dawn_effect = patient["dawn_strength"] * np.random.uniform(15, 45)
        
        fasting_glucose = (
            prev_bedtime_glucose
            - overnight_insulin_effect   # adequate basal pulls glucose down
            + dawn_effect                # dawn phenomenon pushes up
            + np.random.normal(0, 8)     # noise
        )
        fasting_glucose = np.clip(fasting_glucose, 40, 450)
        
        # Generate other readings based on meals and insulin
        glucose_readings = [fasting_glucose]
        current_glucose = fasting_glucose
        
        for i, t in enumerate(reading_times):
            if i == 0:
                glucose_readings.append(fasting_glucose + np.random.normal(0, 5))
                current_glucose = glucose_readings[-1]
                continue
            
            # Check if a meal happened before this reading
            meal_impact = 0
            for meal in meals:
                hours_after = t - meal["hour"]
                if 0.5 < hours_after < 4:
                    # Post-meal spike, modulated by insulin coverage
                    spike = meal["carbs"] * patient["carb_sensitivity"] * np.random.uniform(0.5, 1.5)
                    bolus_effect = (meal["carbs"] / patient["icr"]) * patient["isf"] * 0.5
                    meal_impact += spike - bolus_effect
            
            # Basal effect (continuous)
            basal_pull = (basal_coverage_ratio - 0.5) * 2 * np.random.uniform(0, 3)
            
            current_glucose = current_glucose + meal_impact - basal_pull + np.random.normal(0, 10)
            current_glucose = np.clip(current_glucose, 40, 500)
            glucose_readings.append(current_glucose)
        
        # Ensure we have readings
        if len(glucose_readings) < 2:
            glucose_readings = [fasting_glucose, fasting_glucose + np.random.normal(0, 10)]
        
        glucose_values = np.array(glucose_readings)
        bedtime_glucose = glucose_values[-1]
        
        # === COMPUTE FEATURES FOR THIS DAY ===
        glucose_mean = np.mean(glucose_values)
        glucose_std = np.std(glucose_values) if len(glucose_values) > 1 else 0
        glucose_min = np.min(glucose_values)
        glucose_max = np.max(glucose_values)
        last_glucose = glucose_values[-1]
        
        # Rate of change (last two readings)
        if len(glucose_values) >= 2 and len(reading_times) >= 2:
            time_diff = max(reading_times[-1] - reading_times[-2], 0.1)
            roc = (glucose_values[-1] - glucose_values[-2]) / time_diff
        else:
            roc = 0
        
        last_hour = reading_times[-1] if reading_times else 22
        hour_sin = np.sin(2 * np.pi * last_hour / 24)
        hour_cos = np.cos(2 * np.pi * last_hour / 24)
        
        # Evening metrics
        evening_readings = [g for t, g in zip(reading_times, glucose_readings[1:]) if t >= 18]
        evening_mean = np.mean(evening_readings) if evening_readings else glucose_mean
        evening_trend = (evening_readings[-1] - evening_readings[0]) if len(evening_readings) >= 2 else 0
        
        # === COMPUTE NEXT DAY'S FASTING (TARGET) ===
        # This is the real physiological model:
        
        next_basal_taken = patient["basal_dose"] if np.random.random() > 0.03 else 0
        next_basal_ratio = next_basal_taken / max(patient["basal_need"], 1)
        next_overnight_effect = (next_basal_ratio - 1.0) * patient["isf"] * 0.4
        next_dawn = patient["dawn_strength"] * np.random.uniform(15, 45)
        
        target_fasting = (
            bedtime_glucose
            - next_overnight_effect
            + next_dawn
            + np.random.normal(0, 8)
        )
        target_fasting = np.clip(target_fasting, 40, 450)
        
        # Build row
        row = {
            "glucose_mean_24h": round(float(glucose_mean), 1),
            "glucose_std_24h": round(float(glucose_std), 1),
            "glucose_min_24h": round(float(glucose_min), 1),
            "glucose_max_24h": round(float(glucose_max), 1),
            "last_glucose": round(float(last_glucose), 1),
            "glucose_rate_of_change": round(float(roc), 2),
            "total_basal_24h": round(float(basal_taken), 1),
            "total_bolus_24h": round(float(total_bolus), 1),
            "total_insulin_24h": round(float(total_insulin), 1),
            "total_carbs_24h": round(float(total_carbs), 1),
            "hour_sin": round(float(hour_sin), 4),
            "hour_cos": round(float(hour_cos), 4),
            "basal_dose": round(float(patient["basal_dose"]), 1),
            "icr": round(float(patient["icr"]), 1),
            "isf": round(float(patient["isf"]), 1),
            "reading_count_24h": len(glucose_readings),
            "bedtime_glucose": round(float(bedtime_glucose), 1),
            "evening_mean_glucose": round(float(evening_mean), 1),
            "evening_glucose_trend": round(float(evening_trend), 1),
            "meal_count": meal_count,
            "target_fasting_glucose": round(float(target_fasting), 1),
        }
        rows.append(row)
        
        # Carry over
        prev_bedtime_glucose = bedtime_glucose
    
    return rows


def main():
    n_patients = 250
    days_per_patient = 35
    
    print(f"🧬 Generating v2 synthetic T1D dataset: {n_patients} patients × {days_per_patient} days...")
    
    all_rows = []
    for p_idx in range(n_patients):
        patient = generate_patient()
        rows = simulate_patient_days(patient, days_per_patient)
        all_rows.extend(rows)
        
        if (p_idx + 1) % 50 == 0:
            print(f"  Patient {p_idx + 1}/{n_patients}...")
    
    df = pd.DataFrame(all_rows)
    
    # Derived features
    df["insulin_carb_ratio_actual"] = (df["total_insulin_24h"] / df["total_carbs_24h"].clip(lower=1)).round(3)
    df["glucose_range_24h"] = df["glucose_max_24h"] - df["glucose_min_24h"]
    df["glucose_cv"] = (df["glucose_std_24h"] / df["glucose_mean_24h"].clip(lower=1) * 100).round(1)
    
    os.makedirs("data", exist_ok=True)
    df.to_csv("data/glucomind_synthetic_dataset.csv", index=False)
    
    print(f"\n✅ Dataset generated: {len(df)} samples")
    print(f"📊 Features: {len(df.columns) - 1} input + 1 target")
    print(f"💾 Saved to data/glucomind_synthetic_dataset.csv")
    
    print(f"\n--- Target Statistics ---")
    print(f"  Mean:   {df['target_fasting_glucose'].mean():.1f} mg/dL")
    print(f"  Std:    {df['target_fasting_glucose'].std():.1f} mg/dL")
    print(f"  Min:    {df['target_fasting_glucose'].min():.1f} mg/dL")
    print(f"  Max:    {df['target_fasting_glucose'].max():.1f} mg/dL")
    
    # Check correlations
    print(f"\n--- Key Correlations with Target ---")
    target = "target_fasting_glucose"
    key_features = ["bedtime_glucose", "last_glucose", "evening_mean_glucose", 
                     "glucose_mean_24h", "total_basal_24h", "basal_dose", "total_carbs_24h"]
    for feat in key_features:
        corr = df[feat].corr(df[target])
        print(f"  {feat:30s} r={corr:.3f}")


if __name__ == "__main__":
    main()
