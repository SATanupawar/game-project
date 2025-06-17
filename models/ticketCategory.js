const mongoose = require('mongoose');

const ticketCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    icon: {
        type: String,
        required: true
    },
    subcategories: [{
        name: {
            type: String,
            required: true
        },
        description: {
            type: String
        }
    }],
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TicketCategory', ticketCategorySchema); 