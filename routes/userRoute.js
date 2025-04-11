const express = require('express');
const router = express.Router();
const { 
    updateUserGold, 
    getBuildingGoldDetails, 
    assignBuildingToUser,
    assignMultipleBuildingsToUser,
    addCreatureToBuilding,
    updateBuildingCreatureLevel,
    getBuildingCreatures,
    getUserWithDetails,
    getUserBuildings,
    updateBuildingPosition,
    deleteCreatureFromBuilding,
    deleteBuildingFromUser,
    getTotalCreaturesForUser
} = require('../service/userService');

// Get a user with buildings and creatures
router.get('/:userId', async (req, res) => {
    try {
        const user = await getUserWithDetails(req.params.userId);
        res.status(200).json({
            success: true,
            message: 'User details fetched successfully',
            data: user
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

router.get('/update-gold/:userId', async (req, res) => {
    try {
        const { boost } = req.query; // Get boost percentage from query params
        const result = await updateUserGold(req.params.userId, boost);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get gold details for a specific building
router.get('/:userId/building/:buildingId', async (req, res) => {
    try {
        const { userId, buildingId } = req.params;
        const { boost } = req.query; // Get boost percentage from query params
        const buildingDetails = await getBuildingGoldDetails(userId, buildingId, boost);
        res.json(buildingDetails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Assign an existing building to a user
router.post('/:userId/buildings/assign', async (req, res) => {
    try {
        const { userId } = req.params;
        const { buildingId, position, creatureId } = req.body;
        
        if (!buildingId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Building ID is required' 
            });
        }

        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid position (x, y) is required' 
            });
        }
        
        const result = await assignBuildingToUser(userId, buildingId, position, creatureId);
        res.status(201).json(result);
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Assign multiple buildings to user
router.post('/:userId/buildings/assign-multiple', async (req, res) => {
    try {
        const { userId } = req.params;
        const { buildingIds } = req.body;
        
        if (!buildingIds || !Array.isArray(buildingIds) || buildingIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Array of building IDs is required' 
            });
        }
        
        const result = await assignMultipleBuildingsToUser(userId, buildingIds);
        res.status(201).json({
            success: true,
            message: 'Buildings assigned to user successfully',
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Add creature to building
router.post('/:userId/buildings/:buildingIdentifier/creatures/:creatureId', async (req, res) => {
    try {
        const { userId, buildingIdentifier, creatureId } = req.params;
        const result = await addCreatureToBuilding(userId, buildingIdentifier, creatureId);
        
        res.status(200).json({
            success: true,
            message: 'Creature added to building successfully',
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Update a specific creature's level in a user's building
router.put('/:userId/buildings/:buildingId/creatures/:creatureId/level/:levelNumber', async (req, res) => {
    try {
        const { userId, buildingId, creatureId, levelNumber } = req.params;
        const newLevelNumber = parseInt(levelNumber);
        
        if (isNaN(newLevelNumber)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Level number must be a valid number' 
            });
        }
        
        const result = await updateBuildingCreatureLevel(userId, buildingId, creatureId, newLevelNumber);
        
        res.status(200).json({
            success: true,
            message: `Creature level updated to ${newLevelNumber}`,
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found') || 
            error.message.includes('does not have') ||
            error.message.includes('must be between')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Get building creatures details
router.get('/:userId/buildings/:buildingId/creatures', async (req, res) => {
    try {
        const { userId, buildingId } = req.params;
        const result = await getBuildingCreatures(userId, buildingId);
        
        res.status(200).json({
            success: true,
            message: 'Building creatures fetched successfully',
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Get user buildings
router.get('/:userId/buildings', async (req, res) => {
    try {
        const result = await getUserBuildings(req.params.userId);
        res.status(200).json(result);
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Update building position
router.put('/:userId/buildings/:buildingId/position', async (req, res) => {
    try {
        const { userId, buildingId } = req.params;
        const { position } = req.body;

        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Valid position (x, y) is required'
            });
        }

        const result = await updateBuildingPosition(userId, buildingId, position);
        
        res.status(200).json({
            success: true,
            message: 'Building position updated successfully',
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

router.delete('/:userId/buildings/:index/creatures/:creatureId', async (req, res) => {
    try {
        const { userId, index, creatureId } = req.params;
        const result = await deleteCreatureFromBuilding(userId, index, creatureId);

        res.status(200).json({
            success: true,
            message: 'Creature deleted from building successfully',
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete a building from a user
router.delete('/:userId/buildings/:index', async (req, res) => {
    try {
        const { userId, index } = req.params;
        const result = await deleteBuildingFromUser(userId, index);
        
        res.status(200).json({
            success: true,
            message: 'Building deleted from user successfully',
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Get total creatures for a user
router.get('/:userId/creatures/total', async (req, res) => {
    try {
        const { userId } = req.params;
        const totalCreatures = await getTotalCreaturesForUser(userId);
        
        res.status(200).json({
            success: true,
            message: 'Total creatures fetched successfully',
            data: { totalCreatures }
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

module.exports = router;