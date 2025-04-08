const express = require('express');
const router = express.Router();
const buildingService = require('../service/buildingService');

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
        const { x, y } = req.body;

        const updatedBuilding = await buildingService.updateBuildingPosition(buildingId, x, y);
        
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

module.exports = router;
