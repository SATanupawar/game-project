const mongoose = require('mongoose');
const Creature = require('../models/creature');

/**
 * Get all creatures
 * @returns {Promise<Array>} Array of creatures with their level stats
 */
const getAllCreatures = async () => {
    try {
        const creatures = await Creature.find();
        return creatures.map(creature => {
            const stats = creature.getCurrentStats();
            // Sort level stats by level for consistent order
            const sortedLevelStats = [...creature.level_stats].sort((a, b) => a.level - b.level);
            
            return {
                _id: creature._id,
                creature_Id: creature.creature_Id,
                name: creature.name,
                type: creature.type,
                level: creature.level,
                gold_coins: creature.gold_coins,
                arcane_energy: creature.arcane_energy,
                base_attack: creature.base_attack,
                base_health: creature.base_health,
                attack: stats.attack,
                health: stats.health,
                speed: stats.speed,
                armor: stats.armor,
                critical_damage_percentage: stats.critical_damage_percentage,
                critical_damage: stats.critical_damage,
                gold: stats.gold,
                arcane_energy: stats.arcane_energy,
                image: creature.image,
                description: creature.description,
                // Include all level stats
                level_stats: sortedLevelStats
            };
        });
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
        creature = await Creature.findOne({ creature_Id: creatureId });
        
        // If not found and valid ObjectId, try by _id
        if (!creature && mongoose.Types.ObjectId.isValid(creatureId)) {
            creature = await Creature.findById(creatureId);
        }

        if (!creature) {
            throw new Error('Creature not found');
        }

        // Get calculated stats for current level
        const stats = creature.getCurrentStats();

        return {
            _id: creature._id,
            creature_Id: creature.creature_Id,
            name: creature.name,
            type: creature.type,
            level: creature.level,
            gold_coins: creature.gold_coins,
            arcane_energy: creature.arcane_energy,
            base_attack: creature.base_attack,
            base_health: creature.base_health,
            attack: stats.attack,
            health: stats.health,
            speed: stats.speed,
            armor: stats.armor,
            critical_damage_percentage: stats.critical_damage_percentage,
            critical_damage: stats.critical_damage,
            gold: stats.gold,
            arcane_energy: stats.arcane_energy,
            image: creature.image,
            description: creature.description
        };
    } catch (error) {
        throw new Error(`Error fetching creature: ${error.message}`);
    }
};

/**
 * Get creature stats for all levels
 * @param {string} creatureId - Creature ID
 * @returns {Promise<Object>} Object containing stats for all levels
 */
const getCreatureStats = async (creatureId) => {
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

        // Return all level stats
        return {
            creature: {
                creature_Id: creature.creature_Id,
                name: creature.name,
                type: creature.type,
                image: creature.image,
                current_level: creature.level,
                gold_coins: creature.gold_coins,
                arcane_energy: creature.arcane_energy
            },
            stats: creature.level_stats.sort((a, b) => a.level - b.level)
        };
    } catch (error) {
        throw new Error(`Error fetching creature stats: ${error.message}`);
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

        // Store the previous level
        const previousLevel = creature.level;

        // Update the creature's level
        if (!creature.setLevel(levelNumber)) {
            throw new Error(`Level ${levelNumber} stats not found for this creature`);
        }

        // Save the creature
        await creature.save();

        // Get updated stats
        const newStats = creature.getCurrentStats();

        return {
            creature: {
                creature_Id: creature.creature_Id,
                name: creature.name,
                type: creature.type,
                previousLevel: previousLevel,
                newLevel: levelNumber,
                attack: newStats.attack,
                health: newStats.health,
                speed: newStats.speed,
                armor: newStats.armor,
                critical_damage_percentage: newStats.critical_damage_percentage,
                critical_damage: newStats.critical_damage,
                gold: newStats.gold,
                arcane_energy: newStats.arcane_energy
            }
        };
    } catch (error) {
        throw new Error(`Error updating creature level: ${error.message}`);
    }
};

/**
 * Create a new creature with pre-calculated level stats
 * @param {Object} creatureData - Creature data
 * @returns {Promise<Object>} Created creature
 */
const createCreature = async (creatureData) => {
    try {
        // Create the creature (level stats will be auto-generated in pre-save hook)
        const creature = new Creature(creatureData);
        await creature.save();
        
        // Get current stats
        const stats = creature.getCurrentStats();
        
        return {
            _id: creature._id,
            creature_Id: creature.creature_Id,
            name: creature.name,
            type: creature.type,
            level: creature.level,
            gold_coins: creature.gold_coins,
            arcane_energy: creature.arcane_energy,
            base_attack: creature.base_attack,
            base_health: creature.base_health,
            attack: stats.attack,
            health: stats.health,
            speed: stats.speed,
            armor: stats.armor,
            critical_damage_percentage: stats.critical_damage_percentage,
            critical_damage: stats.critical_damage,
            gold: stats.gold,
            arcane_energy: stats.arcane_energy,
            image: creature.image,
            description: creature.description,
            level_stats_count: creature.level_stats.length
        };
    } catch (error) {
        throw new Error(`Error creating creature: ${error.message}`);
    }
};

module.exports = {
    getAllCreatures,
    getCreatureById,
    getCreatureStats,
    updateCreatureLevel,
    createCreature
};
