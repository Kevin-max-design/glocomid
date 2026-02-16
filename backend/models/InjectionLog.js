const mongoose = require('mongoose');

const injectionLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    site: {
        type: String,
        enum: ['abdomen_left', 'abdomen_right', 'thigh_left', 'thigh_right', 'arm_left', 'arm_right'],
        required: true
    },
    timestamp: { type: Date, default: Date.now, index: true },
});

injectionLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('InjectionLog', injectionLogSchema);
