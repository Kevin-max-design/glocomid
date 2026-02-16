const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    steps: { type: Number, required: true, min: 0 },
    duration: { type: Number, default: 0 }, // minutes
    activityType: {
        type: String,
        enum: ['walking', 'running', 'cycling', 'exercise', 'other'],
        default: 'walking'
    },
    notes: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
});

activityLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
