const mongoose = require('mongoose');

const wellnessLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mood: { type: Number, min: 1, max: 5, required: true }, // 1=terrible, 5=great
    stressLevel: { type: Number, min: 1, max: 5, required: true }, // 1=calm, 5=extreme
    sleepHours: { type: Number, min: 0, max: 24, required: true },
    notes: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
});

wellnessLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('WellnessLog', wellnessLogSchema);
