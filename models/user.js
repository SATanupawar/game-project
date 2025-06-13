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
    speed: Number,
    armor: Number,
    critical_damage: Number,
    critical_damage_percentage: Number,
    creature_type: String
}, { _id: false }); // Disable _id for embedded documents

// Define schema for user boosts
const userBoostSchema = new mongoose.Schema({
    boost_id: {
        type: String,
        required: true
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
        min: 0
    },
    arcane_energy: {
        type: Number,
        default: 0,
        min: 0
    },
    anima: {
        type: Number,
        default: 0,
        min: 0
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

// Define schema for placed paths
const placedPathSchema = new mongoose.Schema({
    x: {
        type: Number,
        required: true
    },
    y: {
        type: Number,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
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
    start_time: {
        type: Date,
        default: Date.now
    },
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

// Define schema for user quest tracking
const userQuestSchema = new mongoose.Schema({
    quest_id: {
        type: String,
        required: true
    },
    progress: {
        type: Number,
        default: 0
    },
    completed: {
        type: Boolean,
        default: false
    },
    rewarded: {
        type: Boolean,
        default: false
    },
    expires_at: {
        type: Date,
        required: true
    },
    completed_at: {
        type: Date,
        default: null
    }
}, { _id: false });

const completedQuestSchema = new mongoose.Schema({
    quest_id: {
        type: String,
        required: true
    },
    completed_at: {
        type: Date,
        default: Date.now
    },
    type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: true
    }
}, { _id: false });

// Define schema for creature inventory items
const creatureInventoryItemSchema = new mongoose.Schema({
    creature_id: {
        type: mongoose.Schema.Types.Mixed, // Changed from ObjectId to Mixed to accept both ObjectId and String
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
    count: {
        type: Number,
        default: 1,
        min: 0
    },
    rarity: {
        type: String,
        default: 'common'
    },
    image: {
        type: String,
        default: null
    }
}, { _id: false });

const userCreatureSlotsSchema = new mongoose.Schema({
    slot_number: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    is_unlocked: {
        type: Boolean,
        default: false
    },
    unlocked_at: {
        type: Date,
        default: null
    }
}, { _id: false });

// Define schema for battle pass summary
const battlePassSummarySchema = new mongoose.Schema({
    current_level: {
        type: Number,
        default: 0
    },
    current_xp: {
        type: Number,
        default: 0
    },
    is_elite: {
        type: Boolean,
        default: false
    },
    completed_levels: {
        count: {
            type: Number,
            default: 0
        },
        levels: [{
            type: Number
        }],
        total_xp_earned: {
            type: Number,
            default: 0
        }
    },
    current_level_progress: {
        xp_required: {
            type: Number,
            default: 0
        },
        xp_earned: {
            type: Number,
            default: 0
        },
        xp_remaining: {
            type: Number,
            default: 0
        },
        progress_percentage: {
            type: Number,
            default: 0
        }
    },
    claimed_rewards: [{
        level: Number,
        is_elite: Boolean,
        reward_type: String,
        claim_date: Date
    }],
    last_collected_level: {
        type: Number,
        default: 0
    },
    uncollected_rewards: [{
        type: Number
    }],
    battle_pass_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BattlePass'
    },
    battle_pass_name: String,
    last_updated: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

// Define schema for active merges
const activeMergeSchema = new mongoose.Schema({
    creature1_id: {
        type: String,
        required: true
    },
    creature2_id: {
        type: String,
        required: true
    },
    start_time: {
        type: Date,
        default: Date.now
    },
    estimated_finish_time: {
        type: Date,
        required: true
    },
    progress: {
        type: Number,
        default: 0
    },
    target_level: {
        type: Number,
        required: true
    },
    last_update: {
        type: Date,
        default: Date.now
    },
    can_collect: {
        type: Boolean,
        default: false
    }
}, { _id: false });

// Define schema for user card packs
const userCardPackSchema = new mongoose.Schema({
    pack_id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: ''
    },
    obtained_at: {
        type: Date,
        default: Date.now
    },
    source: {
        type: String,
        default: 'unknown'
    },
    is_opened: {
        type: Boolean,
        default: false
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
        max: 10000000000000000000
    },
    // Card packs obtained from battle pass and other sources
    card_packs: [userCardPackSchema],
    // Creature inventory - stores creatures obtained from card packs and other sources
    creature_inventory: [creatureInventoryItemSchema],
    // Creature slots that the user has unlocked
    creature_slots: [userCreatureSlotsSchema],
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
        },
        // Add slot information to existing creatures
        slot_number: {
            type: Number,
            min: 1,
            max: 5,
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
            required: false, // Not required initially, will be set when unlock starts
            default: function() {
                // Set a far future date by default (1 year from now)
                return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            }
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
        },
        // Add slot information to creatures being created
        slot_number: {
            type: Number,
            min: 1,
            max: 5,
            required: false, // Make slot_number optional for card pack creatures
            default: null // Allow null for creatures from card packs
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
    // Authentication related fields
    login_time: {
        type: Date,
        default: null
    },
    logout_time: {
        type: Date,
        default: null
    },
    deviceInfo: {
        type: Object,
        default: null
    },
    lastActiveIP: {
        type: String,
        default: null
    },
    // Session history to store all session durations
    sessionHistory: [{
        startTime: {
            type: Date,
            required: true
        },
        endTime: {
            type: Date,
            required: true
        },
        duration: {
            type: Number, // Duration in minutes (with 1 decimal precision)
            required: true
        },
        deviceInfo: {
            type: Object,
            default: null
        }
    }],
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
    }],
    // Add to userSchema
    active_quests: [userQuestSchema],
    completed_quests: [completedQuestSchema],
    quest_stats: {
        daily_completed: {
            type: Number,
            default: 0
        },
        weekly_completed: {
            type: Number,
            default: 0
        },
        monthly_completed: {
            type: Number,
            default: 0
        },
        total_completed: {
            type: Number,
            default: 0
        },
        last_daily_refresh: {
            type: Date,
            default: null
        },
        last_weekly_refresh: {
            type: Date,
            default: null
        },
        last_monthly_refresh: {
            type: Date,
            default: null
        },
        daily_replacements: {
            type: Number,
            default: 0
        },
        weekly_replacements: {
            type: Number,
            default: 0
        },
        monthly_replacements: {
            type: Number,
            default: 0
        },
        total_replacements: {
            type: Number,
            default: 0
        }
    },
    replaced_quests: [{
        old_quest_id: String,
        old_quest_title: String,
        new_quest_id: String,
        new_quest_title: String,
        quest_type: {
            type: String,
            enum: ['daily', 'weekly', 'monthly']
        },
        replaced_at: {
            type: Date,
            default: Date.now
        }
    }],
    // Add merging history and active merges tracking
    active_merges: [activeMergeSchema],
    
    // Elite Pass information
    elite_pass: {
        active: {
            type: Boolean,
            default: false
        },
        purchase_date: {
            type: Date,
            default: null
        },
        expiry_date: {
            type: Date,
            default: null
        }
    },
    // Subscription history to store all subscription details
    subscription_history: [{
        type: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly'],
            required: true
        },
        start_date: {
            type: Date,
            required: true
        },
        end_date: {
            type: Date,
            required: true
        },
        price: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ['active', 'expired', 'cancelled'],
            default: 'active'
        },
        elite_pass: {
            active: Boolean,
            start_date: Date,
            end_date: Date
        },
        battle_pass: {
            name: String,
            is_elite: Boolean,
            current_level: Number,
            start_date: Date,
            end_date: Date
        },
        created_at: {
            type: Date,
            default: Date.now
        }
    }],
    // Elite quest statistics
    elite_quest_stats: {
        completed: {
            type: Number,
            default: 0
        },
        last_refresh: {
            type: Date,
            default: null
        },
        replacements: {
            type: Number,
            default: 0
        }
    },
    battlePassSummary: {
        type: battlePassSummarySchema,
        default: () => ({})
    },
    placed_paths: [placedPathSchema],
    // BEGINNER'S BUNDLE OFFER TRACKING
    beginner_bundle_offer: {
        shown_today: { type: Number, default: 0 },
        last_shown_date: { type: Date }
    },
    // RESOURCE-BASED OFFERS: no schema needed for offers, but can add analytics if needed
    // ANIMA VIDEO ADS TRACKING
    video_ads_today_count: { type: Number, default: 0 },
    last_video_ad_date: { type: Date },
    // BATTLE LOSS STREAK OFFERS
    battle_loss_streak: { type: Number, default: 0 },
    battle_loss_creatures: [{
        date: { type: Date, default: Date.now },
        creatures: [{ creature_id: String, rarity: String }]
    }],
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

// Add pre-save hook to fix any issues with slot_number in creating_creatures
userSchema.pre('save', function(next) {
    // Remove this pre-save hook - we don't want to force values for card pack creatures
    next();
});

module.exports = mongoose.model('User', userSchema);
