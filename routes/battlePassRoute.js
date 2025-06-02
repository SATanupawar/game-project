const express = require('express');
const router = express.Router();
const battlePassService = require('../service/directBattlePassService');

// Get current active battle pass
router.get('/battle-pass/current', async (req, res) => {
    try {
        const result = await battlePassService.getCurrentBattlePass();
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting current battle pass:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting current battle pass',
            error: error.message
        });
    }
});

// Get user's battle pass progress
router.get('/battle-pass/progress/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const result = await battlePassService.getUserBattlePassProgress(userId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting battle pass progress:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting battle pass progress',
            error: error.message
        });
    }
});

// Add XP to user's battle pass
router.post('/battle-pass/add-xp', async (req, res) => {
    try {
        const { userId, xpAmount, source } = req.body;
        
        if (!userId || !xpAmount) {
            return res.status(400).json({
                success: false,
                message: 'User ID and XP amount are required'
            });
        }
        
        const result = await battlePassService.addUserBattlePassXP(
            userId,
            parseInt(xpAmount),
            source || 'unknown'
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error adding battle pass XP:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding battle pass XP',
            error: error.message
        });
    }
});

// Claim battle pass reward
router.post('/battle-pass/claim-reward', async (req, res) => {
    try {
        const { userId, level, isElite } = req.body;
        
        if (!userId || !level) {
            return res.status(400).json({
                success: false,
                message: 'User ID and level are required'
            });
        }
        
        const result = await battlePassService.claimBattlePassReward(
            userId,
            parseInt(level),
            isElite === true || isElite === "true" || isElite === 1 || isElite === "1"
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error claiming battle pass reward:', error);
        res.status(500).json({
            success: false,
            message: 'Error claiming battle pass reward',
            error: error.message
        });
    }
});

// Upgrade to elite battle pass
router.post('/battle-pass/upgrade-elite', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const result = await battlePassService.upgradeToEliteBattlePass(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error upgrading to elite battle pass:', error);
        res.status(500).json({
            success: false,
            message: 'Error upgrading to elite battle pass',
            error: error.message
        });
    }
});

// Admin endpoint to create a new battle pass
router.post('/battle-pass/create', async (req, res) => {
    try {
        const battlePassData = req.body;
        
        if (!battlePassData || !battlePassData.name || !battlePassData.start_date || !battlePassData.end_date) {
            return res.status(400).json({
                success: false,
                message: 'Battle Pass name, start date, and end date are required'
            });
        }
        
        const result = await battlePassService.createBattlePass(battlePassData);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating battle pass:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating battle pass',
            error: error.message
        });
    }
});

// Sync a user's battle pass summary
router.post('/battle-pass/sync-summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const result = await battlePassService.syncUserBattlePassSummary(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error syncing battle pass summary:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing battle pass summary',
            error: error.message
        });
    }
});

module.exports = router; 