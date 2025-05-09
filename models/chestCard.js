const mongoose = require('mongoose');

// Define reward schema for coins
const coinRewardSchema = new mongoose.Schema({
    min: {
        type: Number,
        required: true
    },
    max: {
        type: Number,
        required: true
    }
}, { _id: false });

// Define reward schema for gems
const gemRewardSchema = new mongoose.Schema({
    min: {
        type: Number,
        required: true
    },
    max: {
        type: Number,
        required: true
    }
}, { _id: false });

// Define card chance schema for card rewards
const cardChanceSchema = new mongoose.Schema({
    rarity: {
        type: String,
        required: true,
        enum: ['common', 'rare', 'epic', 'legendary']
    },
    count: {
        type: Number,
        required: true,
        min: 1
    },
    chance: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    }
}, { _id: false });

// Define the ChestCard schema
const chestCardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    rarity: {
        type: String,
        required: true,
        enum: ['common', 'rare', 'epic', 'legendary']
    },
    description: {
        type: String,
        required: true
    },
    image_url: {
        type: String,
        default: '/images/chests/default.png'
    },
    unlock_time_minutes: {
        type: Number,
        required: true,
        min: 0,
        default: 180 // 3 hours default
    },
    drop_chance: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 10
    },
    rewards: {
        coins: {
            type: coinRewardSchema,
            required: true
        },
        gems: {
            type: gemRewardSchema,
            required: true
        },
        cards: [cardChanceSchema]
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ChestCard', chestCardSchema); 