const express = require('express');
const router = express.Router();
const subscriptionService = require('../service/subscriptionService');
const User = require('../models/user');
const Subscription = require('../models/subscription');
const BattlePass = require('../models/battlePass');
const UserBattlePass = require('../models/userBattlePass');

// Create a new subscription
router.post('/', async (req, res) => {
    try {
        const { userId, subscriptionType, paymentId } = req.body;
        
        if (!userId || !subscriptionType) {
            return res.status(400).json({
                success: false,
                message: 'User ID and subscription type are required'
            });
        }
        
        const result = await subscriptionService.createSubscription(
            userId,
            subscriptionType,
            paymentId
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating subscription',
            error: error.message
        });
    }
});

// Get user's subscription status
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const result = await subscriptionService.getSubscriptionStatus(userId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting subscription status:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting subscription status',
            error: error.message
        });
    }
});

// Cancel a subscription
router.post('/:userId/cancel', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const result = await subscriptionService.cancelSubscription(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling subscription',
            error: error.message
        });
    }
});

// Renew a subscription
router.post('/:userId/renew', async (req, res) => {
    try {
        const { userId } = req.params;
        const { subscriptionType, paymentId } = req.body;
        
        if (!userId || !subscriptionType) {
            return res.status(400).json({
                success: false,
                message: 'User ID and subscription type are required'
            });
        }
        
        const result = await subscriptionService.renewSubscription(
            userId,
            subscriptionType,
            paymentId
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error renewing subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error renewing subscription',
            error: error.message
        });
    }
});

// Admin endpoint to check and update expired subscriptions
router.post('/check-expired', async (req, res) => {
    try {
        const result = await subscriptionService.checkExpiredSubscriptions();
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error checking expired subscriptions:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking expired subscriptions',
            error: error.message
        });
    }
});

// Process new subscription
router.post('/subscribe', async (req, res) => {
    try {
        const { userId, subscriptionType } = req.body;

        if (!userId || !subscriptionType) {
            return res.status(400).json({
                success: false,
                message: 'User ID and subscription type are required'
            });
        }

        const result = await subscriptionService.processUserSubscription(userId, subscriptionType);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        // Get current battle pass details
        const now = new Date();
        const battlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });

        // Get user battle pass details if available
        let battlePassInfo = null;
        if (battlePass) {
            const userBattlePass = await UserBattlePass.findOne({
                userId,
                battle_pass_id: battlePass._id
            });

            battlePassInfo = {
                name: battlePass.name,
                is_elite: userBattlePass ? userBattlePass.is_elite : false,
                current_level: userBattlePass ? userBattlePass.current_level : 1,
                start_date: battlePass.start_date,
                end_date: battlePass.end_date
            };
        }

        // Get user info
        const user = await User.findOne({ userId });
        
        // Add additional details to response
        result.data.user_details = {
            username: user.username,
            elite_pass: {
                active: user.elite_pass.active,
                subscription_type: user.elite_pass.subscription_type,
                start_date: user.elite_pass.start_date,
                end_date: user.elite_pass.end_date,
                days_remaining: Math.ceil((new Date(user.elite_pass.end_date) - now) / (1000 * 60 * 60 * 24))
            }
        };
        
        if (battlePassInfo) {
            result.data.battle_pass = battlePassInfo;
        }

        // Add subscription history for client-side storage/display
        if (user.subscription_history && user.subscription_history.length > 0) {
            // Get the most recent subscription
            const latestSubscription = user.subscription_history[user.subscription_history.length - 1];
            result.data.subscription_details = latestSubscription;
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error processing subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing subscription',
            error: error.message
        });
    }
});

// Check subscription status
router.get('/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const result = await subscriptionService.checkSubscriptionStatus(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error checking subscription status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking subscription status',
            error: error.message
        });
    }
});

// Comprehensive subscription status check
router.get('/check-full-status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Get user data
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find active subscription
        const subscription = await Subscription.getActiveSubscription(userId);
        
        // Get current battle pass
        const now = new Date();
        const battlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });

        // Get user battle pass status
        let battlePassStatus = null;
        if (battlePass) {
            const userBattlePass = await UserBattlePass.findOne({
                userId,
                battle_pass_id: battlePass._id
            });

            battlePassStatus = {
                exists: !!userBattlePass,
                is_elite: userBattlePass ? userBattlePass.is_elite : false,
                name: battlePass.name,
                start_date: battlePass.start_date,
                end_date: battlePass.end_date,
                current_level: userBattlePass ? userBattlePass.current_level : 0
            };
        }

        // Check elite pass status
        const elitePassActive = user.elite_pass && 
            user.elite_pass.active && 
            user.elite_pass.end_date && 
            new Date(user.elite_pass.end_date) > now;

        // Prepare response
        const response = {
            success: true,
            subscription: subscription ? {
                type: subscription.type,
                start_date: subscription.start_date,
                end_date: subscription.end_date,
                auto_renew: subscription.auto_renew,
                days_remaining: subscription.end_date ? 
                    Math.ceil((new Date(subscription.end_date) - now) / (1000 * 60 * 60 * 24)) : 0,
                is_active: subscription.active
            } : null,
            elite_pass: {
                is_active: elitePassActive,
                start_date: user.elite_pass?.start_date || user.elite_pass?.activated_at,
                end_date: user.elite_pass?.end_date || user.elite_pass?.expires_at,
                days_remaining: user.elite_pass?.end_date || user.elite_pass?.expires_at ? 
                    Math.ceil((new Date(user.elite_pass.end_date || user.elite_pass.expires_at) - now) / (1000 * 60 * 60 * 24)) : 0
            },
            battle_pass: battlePassStatus,
            status_summary: {
                has_active_subscription: !!subscription && subscription.active,
                has_active_elite_pass: elitePassActive,
                has_elite_battle_pass: battlePassStatus ? battlePassStatus.is_elite : false
            }
        };
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Error checking full subscription status:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking subscription status',
            error: error.message
        });
    }
});

// Get user's subscription history
router.get('/subscription-history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get the user's subscription history
        const subscriptionHistory = user.subscription_history || [];
        
        // Get current active subscription from the Subscription model
        const activeSubscription = await Subscription.getActiveSubscription(userId);
        
        res.status(200).json({
            success: true,
            message: 'Subscription history retrieved successfully',
            data: {
                subscription_history: subscriptionHistory,
                has_active_subscription: !!activeSubscription,
                active_subscription: activeSubscription,
                elite_pass: user.elite_pass
            }
        });
    } catch (error) {
        console.error('Error retrieving subscription history:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving subscription history',
            error: error.message
        });
    }
});

module.exports = router; 