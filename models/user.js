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
        max: 1000000000 // 1B max
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

// Define schema for user chests
const userChestSchema = new mongoose.Schema({
    chest_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChestCard'
    },
    object_id: {
        type: String,
        required: false
    },
    name: String,
    rarity: String,
    unlock_time: {
        type: Date,
        default: Date.now
    },
    is_unlocked: {
        type: Boolean,
        default: false
    },
    is_claimed: {
        type: Boolean,
        default: false
    },
    obtained_at: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Define schema for Arcane Energy buildings
const arcaneEnergyBuildingSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 8
    },
    is_active: {
        type: Boolean,
        default: false
    },
    production_start_time: {
        type: Date,
        default: null
    },
    production_end_time: {
        type: Date,
        default: null
    },
    production_time_minutes: {
        type: Number,
        required: true
    },
    arcane_energy_production: {
        type: Number,
        required: true
    },
    activation_gold_cost: {
        type: Number,
        required: true
    },
    last_collected: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

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
    fcmToken: {
        type: String,
        default: null
    },
    level: {
        type: Number,
        default: 1
    },
    xp: {
        type: Number,
        default: 0,
        min: 0
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
        generation_interval: {
            type: Number,
            default: 60,  // Default 60 minutes (1 hour)
            min: 1
        },
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
    arcaneEnergyBuildings: [arcaneEnergyBuildingSchema],
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
        },
        upgrade_progress: {
            type: Number,
            default: 0
        },
        upgrade_partner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Creature',
            default: null
        },
        last_upgrade_click_time: {
            type: Date,
            default: null
        }
    }],
    creating_creatures: [{
        creature_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Creature'
        },
        creature_type: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        started_time: {
            type: Date,
            default: Date.now
        },
        finished_time: {
            type: Date,
            required: true
        },
        unlock_time: {
            type: Number,
            required: true
        },
        level: {
            type: Number,
            default: 1
        },
        anima_cost: {
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
    chests: [userChestSchema], // Array of chests the user has obtained
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
            generation_interval: {
                type: Number,
                default: 60
            },
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

// Add method to add XP and handle level up
userSchema.methods.addXP = async function(amount) {
    const UserLevel = mongoose.model('UserLevel');
    
    this.xp += amount;
    const newLevel = await UserLevel.getLevelByXP(this.xp);
    
    if (newLevel > this.level) {
        this.level = newLevel;
        // You can add additional logic here for level up rewards
    }
    
    await this.save();
    return {
        new_level: this.level,
        current_xp: this.xp,
        xp_progress: await UserLevel.getXPProgress(this.xp)
    };
};

// Add method to get XP progress
userSchema.methods.getXPProgress = async function() {
    const UserLevel = mongoose.model('UserLevel');
    return await UserLevel.getXPProgress(this.xp);
};

module.exports = mongoose.model('User', userSchema);
