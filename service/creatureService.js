const Creature = require('../models/creature');
const CreatureLevel = require('../models/creature_level');

/**
 * Get all creatures
 * @returns {Promise<Array>} Array of creatures
 */
const getAllCreatures = async () => {
    try {
        return await Creature.find();
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
        const creature = await Creature.findOne({ creature_Id: creatureId });
        if (!creature) {
            throw new Error(`Creature with ID ${creatureId} not found`);
        }
        return creature;
    } catch (error) {
        throw new Error(`Error fetching creature: ${error.message}`);
    }
};

/**
 * Get all levels for a specific creature
 * @param {string} creatureId - Creature ID
 * @returns {Promise<Array>} Array of levels
 */
const getCreatureLevels = async (creatureId) => {
    try {
        const levels = await CreatureLevel.find({ creature_Id: creatureId }).sort('level');
        if (!levels.length) {
            throw new Error(`No levels found for creature with ID ${creatureId}`);
        }
        return levels;
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
        // Find the creature
        const creature = await Creature.findOne({ creature_Id: creatureId });
        if (!creature) {
            throw new Error(`Creature with ID ${creatureId} not found`);
        }

        // Find the new level
        const newLevel = await CreatureLevel.findOne({
            creature_Id: creatureId,
            level: levelNumber
        });

        if (!newLevel) {
            throw new Error(`Level ${levelNumber} not found for creature with ID ${creatureId}`);
        }

        // Update the creature's level
        creature.level = newLevel._id;
        creature.levelNumber = newLevel.level;
        await creature.save();

        return creature;
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
