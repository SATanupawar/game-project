const express = require('express');
const router = express.Router();
const { 
    getAllCreatures,
    getCreatureById,
    getCreatureStats,
    updateCreatureLevel,
    createCreature
} = require('../service/creatureService');

// Get all creatures
router.get('/', async (req, res) => {
    try {
        const creatures = await getAllCreatures();
        res.status(200).json({
            success: true,
            message: 'Creatures fetched successfully',
            data: creatures
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get creature by ID
router.get('/:creatureId', async (req, res) => {
    try {
        const creature = await getCreatureById(req.params.creatureId);
        res.status(200).json({
            success: true,
            message: 'Creature fetched successfully',
            data: creature
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

// Get creature stats for all levels
router.get('/:creatureId/stats', async (req, res) => {
    try {
        const result = await getCreatureStats(req.params.creatureId);
        res.status(200).json({
            success: true,
            message: 'Creature stats fetched successfully',
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

// Update creature level
router.put('/:creatureId/level/:levelNumber', async (req, res) => {
    try {
        const levelNumber = parseInt(req.params.levelNumber);
        
        if (isNaN(levelNumber)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Level number must be a valid number' 
            });
        }
        
        const result = await updateCreatureLevel(req.params.creatureId, levelNumber);
        res.status(200).json({
            success: true,
            message: `Creature level updated to ${levelNumber}`,
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found') || 
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

// Create a new creature
router.post('/', async (req, res) => {
    try {
        // Validate required fields
        const requiredFields = ['creature_Id', 'name', 'type', 'rarity', 'base_attack', 'base_health', 'gold_coins', 'description', 'image'];
        
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({
                    success: false,
                    message: `Missing required field: ${field}`
                });
            }
        }
        
        // Validate rarity
        const validRarities = ['common', 'rare', 'epic', 'legendary'];
        if (!validRarities.includes(req.body.rarity)) {
            return res.status(400).json({
                success: false,
                message: `Invalid rarity. Must be one of: ${validRarities.join(', ')}`
            });
        }
        
        const creature = await createCreature(req.body);
        res.status(201).json({
            success: true,
            message: 'Creature created successfully',
            data: creature
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
