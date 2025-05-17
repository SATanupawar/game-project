const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    userId: {
        type: String,
        index: true, // For faster queries by userId
        required: false // Optional for system logs
    },
    userName: {
        type: String,
        required: false
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            // User authentication events
            'USER_REGISTERED',
            'USER_LOGIN',
            'USER_LOGOUT',
            
            // Game progression events
            'LEVEL_UP',
            'XP_GAINED',
            'COINS_ADDED',
            'COINS_SPENT',
            
            // Building events
            'BUILDING_CREATED',
            'BUILDING_UPGRADED',
            'BUILDING_COINS_COLLECTED',
            
            // Creature events
            'CREATURE_PURCHASED',
            'CREATURE_UNLOCKED',
            'CREATURE_ASSIGNED',
            'CREATURE_UPGRADED',
            
            // Resource events
            'ARCANE_ENERGY_PRODUCED',
            'ARCANE_ENERGY_SPENT',
            'ANIMA_GAINED',
            'ANIMA_SPENT',
            
            // Session events
            'SESSION_STARTED',
            'SESSION_ENDED',
            
            // API events
            'API_REQUEST',
            'API_ERROR',
            
            // System events
            'SYSTEM_ERROR',
            'SYSTEM_WARNING',
            
            // Matchmaking events
            'MATCHMAKING_TICKET_CREATED',
            'MATCHMAKING_TICKET_CHECKED',
            'MATCHMAKING_TICKET_CANCELLED',
            'MATCHMAKING_MATCH_FOUND',
            'MATCHMAKING_MATCH_ACCEPTED',
            'MATCHMAKING_MATCH_REJECTED',
            'MATCHMAKING_MATCH_DETAILS_REQUESTED',
            'MATCHMAKING_GAME_SESSION_CREATED',
            'MATCHMAKING_PLAYER_JOINED',
            'MATCHMAKING_PLAYER_LEFT'
        ],
        index: true // For faster queries by eventType
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true // For faster time-based queries
    },
    details: {
        type: Object,
        default: {}
    },
    requestPath: {
        type: String, 
        required: false
    },
    requestMethod: {
        type: String,
        required: false
    },
    responseStatus: {
        type: Number,
        required: false
    },
    deviceInfo: {
        type: Object,
        required: false
    },
    ipAddress: {
        type: String,
        required: false
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Create TTL index to automatically remove old logs after 90 days
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Log', logSchema); 