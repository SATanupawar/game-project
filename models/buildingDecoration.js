const mongoose = require('mongoose');

const buildingDecorationSchema = new mongoose.Schema({
    decorationId: {
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
    boostPercent: {
        type: Number,
        required: true,
        default: 0
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
    unlockLevel: {
        type: Number,
        required: true,
        default: 1
    },
    image: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    position: {
        x: {
            type: Number,
            required: true,
            default: 0
        },
        y: {
            type: Number,
            required: true,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Create a compound index to ensure each decoration has a unique decorationId
buildingDecorationSchema.index({ decorationId: 1 }, { unique: true });

module.exports = mongoose.model('BuildingDecoration', buildingDecorationSchema); 