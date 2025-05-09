const express = require('express');
const router = express.Router();
const buildingDecorationService = require('../service/buildingDecorationService');
const userService = require('../service/userService');

// Get all building decorations
router.get('/', async (req, res) => {
    try {
        const decorations = await buildingDecorationService.getAllDecorations();
        res.json({
            success: true,
            message: 'Building decorations fetched successfully',
            data: decorations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching building decorations',
            error: error.message
        });
    }
});

// Get building decorations available for a player level
router.get('/available/:level', async (req, res) => {
    try {
        const playerLevel = parseInt(req.params.level);
        
        if (isNaN(playerLevel) || playerLevel < 1) {
            return res.status(400).json({
                success: false,
                message: 'Valid player level is required'
            });
        }
        
        const decorations = await buildingDecorationService.getDecorationsByLevel(playerLevel);
        
        res.json({
            success: true,
            message: `Building decorations available for player level ${playerLevel}`,
            data: decorations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching building decorations by level',
            error: error.message
        });
    }
});

// Get building decoration by ID
router.get('/:decorationId', async (req, res) => {
    try {
        const decoration = await buildingDecorationService.getDecorationById(req.params.decorationId);
        res.json({
            success: true,
            data: decoration
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Assign a decoration building to a user
 * 
 * This endpoint handles the process of adding a decoration building to a user's buildings array.
 * 
 * URL Parameters:
 * - userId: ID of the user to assign the decoration to
 * 
 * Request body should contain:
 * {
 *   "decorationId": "fountain_01",  // Required: ID of the decoration to assign
 *   "position": {                    // Required: Coordinates for the decoration
 *     "x": 10,
 *     "y": 15
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Decoration building added successfully",
 *   "decoration": {
 *     "buildingId": "decoration1",
 *     "name": "Fountain",
 *     "position": { "x": 10, "y": 15 },
 *     "size": { "x": 2, "y": 2 },
 *     "index": 1234567890,
 *     "boostPercent": 10,
 *     "is_decoration": true
 *   }
 * }
 */
router.post('/user/:userId/assign', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { decorationId, position } = req.body;
        
        // Validate required fields
        if (!decorationId) {
            return res.status(400).json({
                success: false,
                message: 'Decoration ID is required'
            });
        }
        
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Valid position coordinates (x, y) are required'
            });
        }

        // Call userService to assign decoration to user
        const result = await userService.assignDecorationToUser(
            userId,
            decorationId,
            position
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error assigning decoration to user',
            error: error.message
        });
    }
});

/**
 * Update the position of a boost/decoration building
 * 
 * This endpoint handles the complete process of updating a decoration building's position
 * and managing gold generation for affected buildings
 * 
 * URL Parameters:
 * - userId: ID of the user
 * 
 * Request body should contain:
 * {
 *   "decorationId": "fountain_01",     // Required: ID of the decoration building to update
 *   "newPosition": {                    // Required: New coordinates for the decoration
 *     "x": 10,
 *     "y": 15
 *   },
 *   "previouslyAffectedBuildings": [    // Optional: Buildings previously affected by this decoration
 *     { 
 *       "buildingIndex": 1234567890,    // Index of a building that was in boost range
 *       "boostPercent": 10              // The boost percentage that was applied
 *     }
 *   ],
 *   "newlyAffectedBuildings": [         // Optional: Buildings now in range of the decoration
 *     {
 *       "buildingIndex": 1234567891,    // Index of a building now in boost range
 *       "boostPercent": 10              // The boost percentage to apply
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Decoration position updated and affected buildings recalculated",
 *   "decorationId": "decoration1",
 *   "newPosition": { "x": 10, "y": 15 },
 *   "affectedBuildings": {
 *     "previously": 1,
 *     "newly": 1
 *   }
 * }
 */
router.put('/user/:userId/update-position', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { decorationId, newPosition, previouslyAffectedBuildings, newlyAffectedBuildings } = req.body;
        
        if (!decorationId) {
            return res.status(400).json({
                success: false,
                message: 'Decoration ID is required'
            });
        }
        
        if (!newPosition || typeof newPosition.x !== 'number' || typeof newPosition.y !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Valid position coordinates (x, y) are required'
            });
        }

        // Process affected buildings to use building index instead of ID
        const processedPreviousBuildings = previouslyAffectedBuildings ? 
            previouslyAffectedBuildings.map(building => ({
                buildingIndex: building.buildingIndex,
                boostPercent: building.boostPercent
            })) : [];

        const processedNewBuildings = newlyAffectedBuildings ? 
            newlyAffectedBuildings.map(building => ({
                buildingIndex: building.buildingIndex,
                boostPercent: building.boostPercent
            })) : [];

        // Call userService to update position and calculate gold
        const result = await userService.updateDecorationPosition(
            userId,
            decorationId,
            newPosition,
            processedPreviousBuildings,
            processedNewBuildings
        );
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error updating decoration position',
            error: error.message
        });
    }
});

module.exports = router;