const mongoose = require('mongoose');

// Define nested schemas
const ProbabilityRangeSchema = new mongoose.Schema({
    min: { type: Number, required: true },
    max: { type: Number, required: true }
});

const RewardSchema = new mongoose.Schema({
    reward_type: { 
        type: String, 
        required: true, 
        enum: ['resource', 'creature'] 
    },
    // Resource-specific fields
    resource_type: { 
        type: String, 
        enum: ['gems', 'gold', 'anima', 'arcane_energy'] 
    },
    amount: { type: Number },
    
    // Creature-specific fields
    creature_name: { type: String },
    rarity: { 
        type: String, 
        enum: ['common', 'rare', 'epic', 'legendary'] 
    },
    creature_Id: { type: String },
    
    // Common fields
    chance: { type: Number, required: true },
    probability_range: { type: ProbabilityRangeSchema, required: true }
});

const CardSchema = new mongoose.Schema({
    card_number: { type: Number, required: true },
    rewards: [RewardSchema]
});

// Main CardPack schema
const CardPackSchema = new mongoose.Schema({
    pack_id: { 
        type: String, 
        required: true, 
        unique: true 
    },
    pack_type: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    cost: { 
        type: Number, 
        required: true 
    },
    currency_type: { 
        type: String, 
        required: true, 
        enum: ['gems', 'gold'] 
    },
    cards: [CardSchema],
    available: { 
        type: Boolean, 
        default: true 
    },
    created_at: { 
        type: Date, 
        default: Date.now 
    },
    updated_at: { 
        type: Date, 
        default: Date.now 
    }
}, { strict: false });

// Pre-save hook to update the updated_at field
CardPackSchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

module.exports = mongoose.model('CardPack', CardPackSchema); 