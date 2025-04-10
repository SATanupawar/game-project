const express = require('express');
const router = express.Router();
const { 
    getAllCreatures,
    getCreatureById,
    getCreatureLevels,
    updateCreatureLevel
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

// Get creature levels
router.get('/:creatureId/levels', async (req, res) => {
    try {
        const result = await getCreatureLevels(req.params.creatureId);
        res.status(200).json({
            success: true,
            message: 'Creature levels fetched successfully',
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

module.exports = router;
