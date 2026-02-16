const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, age, weight, insulinToCarbRatio, insulinSensitivityFactor, basalDose } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        const user = new User({
            email, password, name, age, weight,
            insulinToCarbRatio: insulinToCarbRatio || 10,
            insulinSensitivityFactor: insulinSensitivityFactor || 50,
            basalDose: basalDose || 0,
        });

        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(201).json({ user, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ user, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    res.json(req.user);
});

// PUT /api/auth/profile
router.put('/profile', auth, async (req, res) => {
    try {
        const updates = ['name', 'age', 'weight', 'insulinToCarbRatio', 'insulinSensitivityFactor', 'basalDose', 'targetGlucoseLow', 'targetGlucoseHigh'];
        updates.forEach(field => {
            if (req.body[field] !== undefined) {
                req.user[field] = req.body[field];
            }
        });
        await req.user.save();
        res.json(req.user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
