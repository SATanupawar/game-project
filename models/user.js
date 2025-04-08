const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    user_name: {
        type: String,
        required: true
    },
    level: {
        type: Number,
        default: 1
    },
    gold_coins: {
        type: Number,
        required: true
    },
    buildings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Building'
    }],
    logout_time: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
