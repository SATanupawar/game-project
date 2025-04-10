const mongoose = require('mongoose');

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
    gold_coins: {
        type: Number,
        required: true
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
        last_collected: {
            type: Date,
            default: Date.now
        }
    }],
    creatures: [{
        creature_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Creature'
        },
        building_index: Number, // Reference to the building's index
        count: {
            type: Number,
            default: 1
        }
    }],
    logout_time: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
