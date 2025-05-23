const mongoose = require('mongoose');

const activeQuestsSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['daily', 'weekly', 'monthly'],
        required: true,
        unique: true
    },
    active_quest_ids: {
        type: [String],
        required: true
    },
    last_refreshed: {
        type: Date,
        default: Date.now
    },
    next_refresh: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ActiveQuests', activeQuestsSchema); 