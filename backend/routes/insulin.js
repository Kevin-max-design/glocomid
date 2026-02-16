const express = require('express');
const InsulinLog = require('../models/InsulinLog');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/insulin
router.post('/', auth, async (req, res) => {
    try {
        const log = new InsulinLog({
            userId: req.userId,
            type: req.body.type,
            units: req.body.units,
            notes: req.body.notes || '',
            timestamp: req.body.timestamp || new Date(),
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/insulin
router.get('/', auth, async (req, res) => {
    try {
        const query = { userId: req.userId };
        if (req.query.from || req.query.to) {
            query.timestamp = {};
            if (req.query.from) query.timestamp.$gte = new Date(req.query.from);
            if (req.query.to) query.timestamp.$lte = new Date(req.query.to);
        }
        if (req.query.type) query.type = req.query.type;
        const logs = await InsulinLog.find(query).sort({ timestamp: -1 }).limit(parseInt(req.query.limit) || 200);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/insulin/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const log = await InsulinLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!log) return res.status(404).json({ error: 'Log not found' });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
