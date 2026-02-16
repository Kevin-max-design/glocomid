const mongoose = require('mongoose');

const mealLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    carbs: { type: Number, required: true }, // grams
    mealType: {
        type: String,
        enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        default: 'snack'
    },
    description: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now, index: true },
});

mealLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('MealLog', mealLogSchema);
