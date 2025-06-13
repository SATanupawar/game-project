const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    offer_type: { type: String, required: true }, // e.g. 'beginner_bundle', 'resource', 'battle_loss', 'anima_ad'
    offer_data: { type: Object, required: true }, // details of the offer (price, items, etc.)
    status: { type: String, enum: ['active', 'shown', 'claimed', 'expired'], default: 'active' },
    shown_count: { type: Number, default: 0 },
    claimed_at: { type: Date },
    created_at: { type: Date, default: Date.now },
    expires_at: { type: Date }
});

module.exports = mongoose.model('Offer', offerSchema); 