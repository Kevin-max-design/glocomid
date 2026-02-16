const express = require('express');
const MealLog = require('../models/MealLog');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/meals
router.post('/', auth, async (req, res) => {
    try {
        const log = new MealLog({
            userId: req.userId,
            carbs: req.body.carbs,
            mealType: req.body.mealType || 'snack',
            description: req.body.description || '',
            timestamp: req.body.timestamp || new Date(),
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/meals
router.get('/', auth, async (req, res) => {
    try {
        const query = { userId: req.userId };
        if (req.query.from || req.query.to) {
            query.timestamp = {};
            if (req.query.from) query.timestamp.$gte = new Date(req.query.from);
            if (req.query.to) query.timestamp.$lte = new Date(req.query.to);
        }
        const logs = await MealLog.find(query).sort({ timestamp: -1 }).limit(parseInt(req.query.limit) || 200);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/meals/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const log = await MealLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!log) return res.status(404).json({ error: 'Log not found' });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
