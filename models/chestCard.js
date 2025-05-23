const mongoose = require('mongoose');

// Define probability range schema
const probabilityRangeSchema = new mongoose.Schema({
    min: {
        type: Number,
        required: true
    },
    max: {
        type: Number,
        required: true
    }
}, { _id: false });

// Define reward schema for resource rewards
const resourceRewardSchema = new mongoose.Schema({
    reward_type: {
        type: String,
        required: true,
        enum: ['resource', 'creature']
    },
    resource_type: {
        type: String,
        required: function() { return this.reward_type === 'resource'; },
        enum: ['gold', 'gems', 'anima', 'arcane_energy']
    },
    creature_name: {
        type: String, 
        required: function() { return this.reward_type === 'creature'; }
    },
    rarity: {
        type: String,
        required: function() { return this.reward_type === 'creature'; },
        enum: ['common', 'rare', 'epic', 'legendary']
    },
    amount: {
        type: Number,
        required: function() { return this.reward_type === 'resource'; }
    },
    chance: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    probability_range: {
        type: probabilityRangeSchema,
        required: true
    }
}, { _id: false });

// Define card schema
const cardSchema = new mongoose.Schema({
    card_number: {
        type: Number,
        required: true
    },
    rewards: [resourceRewardSchema]
}, { _id: false });

// Define the ChestCard schema
const chestCardSchema = new mongoose.Schema({
    chest_id: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        required: true,
        enum: ['common', 'rare', 'epic', 'legendary']
    },
    chance: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    probability_range: {
        type: probabilityRangeSchema,
        required: true
    },
    image_url: {
        type: String,
        default: '/images/chests/default.png'
    },
    drop_chance: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
        default: 10
    },
    unlock_time_minutes: {
        type: Number,
        required: true,
        min: 0,
        default: 180 // 3 hours default
    },
    cards: [cardSchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('ChestCard', chestCardSchema); 