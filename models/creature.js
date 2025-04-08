const mongoose = require('mongoose');

const creatureSchema = new mongoose.Schema({
    creature_Id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    gold_coins: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    level: {
        type: Number,
        default: 1
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Creature', creatureSchema);    
