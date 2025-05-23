const mongoose = require('mongoose');

const questSchema = new mongoose.Schema({
    quest_id: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: true
    },
    category: {
        type: String,
        enum: ['collection', 'battle', 'building', 'creature', 'currency', 'card', 'chest', 'decoration', 'boost'],
        required: true
    },
    action: {
        type: String,
        required: true
    },
    required_amount: {
        type: Number,
        required: true,
        min: 1
    },
    reward_type: {
        type: String,
        enum: ['gold', 'arcane_energy', 'gems', 'xp', 'card_pack', 'chest'],
        required: true
    },
    reward_amount: {
        type: Number,
        required: true,
        min: 1
    },
    active: {
        type: Boolean,
        default: true
    },
    duration: {
        type: Number, // Duration in hours
        required: true
    },
    is_elite: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Quest', questSchema); 