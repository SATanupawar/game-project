const express = require('express');
const router = express.Router();
const battlePassProgressService = require('../service/battlePassProgressService');

// Get user's detailed battle pass progress
router.get('/battle-pass/progress/detailed/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const result = await battlePassProgressService.getUserBattlePassProgress(userId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting detailed battle pass progress:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting detailed battle pass progress',
            error: error.message
        });
    }
});

// Get battle pass leaderboard
router.get('/battle-pass/leaderboard', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 20;
        
        const result = await battlePassProgressService.getBattlePassLeaderboard(limit);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting battle pass leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting battle pass leaderboard',
            error: error.message
        });
    }
});

// Get user's next available rewards
router.get('/battle-pass/next-rewards/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const result = await battlePassProgressService.getNextAvailableRewards(userId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting next available rewards:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting next available rewards',
            error: error.message
        });
    }
});

module.exports = router; 