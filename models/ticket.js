const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    ticketId: {
        type: String,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        default: 'Player'
    },
    category: {
        type: String,
        required: true,
        enum: ['Account Support', 'Purchases and Billing Issues', 'Technical Issues', 'In-Game Issues', 'Rules Violations and Reporting Players', 'Security Concerns']
    },
    subcategory: {
        type: String,
        required: true
    },
    subject: {
        type: String
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'working', 'closed'],
        default: 'pending'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number,
        uploadDate: Date
    }],
    responses: [{
        message: String,
        sentBy: {
            type: String,
            enum: ['user', 'admin'],
            required: true
        },
        senderId: {
            type: String,
            required: false
        },
        sentAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Generate a unique ticket ID before saving
ticketSchema.pre('save', async function(next) {
    if (this.isNew) {
        // Generate ticket ID format: TICKET-YYYYMMDD-XXXX (where XXXX is a random number)
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const randomNum = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
        
        this.ticketId = `TICKET-${year}${month}${day}-${randomNum}`;
        
        // If subject is not provided, use subcategory as subject
        if (!this.subject) {
            this.subject = this.subcategory;
        }
    }
    next();
});

module.exports = mongoose.model('Ticket', ticketSchema); 