const mongoose = require('mongoose');

const boostSchema = new mongoose.Schema({
    boost_id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    path: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    
});

module.exports = mongoose.model('Boost', boostSchema); 