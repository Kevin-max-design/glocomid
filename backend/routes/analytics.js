const express = require('express');
const GlucoseLog = require('../models/GlucoseLog');
const InsulinLog = require('../models/InsulinLog');
const MealLog = require('../models/MealLog');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/analytics/summary - Dashboard summary
router.get('/summary', auth, async (req, res) => {
    try {
        const now = new Date();
        const last24h = new Date(now - 24 * 60 * 60 * 1000);
        const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

        // Glucose stats - last 7 days
        const glucoseLogs7d = await GlucoseLog.find({ userId: req.userId, timestamp: { $gte: last7d } });
        const glucoseValues7d = glucoseLogs7d.map(l => l.value);

        const glucoseStats = {
            count: glucoseValues7d.length,
            average: glucoseValues7d.length > 0 ? Math.round(glucoseValues7d.reduce((a, b) => a + b, 0) / glucoseValues7d.length) : 0,
            min: glucoseValues7d.length > 0 ? Math.min(...glucoseValues7d) : 0,
            max: glucoseValues7d.length > 0 ? Math.max(...glucoseValues7d) : 0,
            stdDev: glucoseValues7d.length > 1 ? Math.round(Math.sqrt(glucoseValues7d.reduce((acc, v) => acc + Math.pow(v - (glucoseValues7d.reduce((a, b) => a + b, 0) / glucoseValues7d.length), 2), 0) / glucoseValues7d.length)) : 0,
        };

        // Time in Range (TIR) calculation
        const targetLow = req.user.targetGlucoseLow || 70;
        const targetHigh = req.user.targetGlucoseHigh || 180;
        const inRange = glucoseValues7d.filter(v => v >= targetLow && v <= targetHigh).length;
        const below = glucoseValues7d.filter(v => v < targetLow).length;
        const above = glucoseValues7d.filter(v => v > targetHigh).length;

        const tir = {
            inRange: glucoseValues7d.length > 0 ? Math.round((inRange / glucoseValues7d.length) * 100) : 0,
            below: glucoseValues7d.length > 0 ? Math.round((below / glucoseValues7d.length) * 100) : 0,
            above: glucoseValues7d.length > 0 ? Math.round((above / glucoseValues7d.length) * 100) : 0,
        };

        // Insulin stats - last 24h
        const insulinLogs24h = await InsulinLog.find({ userId: req.userId, timestamp: { $gte: last24h } });
        const basalUnits = insulinLogs24h.filter(l => l.type === 'basal').reduce((sum, l) => sum + l.units, 0);
        const bolusUnits = insulinLogs24h.filter(l => l.type === 'bolus').reduce((sum, l) => sum + l.units, 0);

        const insulinStats = {
            totalBasal24h: Math.round(basalUnits * 10) / 10,
            totalBolus24h: Math.round(bolusUnits * 10) / 10,
            totalInsulin24h: Math.round((basalUnits + bolusUnits) * 10) / 10,
        };

        // Carb stats - last 24h
        const mealLogs24h = await MealLog.find({ userId: req.userId, timestamp: { $gte: last24h } });
        const totalCarbs24h = mealLogs24h.reduce((sum, l) => sum + l.carbs, 0);

        const carbStats = {
            totalCarbs24h: Math.round(totalCarbs24h),
            mealCount24h: mealLogs24h.length,
        };

        // Latest glucose reading
        const latestGlucose = await GlucoseLog.findOne({ userId: req.userId }).sort({ timestamp: -1 });

        res.json({
            glucoseStats,
            tir,
            insulinStats,
            carbStats,
            latestGlucose,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/glucose-trend - Glucose trend data for charts
router.get('/glucose-trend', auth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const logs = await GlucoseLog.find({ userId: req.userId, timestamp: { $gte: since } }).sort({ timestamp: 1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/analytics/daily-breakdown - Daily averages
router.get('/daily-breakdown', auth, async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const pipeline = [
            { $match: { userId: req.userId, timestamp: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    avgGlucose: { $avg: '$value' },
                    minGlucose: { $min: '$value' },
                    maxGlucose: { $max: '$value' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ];

        const result = await GlucoseLog.aggregate(pipeline);
        res.json(result.map(r => ({ ...r, avgGlucose: Math.round(r.avgGlucose) })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
