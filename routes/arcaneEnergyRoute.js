const express = require('express');
const router = express.Router();
const arcaneEnergyService = require('../service/arcaneEnergyService');

// Add Arcane Energy building to a user
router.post('/user/:userId/add', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameter: userId'
            });
        }
        
        const result = await arcaneEnergyService.addArcaneEnergyBuilding(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in add Arcane Energy building route:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Start Arcane Energy production
router.post('/user/:userId/start', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameter: userId'
            });
        }
        
        const result = await arcaneEnergyService.startProduction(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in start Arcane Energy production route:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Collect Arcane Energy
router.post('/user/:userId/collect', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameter: userId'
            });
        }
        
        const result = await arcaneEnergyService.collectEnergy(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in collect Arcane Energy route:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Upgrade Arcane Energy building to specific level
router.post('/user/:userId/upgrade/:level', async (req, res) => {
    try {
        const { userId, level } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameter: userId'
            });
        }

        if (!level || isNaN(level) || level < 1 || level > 8) {
            return res.status(400).json({
                success: false,
                message: 'Invalid level parameter. Level must be between 1 and 8'
            });
        }
        
        const result = await arcaneEnergyService.upgradeBuildingToLevel(userId, parseInt(level));
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in upgrade Arcane Energy building route:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

module.exports = router; 