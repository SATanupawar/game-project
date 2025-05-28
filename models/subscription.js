const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    start_date: {
        type: Date,
        default: Date.now
    },
    end_date: {
        type: Date,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    auto_renew: {
        type: Boolean,
        default: false
    },
    payment_id: {
        type: String
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Create index for faster lookups
subscriptionSchema.index({ userId: 1, active: 1 });

// Pre-save hook to update updated_at timestamp
subscriptionSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Static method to get active subscription for a user
subscriptionSchema.statics.getActiveSubscription = async function(userId) {
    return this.findOne({ 
        userId, 
        active: true,
        end_date: { $gt: new Date() }
    });
};

// Static method to check if subscription has expired and update status
subscriptionSchema.statics.checkExpiredSubscriptions = async function() {
    const now = new Date();
    
    // Find all active subscriptions that have expired
    const expiredSubscriptions = await this.find({
        active: true,
        end_date: { $lt: now }
    });
    
    // Update all expired subscriptions to inactive
    for (const subscription of expiredSubscriptions) {
        subscription.active = false;
        await subscription.save();
        
        // Here you could add code to notify users their subscription has expired
        console.log(`Subscription for user ${subscription.userId} has expired`);
    }
    
    return expiredSubscriptions;
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription; 