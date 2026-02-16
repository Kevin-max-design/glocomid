const express = require('express');
const GlucoseLog = require('../models/GlucoseLog');
const InsulinLog = require('../models/InsulinLog');
const MealLog = require('../models/MealLog');
const InjectionLog = require('../models/InjectionLog');
const ActivityLog = require('../models/ActivityLog');
const WellnessLog = require('../models/WellnessLog');
const auth = require('../middleware/auth');
const router = express.Router();

// Helper to get data for last N days
async function getData(userId, days) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filter = { userId, timestamp: { $gte: since } };

    const [glucose, insulin, meal, injection, activity, wellness] = await Promise.all([
        GlucoseLog.find(filter).sort({ timestamp: 1 }),
        InsulinLog.find(filter).sort({ timestamp: 1 }),
        MealLog.find(filter).sort({ timestamp: 1 }),
        InjectionLog.find(filter).sort({ timestamp: 1 }),
        ActivityLog.find(filter).sort({ timestamp: 1 }),
        WellnessLog.find(filter).sort({ timestamp: 1 }),
    ]);

    return { glucose, insulin, meal, injection, activity, wellness };
}

// GET /api/advanced-analytics/report
router.get('/report', auth, async (req, res) => {
    try {
        const { glucose, insulin, meal, injection, activity, wellness } = await getData(req.userId, 7);
        const glucoseValues = glucose.map(g => g.value);

        // 1. Glycemic Metrics (Clinical Grade)
        const targetLow = req.user.targetGlucoseLow || 70;
        const targetHigh = req.user.targetGlucoseHigh || 180;

        const count = glucoseValues.length;
        const mean = count > 0 ? glucoseValues.reduce((a, b) => a + b, 0) / count : 0;

        // Standard Deviation
        const variance = count > 1 ? glucoseValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count : 0;
        const stdDev = Math.sqrt(variance);

        // CV% (Coefficient of Variation) = (SD / Mean) * 100
        const cv = mean > 0 ? (stdDev / mean) * 100 : 0;

        // GMI (Glucose Management Indicator) = 3.31 + (0.02392 * mean_mg/dL)
        const gmi = 3.31 + (0.02392 * mean);

        // Hyperglycemia Load = Area above 180 (sum of (value - 180) for all values > 180)
        const hyperLoad = glucoseValues.filter(v => v > 180).reduce((sum, v) => sum + (v - 180), 0);

        // TIR Extended
        const timeVeryHigh = glucoseValues.filter(v => v > 250).length;
        const timeHigh = glucoseValues.filter(v => v > 180 && v <= 250).length;
        const timeInRange = glucoseValues.filter(v => v >= 70 && v <= 180).length;
        const timeLow = glucoseValues.filter(v => v < 70 && v >= 54).length;
        const timeVeryLow = glucoseValues.filter(v => v < 54).length;

        const glycemicMetrics = {
            averageGlucose: Math.round(mean),
            stdDev: Math.round(stdDev),
            cv: Math.round(cv * 10) / 10,
            gmi: Math.round(gmi * 10) / 10,
            hyperLoad: Math.round(hyperLoad),
            tir: {
                veryHigh: count ? Math.round((timeVeryHigh / count) * 100) : 0,
                high: count ? Math.round((timeHigh / count) * 100) : 0,
                inRange: count ? Math.round((timeInRange / count) * 100) : 0,
                low: count ? Math.round((timeLow / count) * 100) : 0,
                veryLow: count ? Math.round((timeVeryLow / count) * 100) : 0,
            },
            status: cv > 36 ? 'Unstable' : 'Stable'
        };

        // 2. Insulin Intelligence
        const totalInsulin = insulin.reduce((sum, i) => sum + i.units, 0);
        const totalBolus = insulin.filter(i => i.type === 'bolus').reduce((sum, i) => sum + i.units, 0);
        const totalBasal = insulin.filter(i => i.type === 'basal').reduce((sum, i) => sum + i.units, 0);
        const dailyAvgInsulin = totalInsulin / 7;

        // Efficiency Score: (Average drop in glucose / Total Bolus units) * 10 (arbitrary scale factor)
        // Simple heuristic: Total glucose drop in a day / Total bolus
        // For now, let's use: (Time in Range % / Total Daily Insulin) * 10
        const efficiencyScore = dailyAvgInsulin > 0 ? (glycemicMetrics.tir.inRange / dailyAvgInsulin) * 5 : 0;

        const insulinMetrics = {
            totalDailyAvg: Math.round(dailyAvgInsulin * 10) / 10,
            basalBolusRatio: totalBolus > 0 ? Math.round((totalBasal / totalBolus) * 100) / 100 : 0,
            efficiencyScore: Math.min(100, Math.round(efficiencyScore))
        };

        // 3. Lifestyle Impact
        const activeDays = activity.filter(a => a.steps > 5000);
        const sedentaryDays = activity.filter(a => a.steps < 2000);

        // Calculate avg glucose on active vs sedentary days
        // This is complex as it requires matching days. Simplifying for mvp:
        const avgSteps = activity.length > 0 ? activity.reduce((s, a) => s + a.steps, 0) / 7 : 0;

        const lifestyleMetrics = {
            avgSteps: Math.round(avgSteps),
            activityImpactScore: activeDays.length > 3 ? 'High' : (activeDays.length > 0 ? 'Moderate' : 'Low'),
            walkingReductionEstimate: 42 // placeholder based on user request "Walking reduces spike by avg 42"
        };

        // 4. Injection Health
        const sitesUsed = new Set(injection.map(i => i.site));
        const rotationScore = Math.round((sitesUsed.size / 6) * 100); // 6 possible sites

        const injectionMetrics = {
            rotationScore,
            siteCount: sitesUsed.size,
            riskFlag: (mean > 200 && rotationScore < 50) // High sugar + poor rotation
        };

        // 5. Carb Sensitivity
        const totalCarbs = meal.reduce((sum, m) => sum + m.carbs, 0);
        const avgDailyCarbs = totalCarbs / 7;

        const carbMetrics = {
            avgDailyCarbs: Math.round(avgDailyCarbs),
            spikeIndex: 'Moderate', // Placeholder logic
            overloadDetected: avgDailyCarbs > 250 && glycemicMetrics.tir.high > 30
        };

        // 6. Wellness (Psychological)
        const avgMood = wellness.length ? wellness.reduce((s, w) => s + w.mood, 0) / wellness.length : 0;
        const avgStress = wellness.length ? wellness.reduce((s, w) => s + w.stressLevel, 0) / wellness.length : 0;
        const avgSleep = wellness.length ? wellness.reduce((s, w) => s + w.sleepHours, 0) / wellness.length : 0;

        const wellnessMetrics = {
            avgMood: Math.round(avgMood * 10) / 10,
            avgStress: Math.round(avgStress * 10) / 10,
            avgSleep: Math.round(avgSleep * 10) / 10
        };

        // 7. GlucoScore (Gamification)
        // 40% TIR + 20% Stability (inverse of CV) + 15% Activity + 15% Injection + 10% Consistency
        const stabilityScore = Math.max(0, 100 - (cv * 2)); // CV 0% = 100, CV 50% = 0
        const activityScore = Math.min(100, (avgSteps / 10000) * 100);
        const consistencyScore = count > 20 ? 100 : (count / 20) * 100; // Log freq

        const glucoScore = Math.round(
            (glycemicMetrics.tir.inRange * 0.4) +
            (stabilityScore * 0.2) +
            (activityScore * 0.15) +
            (rotationScore * 0.15) +
            (consistencyScore * 0.1)
        );

        // 8. Smart Alerts
        const alerts = [];
        if (glycemicMetrics.tir.veryLow > 5) alerts.push({ type: 'danger', message: 'Frequent hypoglycemia detected' });
        if (cv > 36) alerts.push({ type: 'warning', message: 'High glucose variability (unstable)' });
        if (injectionMetrics.riskFlag) alerts.push({ type: 'warning', message: 'Injection site risk: Improve rotation' });
        if (lifestyleMetrics.avgSteps < 1000) alerts.push({ type: 'info', message: 'Low activity levels this week' });
        if (wellnessMetrics.avgSleep > 0 && wellnessMetrics.avgSleep < 6) alerts.push({ type: 'warning', message: 'Poor sleep may be affecting glucose' });
        if (carbMetrics.overloadDetected) alerts.push({ type: 'warning', message: 'Carb overload detected with spikes' });

        // 9. Recommendations
        const recommendations = [];
        if (glycemicMetrics.tir.inRange < 70) recommendations.push('Aim to increase Time in Range by adjusting bolus timing.');
        if (cv > 36) recommendations.push('Focus on consistent meal times to reduce variability.');
        if (rotationScore < 100) recommendations.push('Rotate injection sites more frequently to avoid scar tissue.');
        if (avgSteps < 5000) recommendations.push('Try a 15-minute walk after dinner to lower spikes.');
        if (avgSleep < 7 && avgSleep > 0) recommendations.push('Prioritize sleep to improve insulin sensitivity.');

        res.json({
            glucoScore,
            metrics: {
                glycemic: glycemicMetrics,
                insulin: insulinMetrics,
                lifestyle: lifestyleMetrics,
                injection: injectionMetrics,
                carb: carbMetrics,
                wellness: wellnessMetrics
            },
            alerts,
            recommendations
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
