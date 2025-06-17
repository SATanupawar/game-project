const express = require('express');
const router = express.Router();
const buildingService = require('../service/buildingService');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Apply general rate limiter to all building routes
router.use(createRateLimiter('general'));

// Get all buildings
router.get('/', async (req, res) => {
    try {
        const buildings = await buildingService.getAllBuildings();
        res.json({
            success: true,
            data: buildings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching buildings',
            error: error.message
        });
    }
});

// Get building by ID
router.get('/:buildingId', async (req, res) => {
    try {
        const building = await buildingService.getBuildingById(req.params.buildingId);
        res.json({
            success: true,
            data: building
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
});

// Update building position
router.put('/:buildingId/position', async (req, res) => {
    try {
        const { buildingId } = req.params;
        const { x, y, userId } = req.body;

        const updatedBuilding = await buildingService.updateBuildingPosition(buildingId, x, y);
        
        // Update quest progress if userId is provided
        if (userId) {
            try {
                // Import quest service
                const questService = require('../service/questService');
                
                // Update quest progress for building placement/movement
                await questService.updateQuestProgress(userId, 'move_building', 1);
            } catch (questError) {
                console.error('Error updating quest progress:', questError);
                // Continue with response even if quest update fails
            }
        }
        
        res.json({
            success: true,
            message: 'Building position updated successfully',
            data: updatedBuilding
        });
    } catch (error) {
        if (error.message === 'X and Y coordinates must be numbers') {
            res.status(400).json({
                success: false,
                message: error.message
            });
        } else if (error.message === 'Building not found') {
            res.status(404).json({
                success: false,
                message: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Error updating building position',
                error: error.message
            });
        }
    }
});

// Get buildings available for a player level
router.get('/available/:level', async (req, res) => {
    try {
        const playerLevel = parseInt(req.params.level);
        
        if (isNaN(playerLevel) || playerLevel < 1) {
            return res.status(400).json({
                success: false,
                message: 'Valid player level is required'
            });
        }
        
        const buildings = await buildingService.getBuildingsByLevel(playerLevel);
        
        res.json({
            success: true,
            message: `Buildings available for player level ${playerLevel}`,
            data: buildings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching buildings by level',
            error: error.message
        });
    }
});

// Sell a building
router.post('/sell/:userId/:buildingIndex', async (req, res) => {
    try {
        const { userId, buildingIndex } = req.params;
        
        console.log(`Received request to sell building. User: ${userId}, Building Index: ${buildingIndex}`);
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        if (!buildingIndex) {
            return res.status(400).json({
                success: false,
                message: 'Building index is required'
            });
        }
        
        // Convert buildingIndex to number
        const buildingIndexNumber = parseInt(buildingIndex, 10);
        if (isNaN(buildingIndexNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Building index must be a valid number'
            });
        }
        
        const result = await buildingService.sellBuilding(userId, buildingIndexNumber);
        
        res.status(200).json({
            success: true,
            message: 'Building sold successfully',
            data: result
        });
    } catch (error) {
        console.error('Error selling building:', error);
        
        // Check for specific error types
        if (error.message.includes('creatures')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                error_code: 'CREATURES_PRESENT'
            });
        } else if (error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                message: error.message
            });
        } else if (error.message.includes('must be a valid number')) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Error selling building',
            error: error.message
        });
    }
});

module.exports = router;
