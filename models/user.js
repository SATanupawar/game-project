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
        },
        creature_type: String,
        base_attack: Number,
        base_health: Number,
        attack: Number,
        health: Number,
        gold_coins: Number,
        count: {
            type: Number,
            default: 1
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
    rumble_construction_area: [
        {
            x: Number,
            y: Number,
            started_time: Date,
            finished_time: Date
        }
    ],
    clear_rumble: [
        {
            x: Number,
            y: Number,
            construction_started: Date,
            construction_finished: Date,
            cleared_time: Date
        }
    ],
    building_construction: [
        {
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
            started_time: Date,
            finished_time: Date
        }
    ],
    // Card pack history - stores the last time each pack was opened
    last_opened_packs: {
        type: Map,
        of: Date,
        default: () => ({})
    },
    // Card pack related stats
    card_stats: {
        total_packs_opened: {
            type: Number,
            default: 0
        },
        free_packs_opened: {
            type: Number,
            default: 0
        },
        common_packs_opened: {
            type: Number,
            default: 0
        },
        rare_packs_opened: {
            type: Number,
            default: 0
        },
        epic_packs_opened: {
            type: Number,
            default: 0
        },
        legendary_packs_opened: {
            type: Number,
            default: 0
        },
        creatures_obtained: {
            type: Number,
            default: 0
        }
    },
    logout_time: {
        type: Date,
        default: Date.now
    },
    // Add locked_creatures array for creatures obtained from card packs
    locked_creatures: [{
        creature_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Creature'
        },
        name: String,
        rarity: String,
        level: {
            type: Number,
            default: 1
        },
        creature_type: String,
        obtained_at: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true,
    // Allow fields not specified in the schema
    strict: false
});

module.exports = mongoose.model('User', userSchema);
