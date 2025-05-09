const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
    buildingId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    cost: {
        type: Number,
        required: true,
        default: 0
    },
    gold_coins: {
        type: Number,
        required: true
    },
    generation_interval: {
        type: Number,
        required: true,
        default: 60,  // Default interval: 60 minutes (1 hour)
        min: 1
    },
    position: {
        x: {
            type: Number
        },
        y: {
            type: Number
        }
    },
    size: {
        x: {
            type: Number,
            required: true,
            default: 1
        },
        y: {
            type: Number,
            required: true,
            default: 1
        }
    },
    constructionTime: {
        type: Number,
        default: 0,  // Time in minutes
        required: true
    },
    unlockLevel: {
        type: Number,
        default: 1,
        required: true
    },
    creatures: [{
        creature_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Creature'
        },
        count: {
            type: Number,
            default: 0
        }
    }]
}, {
    timestamps: true
});

// Create a compound index to ensure each building has a unique buildingId
buildingSchema.index({ buildingId: 1 }, { unique: true });

module.exports = mongoose.model('Building', buildingSchema);
