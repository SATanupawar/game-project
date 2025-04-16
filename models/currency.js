const mongoose = require('mongoose');

const currencySchema = new mongoose.Schema({
    currency_id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    max_value: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Currency', currencySchema); 