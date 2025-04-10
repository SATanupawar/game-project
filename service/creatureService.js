const mongoose = require('mongoose');
const Creature = require('../models/creature');
const CreatureLevel = require('../models/creature_level');

/**
 * Get all creatures
 * @returns {Promise<Array>} Array of creatures
 */
const getAllCreatures = async () => {
    try {
        const creatures = await Creature.find().populate('level');
        return creatures;
    } catch (error) {
        throw new Error(`Error fetching creatures: ${error.message}`);
    }
};

/**
 * Get creature by ID
 * @param {string} creatureId - Creature ID
 * @returns {Promise<Object>} Creature object
 */
const getCreatureById = async (creatureId) => {
    try {
        let creature = null;
        
        // Try to find by creature_Id first
        creature = await Creature.findOne({ creature_Id: creatureId }).populate('level');
        
        // If not found and valid ObjectId, try by _id
        if (!creature && mongoose.Types.ObjectId.isValid(creatureId)) {
            creature = await Creature.findById(creatureId).populate('level');
        }

        if (!creature) {
            throw new Error('Creature not found');
        }

        return creature;
    } catch (error) {
        throw new Error(`Error fetching creature: ${error.message}`);
    }
};

/**
 * Get all levels for a specific creature
 * @param {string} creatureId - Creature ID
 * @returns {Promise<Object>} Object containing creature and levels
 */
const getCreatureLevels = async (creatureId) => {
    try {
        let creature = null;
        
        // Try to find by creature_Id first
        creature = await Creature.findOne({ creature_Id: creatureId });
        
        // If not found and valid ObjectId, try by _id
        if (!creature && mongoose.Types.ObjectId.isValid(creatureId)) {
            creature = await Creature.findById(creatureId);
        }

        if (!creature) {
            throw new Error('Creature not found');
        }

        const levels = await CreatureLevel.find({ creature_Id: creature.creature_Id })
            .sort({ level: 1 });

        return {
            creature: {
                creature_Id: creature.creature_Id,
                name: creature.name,
                type: creature.type,
                image: creature.image
            },
            levels: levels
        };
    } catch (error) {
        throw new Error(`Error fetching creature levels: ${error.message}`);
    }
};

/**
 * Update creature level
 * @param {string} creatureId - Creature ID
 * @param {number} levelNumber - New level number
 * @returns {Promise<Object>} Updated creature object
 */
const updateCreatureLevel = async (creatureId, levelNumber) => {
    try {
        let creature = null;
        
        // Try to find by creature_Id first
        creature = await Creature.findOne({ creature_Id: creatureId });
        
        // If not found and valid ObjectId, try by _id
        if (!creature && mongoose.Types.ObjectId.isValid(creatureId)) {
            creature = await Creature.findById(creatureId);
        }

        if (!creature) {
            throw new Error('Creature not found');
        }

        // Make sure the new level is valid (1-40)
        if (levelNumber < 1 || levelNumber > 40) {
            throw new Error('Level must be between 1 and 40');
        }

        // Find the requested level
        const newLevel = await CreatureLevel.findOne({
            creature_Id: creature.creature_Id,
            level: levelNumber
        });

        if (!newLevel) {
            throw new Error(`Level ${levelNumber} not found for this creature`);
        }

        // Store the previous level
        const previousLevel = creature.levelNumber;

        // Update the creature's level
        creature.level = newLevel._id;
        creature.levelNumber = levelNumber;
        await creature.save();

        return {
            creature: {
                creature_Id: creature.creature_Id,
                name: creature.name,
                previousLevel: previousLevel,
                newLevel: levelNumber,
                attack: newLevel.attack,
                health: newLevel.health,
                speed: newLevel.speed,
                armor: newLevel.armor,
                critical_health: newLevel.critical_health,
                critical_damage: newLevel.critical_damage
            }
        };
    } catch (error) {
        throw new Error(`Error updating creature level: ${error.message}`);
    }
};

module.exports = {
    getAllCreatures,
    getCreatureById,
    getCreatureLevels,
    updateCreatureLevel
};
