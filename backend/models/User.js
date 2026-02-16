const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    name: { type: String, required: true, trim: true },
    age: { type: Number, default: 25 },
    weight: { type: Number, default: 70 }, // kg
    insulinToCarbRatio: { type: Number, default: 10 }, // ICR: 1 unit per X grams carb
    insulinSensitivityFactor: { type: Number, default: 50 }, // ISF: 1 unit drops glucose by X mg/dL
    basalDose: { type: Number, default: 0 }, // total daily basal units
    targetGlucoseLow: { type: Number, default: 80 },
    targetGlucoseHigh: { type: Number, default: 140 },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
