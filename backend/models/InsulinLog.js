const mongoose = require('mongoose');

const insulinLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['basal', 'bolus'], required: true },
    units: { type: Number, required: true },
    notes: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
});

insulinLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('InsulinLog', insulinLogSchema);
