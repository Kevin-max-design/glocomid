const express = require('express');
const axios = require('axios');
const GlucoseLog = require('../models/GlucoseLog');
const InsulinLog = require('../models/InsulinLog');
const MealLog = require('../models/MealLog');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/predict - Get ML prediction
router.post('/', auth, async (req, res) => {
    try {
        const now = new Date();
        const last24h = new Date(now - 24 * 60 * 60 * 1000);

        // Gather last 24h data
        const glucoseLogs = await GlucoseLog.find({ userId: req.userId, timestamp: { $gte: last24h } }).sort({ timestamp: 1 });
        const insulinLogs = await InsulinLog.find({ userId: req.userId, timestamp: { $gte: last24h } });
        const mealLogs = await MealLog.find({ userId: req.userId, timestamp: { $gte: last24h } });

        const glucoseValues = glucoseLogs.map(l => l.value);
        const lastGlucose = glucoseValues.length > 0 ? glucoseValues[glucoseValues.length - 1] : 120;

        // Calculate rate of change
        let rateOfChange = 0;
        if (glucoseValues.length >= 2) {
            const lastTwo = glucoseValues.slice(-2);
            const lastTwoTimes = glucoseLogs.slice(-2).map(l => l.timestamp.getTime());
            const timeDiffHours = (lastTwoTimes[1] - lastTwoTimes[0]) / (1000 * 60 * 60);
            rateOfChange = timeDiffHours > 0 ? (lastTwo[1] - lastTwo[0]) / timeDiffHours : 0;
        }

        const totalBasal = insulinLogs.filter(l => l.type === 'basal').reduce((s, l) => s + l.units, 0);
        const totalBolus = insulinLogs.filter(l => l.type === 'bolus').reduce((s, l) => s + l.units, 0);
        const totalCarbs = mealLogs.reduce((s, l) => s + l.carbs, 0);

        const hour = now.getHours();

        // Build feature vector for ML service
        const features = {
            glucose_mean_24h: glucoseValues.length > 0 ? glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length : 120,
            glucose_std_24h: glucoseValues.length > 1 ? Math.sqrt(glucoseValues.reduce((acc, v, _, arr) => acc + Math.pow(v - arr.reduce((a, b) => a + b, 0) / arr.length, 2), 0) / glucoseValues.length) : 0,
            glucose_min_24h: glucoseValues.length > 0 ? Math.min(...glucoseValues) : 120,
            glucose_max_24h: glucoseValues.length > 0 ? Math.max(...glucoseValues) : 120,
            last_glucose: lastGlucose,
            glucose_rate_of_change: rateOfChange,
            total_basal_24h: totalBasal,
            total_bolus_24h: totalBolus,
            total_insulin_24h: totalBasal + totalBolus,
            total_carbs_24h: totalCarbs,
            hour_sin: Math.sin(2 * Math.PI * hour / 24),
            hour_cos: Math.cos(2 * Math.PI * hour / 24),
            basal_dose: req.user.basalDose || 0,
            icr: req.user.insulinToCarbRatio || 10,
            isf: req.user.insulinSensitivityFactor || 50,
            reading_count_24h: glucoseValues.length,
        };

        // Call Python ML service
        const mlResponse = await axios.post(`${process.env.ML_SERVICE_URL}/predict`, features, { timeout: 10000 });

        res.json(mlResponse.data);
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            // Fallback: basic rule-based prediction if ML service is down
            const fallback = generateFallbackPrediction(req);
            return res.json({ ...fallback, source: 'fallback' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Basic fallback prediction if ML service is unavailable
function generateFallbackPrediction(req) {
    const lastGlucose = 120; // default
    let risk_level = 'low';
    let pattern_insight = 'ML service unavailable. Showing rule-based estimate.';

    if (lastGlucose > 250) {
        risk_level = 'high';
        pattern_insight = 'Glucose is elevated. Consider checking insulin coverage.';
    } else if (lastGlucose > 180) {
        risk_level = 'moderate';
        pattern_insight = 'Glucose is above target range. Monitor closely.';
    }

    return { predicted_glucose: lastGlucose, risk_level, pattern_insight };
}

module.exports = router;
