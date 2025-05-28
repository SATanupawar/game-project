const mongoose = require('mongoose');

// Define the schema for Battle Pass
const battlePassSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    start_date: {
        type: Date,
        required: true
    },
    end_date: {
        type: Date,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    max_level: {
        type: Number,
        default: 51
    },
    xp_requirements: [{
        level_start: Number,
        level_end: Number,
        xp_required: Number
    }],
    free_rewards: [{
        level: {
            type: Number,
            required: true
        },
        reward_type: {
            type: String,
            enum: ['gold', 'arcane_energy', 'anima', 'gems', 'creature', 'card_pack', 'decoration'],
            required: true
        },
        amount: {
            type: Number,
            default: 1
        },
        pack_id: String,
        creature_id: String,
        decoration_id: String,
        description: String
    }],
    elite_rewards: [{
        level: {
            type: Number,
            required: true
        },
        reward_type: {
            type: String,
            enum: ['gold', 'arcane_energy', 'anima', 'gems', 'creature', 'card_pack', 'decoration'],
            required: true
        },
        amount: {
            type: Number,
            default: 1
        },
        pack_id: String,
        creature_id: String,
        decoration_id: String,
        description: String
    }],
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Create a virtual for the current active battle pass
battlePassSchema.statics.getCurrentActiveBattlePass = async function() {
    const now = new Date();
    return this.findOne({
        start_date: { $lte: now },
        end_date: { $gte: now },
        active: true
    });
};

// Pre-save hook to update the updated_at timestamp
battlePassSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

const BattlePass = mongoose.model('BattlePass', battlePassSchema);

module.exports = BattlePass; 