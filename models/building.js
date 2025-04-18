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
    gold_coins: {
        type: Number,
        required: true
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
