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
        required: true,
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
        type: String,
        default: null
    },
    payment_status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'completed'
    },
    subscription_history: [{
        action: {
            type: String,
            enum: ['created', 'renewed', 'cancelled', 'expired'],
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        note: String
    }],
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

// Pre-save middleware to update timestamps
subscriptionSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

// Static method to get active subscription for a user
subscriptionSchema.statics.getActiveSubscription = async function(userId) {
    const now = new Date();
    return this.findOne({
        userId,
        active: true,
        start_date: { $lte: now },
        end_date: { $gte: now }
    });
};

// Static method to check expired subscriptions
subscriptionSchema.statics.checkExpiredSubscriptions = async function() {
    const now = new Date();
    const expiredSubscriptions = await this.find({
        active: true,
        end_date: { $lt: now }
    });

    // Update expired subscriptions
    for (const subscription of expiredSubscriptions) {
        subscription.active = false;
        subscription.subscription_history.push({
            action: 'expired',
            date: now,
            note: 'Subscription expired automatically'
        });
        await subscription.save();
    }

    return expiredSubscriptions;
};

// Instance method to cancel subscription
subscriptionSchema.methods.cancel = async function() {
    this.active = false;
    this.auto_renew = false;
    this.subscription_history.push({
        action: 'cancelled',
        date: new Date(),
        note: 'Subscription cancelled by user'
    });
    return this.save();
};

// Instance method to renew subscription
subscriptionSchema.methods.renew = async function(newEndDate) {
    this.start_date = new Date();
    this.end_date = newEndDate;
    this.active = true;
    this.subscription_history.push({
        action: 'renewed',
        date: new Date(),
        note: 'Subscription renewed'
    });
    return this.save();
};

const Subscription = mongoose.model('Subscription', subscriptionSchema);

module.exports = Subscription; 