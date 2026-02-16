const express = require('express');
const InjectionLog = require('../models/InjectionLog');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/injections
router.post('/', auth, async (req, res) => {
    try {
        const log = new InjectionLog({
            userId: req.userId,
            site: req.body.site,
            timestamp: req.body.timestamp || new Date(),
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/injections - Get injection history
router.get('/', auth, async (req, res) => {
    try {
        const logs = await InjectionLog.find({ userId: req.userId }).sort({ timestamp: -1 }).limit(parseInt(req.query.limit) || 100);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/injections/summary - Get site usage summary
router.get('/summary', auth, async (req, res) => {
    try {
        const sites = ['abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'arm_left', 'arm_right'];
        const summary = {};

        for (const site of sites) {
            const lastUsed = await InjectionLog.findOne({ userId: req.userId, site }).sort({ timestamp: -1 });
            const usageCount = await InjectionLog.countDocuments({ userId: req.userId, site });

            let daysSinceLastUse = null;
            let status = 'ready';

            if (lastUsed) {
                daysSinceLastUse = Math.floor((Date.now() - lastUsed.timestamp.getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceLastUse === 0) status = 'used_today';
                else if (daysSinceLastUse <= 3) status = 'recent';
                else status = 'ready';
            }

            summary[site] = { lastUsed: lastUsed?.timestamp || null, usageCount, daysSinceLastUse, status };
        }

        // Recommend next site (longest since last use)
        const readySites = Object.entries(summary)
            .filter(([_, v]) => v.status === 'ready' || v.daysSinceLastUse === null)
            .sort((a, b) => (b[1].daysSinceLastUse || 999) - (a[1].daysSinceLastUse || 999));

        const recommended = readySites.length > 0 ? readySites[0][0] : sites[0];

        res.json({ sites: summary, recommended });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/injections/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        const log = await InjectionLog.findOneAndDelete({ _id: req.params.id, userId: req.userId });
        if (!log) return res.status(404).json({ error: 'Log not found' });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
