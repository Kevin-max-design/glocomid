const express = require('express');
const ActivityLog = require('../models/ActivityLog');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/activity - Log activity
router.post('/', auth, async (req, res) => {
    try {
        const log = new ActivityLog({
            userId: req.userId,
            steps: req.body.steps,
            duration: req.body.duration || 0,
            activityType: req.body.activityType || 'walking',
            notes: req.body.notes || '',
            timestamp: req.body.timestamp || new Date(),
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/activity - Get activity logs
router.get('/', auth, async (req, res) => {
    try {
        const query = { userId: req.userId };
        if (req.query.from || req.query.to) {
            query.timestamp = {};
            if (req.query.from) query.timestamp.$gte = new Date(req.query.from);
            if (req.query.to) query.timestamp.$lte = new Date(req.query.to);
        }
        const logs = await ActivityLog.find(query).sort({ timestamp: -1 }).limit(parseInt(req.query.limit) || 100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/activity/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const log = await ActivityLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!log) return res.status(404).json({ error: 'Log not found' });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
