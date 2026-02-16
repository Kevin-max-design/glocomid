const express = require('express');
const GlucoseLog = require('../models/GlucoseLog');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/glucose - Log a glucose reading
router.post('/', auth, async (req, res) => {
    try {
        const log = new GlucoseLog({
            userId: req.userId,
            value: req.body.value,
            type: req.body.type || 'random',
            notes: req.body.notes || '',
            timestamp: req.body.timestamp || new Date(),
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glucose - Get all glucose logs (with optional date range)
router.get('/', auth, async (req, res) => {
    try {
        const query = { userId: req.userId };
        if (req.query.from || req.query.to) {
            query.timestamp = {};
            if (req.query.from) query.timestamp.$gte = new Date(req.query.from);
            if (req.query.to) query.timestamp.$lte = new Date(req.query.to);
        }
        const logs = await GlucoseLog.find(query).sort({ timestamp: -1 }).limit(parseInt(req.query.limit) || 200);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/glucose/latest - Get latest reading
router.get('/latest', auth, async (req, res) => {
    try {
        const log = await GlucoseLog.findOne({ userId: req.userId }).sort({ timestamp: -1 });
        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/glucose/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const log = await GlucoseLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!log) return res.status(404).json({ error: 'Log not found' });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
