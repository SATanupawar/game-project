const mongoose = require('mongoose');

// Define schemas for nested objects
const battleCreatureSchema = new mongoose.Schema({
    creature_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creature'
    },
    name: String,
    level: Number,
    type: String,
    attack: Number,
    health: Number,
    position: Number // Position in battle (0-5), max 6 creatures allowed
}, { _id: false }); // Disable _id for embedded documents

// Define schema for user boosts
const userBoostSchema = new mongoose.Schema({
    boost_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boost'
    },
    boost_name: String,
    count: {
        type: Number,
        default: 1,
        min: 1
    }
}, { _id: false }); // Disable _id for embedded documents

// Define schema for user currencies
const userCurrencySchema = new mongoose.Schema({
    gems: {
        type: Number,
        default: 0,
        min: 0,
        max: 10000000 // 10M max
    },
    arcane_energy: {
        type: Number,
        default: 0,
        min: 0,
        max: 100000000 // 100M max
    },
    anima: {
        type: Number,
        default: 0,
        min: 0,
        max: 1000000 // 1M max
    },
    last_updated: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // Disable _id for embedded documents

// Define schema for user trophies
const userTrophySchema = new mongoose.Schema({
    name: String,
    count: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: false }); // Disable _id for embedded documents

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
    profile_picture: {
        type: String,
        default: 'default.jpg'
    },
    title: {
        type: String,
        default: ''
    },
    trophies: [userTrophySchema],
    trophy_count: {
        type: Number,
        default: 0
    },
    gold_coins: {
        type: Number,
        required: true,
        max: 100000000
    },
    buildings: [{
        buildingId: String,
        name: String,
        gold_coins: Number,
        position: {
            x: Number,
            y: Number
        },
        size: {
            x: Number,
            y: Number
        },
        index: Number,
        reserveCoins: {
            type: Number,
            default: 0
        },
        last_collected: {
            type: Date,
            default: Date.now
        },
        creatures: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Creature'
        }]
    }],
    creatures: [{
        creature_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Creature'
        },
        name: {
            type: String,
            required: true
        },
        level: {
            type: Number,
            default: 1
        },
        building_index: {
            type: Number,
            required: true
        }
    }],
    battle_selected_creatures: [battleCreatureSchema],
    boosts: [userBoostSchema], // Array of boosts the user has obtained
    currency: {
        type: userCurrencySchema,
        default: () => ({}) // Initialize with default values
    },
    currency_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Currency'
    },
    logout_time: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    // Allow fields not specified in the schema
    strict: false
});

module.exports = mongoose.model('User', userSchema);
