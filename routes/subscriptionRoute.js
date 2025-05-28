const express = require('express');
const router = express.Router();
const subscriptionService = require('../service/subscriptionService');

// Create a new subscription
router.post('/subscriptions', async (req, res) => {
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
router.get('/subscriptions/:userId', async (req, res) => {
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
router.post('/subscriptions/:userId/cancel', async (req, res) => {
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
router.post('/subscriptions/:userId/renew', async (req, res) => {
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
router.post('/subscriptions/check-expired', async (req, res) => {
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

module.exports = router; 