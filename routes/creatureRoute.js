const express = require('express');
const router = express.Router();
const creatureService = require('../service/creatureService');

// Get all creatures
router.get('/', async (req, res) => {
    try {
        const creatures = await creatureService.getAllCreatures();
        res.status(200).json(creatures);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get creature by ID
router.get('/:creatureId', async (req, res) => {
    try {
        const creature = await creatureService.getCreatureById(req.params.creatureId);
        res.status(200).json(creature);
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
});

// Get all levels for a specific creature
router.get('/:creatureId/levels', async (req, res) => {
    try {
        const levels = await creatureService.getCreatureLevels(req.params.creatureId);
        res.status(200).json(levels);
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
});

// Update creature level
router.put('/:creatureId/level/:levelNumber', async (req, res) => {
    try {
        const levelNumber = parseInt(req.params.levelNumber);
        if (isNaN(levelNumber) || levelNumber < 1 || levelNumber > 40) {
            return res.status(400).json({ message: 'Level number must be between 1 and 40' });
        }

        const updatedCreature = await creatureService.updateCreatureLevel(
            req.params.creatureId,
            levelNumber
        );
        
        res.status(200).json(updatedCreature);
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message });
        }
    }
});

module.exports = router;
