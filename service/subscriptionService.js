const mongoose = require('mongoose');
const Subscription = require('../models/subscription');
const User = require('../models/user');
const UserBattlePass = require('../models/userBattlePass');
const BattlePass = require('../models/battlePass');

/**
 * Create a new subscription for a user
 * @param {String} userId - User ID
 * @param {String} subscriptionType - Subscription type (monthly, quarterly, yearly)
 * @param {String} paymentId - Payment ID from payment gateway (optional)
 * @returns {Promise<Object>} Subscription creation result
 */
async function createSubscription(userId, subscriptionType, paymentId = null) {
    try {
        // Check if user exists
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Check if subscription type is valid
        if (!['monthly', 'quarterly', 'yearly'].includes(subscriptionType)) {
            return {
                success: false,
                message: 'Invalid subscription type. Must be monthly, quarterly, or yearly.'
            };
        }

        // Check if user already has an active subscription
        const existingSubscription = await Subscription.getActiveSubscription(userId);
        if (existingSubscription) {
            return {
                success: false,
                message: 'User already has an active subscription',
                subscription: existingSubscription
            };
        }

        // Calculate subscription details
        const now = new Date();
        let price = 0;
        let endDate = new Date();

        switch (subscriptionType) {
            case 'monthly':
                price = 599;
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
                break;
            case 'quarterly':
                price = 1599;
                endDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
                break;
            case 'yearly':
                price = 6799;
                endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
                break;
        }

        // Create new subscription
        const subscription = new Subscription({
            userId,
            type: subscriptionType,
            price,
            start_date: now,
            end_date: endDate,
            active: true,
            auto_renew: false,
            payment_id: paymentId
        });

        await subscription.save();

        // Update user's elite pass status
        if (!user.elite_pass) {
            user.elite_pass = {
                active: true,
                activated_at: now,
                expires_at: endDate
            };
        } else {
            user.elite_pass.active = true;
            user.elite_pass.activated_at = now;
            user.elite_pass.expires_at = endDate;
        }

        user.markModified('elite_pass');
        await user.save();

        // Update user battle pass to elite if there is an active battle pass
        const currentBattlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });

        if (currentBattlePass) {
            let userBattlePass = await UserBattlePass.findOne({
                userId,
                battle_pass_id: currentBattlePass._id
            });

            if (!userBattlePass) {
                // Create new user battle pass with elite status
                userBattlePass = new UserBattlePass({
                    userId,
                    battle_pass_id: currentBattlePass._id,
                    current_xp: 0,
                    current_level: 1,
                    is_elite: true,
                    claimed_rewards: [],
                    xp_history: []
                });
            } else {
                // Update existing battle pass to elite
                userBattlePass.is_elite = true;
            }

            await userBattlePass.save();
        }

        return {
            success: true,
            message: 'Subscription created successfully',
            subscription,
            elite_pass: user.elite_pass
        };
    } catch (error) {
        console.error('Error creating subscription:', error);
        return {
            success: false,
            message: 'Error creating subscription',
            error: error.message
        };
    }
}

/**
 * Cancel a user's subscription
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelSubscription(userId) {
    try {
        // Find active subscription
        const subscription = await Subscription.getActiveSubscription(userId);
        if (!subscription) {
            return {
                success: false,
                message: 'No active subscription found for this user'
            };
        }

        // Deactivate subscription
        subscription.active = false;
        await subscription.save();

        // Update user's elite pass status to inactive at the end of the current period
        const user = await User.findOne({ userId });
        if (user && user.elite_pass) {
            // We keep the elite pass active until the end of the subscription period
            // but turn off auto-renewal
            user.elite_pass.auto_renew = false;
            user.markModified('elite_pass');
            await user.save();
        }

        return {
            success: true,
            message: 'Subscription cancelled successfully. Elite pass will remain active until the end of the billing period.',
            end_date: subscription.end_date
        };
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        return {
            success: false,
            message: 'Error cancelling subscription',
            error: error.message
        };
    }
}

/**
 * Get user's subscription status
 * @param {String} userId - User ID
 * @returns {Promise<Object>} Subscription status
 */
async function getSubscriptionStatus(userId) {
    try {
        // Check if user exists
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Find active subscription
        const subscription = await Subscription.getActiveSubscription(userId);
        if (!subscription) {
            return {
                success: true,
                has_subscription: false,
                elite_pass_active: user.elite_pass && user.elite_pass.active && 
                    user.elite_pass.expires_at > new Date()
            };
        }

        // Get current battle pass if any
        const now = new Date();
        const currentBattlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });

        let battlePassInfo = null;
        if (currentBattlePass) {
            const userBattlePass = await UserBattlePass.findOne({
                userId,
                battle_pass_id: currentBattlePass._id
            });

            battlePassInfo = {
                name: currentBattlePass.name,
                end_date: currentBattlePass.end_date,
                has_progress: !!userBattlePass,
                is_elite: userBattlePass ? userBattlePass.is_elite : false,
                current_level: userBattlePass ? userBattlePass.current_level : 0
            };
        }

        return {
            success: true,
            has_subscription: true,
            subscription: {
                type: subscription.type,
                start_date: subscription.start_date,
                end_date: subscription.end_date,
                price: subscription.price,
                auto_renew: subscription.auto_renew,
                days_remaining: Math.ceil((subscription.end_date - now) / (1000 * 60 * 60 * 24))
            },
            elite_pass_active: user.elite_pass && user.elite_pass.active,
            battle_pass: battlePassInfo
        };
    } catch (error) {
        console.error('Error getting subscription status:', error);
        return {
            success: false,
            message: 'Error getting subscription status',
            error: error.message
        };
    }
}

/**
 * Renew a user's subscription
 * @param {String} userId - User ID
 * @param {String} subscriptionType - Subscription type (monthly, quarterly, yearly)
 * @param {String} paymentId - Payment ID from payment gateway (optional)
 * @returns {Promise<Object>} Renewal result
 */
async function renewSubscription(userId, subscriptionType, paymentId = null) {
    try {
        // Find current subscription
        const currentSubscription = await Subscription.getActiveSubscription(userId);
        
        // If no current subscription, create a new one
        if (!currentSubscription) {
            return createSubscription(userId, subscriptionType, paymentId);
        }
        
        // Deactivate the current subscription
        currentSubscription.active = false;
        await currentSubscription.save();
        
        // Create a new subscription
        return createSubscription(userId, subscriptionType, paymentId);
    } catch (error) {
        console.error('Error renewing subscription:', error);
        return {
            success: false,
            message: 'Error renewing subscription',
            error: error.message
        };
    }
}

/**
 * Check and update expired subscriptions
 * @returns {Promise<Object>} Update result
 */
async function checkExpiredSubscriptions() {
    try {
        const expiredSubscriptions = await Subscription.checkExpiredSubscriptions();
        
        // Update user elite pass statuses for expired subscriptions
        for (const subscription of expiredSubscriptions) {
            const user = await User.findOne({ userId: subscription.userId });
            if (user && user.elite_pass && user.elite_pass.active) {
                user.elite_pass.active = false;
                user.markModified('elite_pass');
                await user.save();
                
                // Update any active battle passes
                const now = new Date();
                const currentBattlePass = await BattlePass.findOne({
                    start_date: { $lte: now },
                    end_date: { $gte: now },
                    active: true
                });
                
                if (currentBattlePass) {
                    const userBattlePass = await UserBattlePass.findOne({
                        userId: subscription.userId,
                        battle_pass_id: currentBattlePass._id
                    });
                    
                    if (userBattlePass && userBattlePass.is_elite) {
                        userBattlePass.is_elite = false;
                        await userBattlePass.save();
                    }
                }
            }
        }
        
        return {
            success: true,
            message: `Updated ${expiredSubscriptions.length} expired subscriptions`,
            expired_subscriptions: expiredSubscriptions
        };
    } catch (error) {
        console.error('Error checking expired subscriptions:', error);
        return {
            success: false,
            message: 'Error checking expired subscriptions',
            error: error.message
        };
    }
}

module.exports = {
    createSubscription,
    cancelSubscription,
    getSubscriptionStatus,
    renewSubscription,
    checkExpiredSubscriptions
}; 