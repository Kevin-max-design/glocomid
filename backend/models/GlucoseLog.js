const mongoose = require('mongoose');

const glucoseLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    value: { type: Number, required: true }, // mg/dL
    type: {
        type: String,
        enum: ['fasting', 'premeal', 'postmeal', 'bedtime', 'random'],
        default: 'random'
    },
    notes: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
});

glucoseLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('GlucoseLog', glucoseLogSchema);
