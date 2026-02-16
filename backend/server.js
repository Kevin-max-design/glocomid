require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/glucose', require('./routes/glucose'));
app.use('/api/insulin', require('./routes/insulin'));
app.use('/api/meals', require('./routes/meals'));
app.use('/api/injections', require('./routes/injections'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/predict', require('./routes/predict'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/wellness', require('./routes/wellness'));
app.use('/api/advanced-analytics', require('./routes/advanced-analytics'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'GlucoMind API', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`🧠 GlucoMind API running on port ${PORT}`);
});
