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
    creature_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Creature',
        default: null // Allows for buildings without creatures
    },
    creature_count: {
        type: Number,
        default: 0 // Default to 0 for buildings without creatures
    },
    position: {
        x: {
            type: Number,
            required: true
        },
        y: {
            type: Number,
            required: true
        }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Building', buildingSchema);
