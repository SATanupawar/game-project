const mongoose = require('mongoose');
const User = require('../models/user');
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

/**
 * Speed up creature unlocking process
 */
async function speedUpUnlock(userId, creatureId) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Find the creature in creating_creatures array using _id
        const creatureIndex = user.creating_creatures.findIndex(
            creature => creature._id.toString() === creatureId
        );

        if (creatureIndex === -1) {
            return {
                success: false,
                message: 'Creature not found in creating creatures'
            };
        }

        const creature = user.creating_creatures[creatureIndex];

        // Get the creature data to determine rarity
        const creatureData = await Creature.findOne({ creature_Id: creature.creature_type });
        if (!creatureData) {
            return {
                success: false,
                message: 'Creature data not found'
            };
        }

        // Determine speed-up cost based on creature type
        let speedUpCost;
        const creatureType = creature.creature_type.toLowerCase();

        // Check if it's a dragon (legendary/elite)
        if (creatureType.includes('legendary') || creatureType.includes('elite')) {
            speedUpCost = 500;
        }
        // Check for other creature types
        else if (creatureType.includes('epic')) {
            speedUpCost = 200;
        }
        else if (creatureType.includes('rare')) {
            speedUpCost = 75;
        }
        else {
            speedUpCost = 10; // Default for common creatures
        }

        // Check if user has enough gems
        if (!user.currency || !user.currency.gems || user.currency.gems < speedUpCost) {
            return {
                success: false,
                message: `Not enough gems. Required: ${speedUpCost}`
            };
        }

        // Deduct gems
        user.currency.gems -= speedUpCost;

        // Move creature from creating_creatures to creatures array
        const newCreature = {
            creature_id: creature.creature_id,
            name: creature.name,
            level: creature.level,
            building_index: 0, // Will be assigned when placed in a building
            creature_type: creature.creature_type,
            base_attack: creature.base_attack,
            base_health: creature.base_health,
            attack: creature.base_attack,
            health: creature.base_health,
            gold_coins: creature.gold_coins,
            count: 1
        };

        user.creatures.push(newCreature);
        user.creating_creatures.splice(creatureIndex, 1);

        // Save changes
        user.markModified('currency');
        user.markModified('creating_creatures');
        user.markModified('creatures');
        await user.save();

        return {
            success: true,
            message: 'Creature unlocked successfully',
            data: {
                creature: newCreature,
                gems_spent: speedUpCost,
                remaining_gems: user.currency.gems
            }
        };
    } catch (error) {
        console.error('Error in speedUpUnlock:', error);
        return {
            success: false,
            message: `Error speeding up unlock: ${error.message}`
        };
    }
}

/**
 * Merge two creatures of the same type and level
 */
async function mergeCreatures(userId, creature1Id, creature2Id) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Find both creatures in user's creatures array
        const creature1Index = user.creatures.findIndex(c => c._id.toString() === creature1Id);
        const creature2Index = user.creatures.findIndex(c => c._id.toString() === creature2Id);

        if (creature1Index === -1 || creature2Index === -1) {
            return {
                success: false,
                message: 'One or both creatures not found'
            };
        }

        const creature1 = user.creatures[creature1Index];
        const creature2 = user.creatures[creature2Index];

        // Check if creatures are of the same type
        if (creature1.creature_type !== creature2.creature_type) {
            return {
                success: false,
                message: 'Cannot merge different types of creatures'
            };
        }

        // Check if creatures are of the same level
        if (creature1.level !== creature2.level) {
            return {
                success: false,
                message: 'Cannot merge creatures of different levels'
            };
        }

        // Check if creatures are at max level (40)
        if (creature1.level >= 40) {
            return {
                success: false,
                message: 'Creatures are already at maximum level'
            };
        }

        // Update active_merges array with can_collect flag
        if (!user.active_merges) {
            user.active_merges = [];
        }
        
        // Find existing merge entry
        const existingMergeIndex = user.active_merges.findIndex(
            m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                 (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
        );
        
        // Update existing or create new entry with can_collect = true
        if (existingMergeIndex !== -1) {
            user.active_merges[existingMergeIndex].can_collect = true;
        } else {
            const now = new Date();
            user.active_merges.push({
                creature1_id: creature1Id,
                creature2_id: creature2Id,
                start_time: now,
                can_collect: true,
                progress: 0
            });
        }
        
        user.markModified('active_merges');

        // Get the base creature data for stats calculation
        console.log(`Attempting to merge creatures:`, {
            creature1: {
                id: creature1._id,
                name: creature1.name,
                type: creature1.creature_type,
                reference: creature1.creature_Id_reference
            },
            creature2: {
                id: creature2._id,
                name: creature2.name, 
                type: creature2.creature_type,
                reference: creature2.creature_Id_reference
            }
        });

        // Try multiple ways to find the correct creature template
        let baseCreature = null;
        
        // Try by creature_Id_reference first (most reliable)
        if (creature1.creature_Id_reference) {
            console.log(`Looking up creature template by creature_Id_reference: ${creature1.creature_Id_reference}`);
            baseCreature = await Creature.findOne({ creature_Id: creature1.creature_Id_reference });
        }
        
        // If not found, try by creature_id
        if (!baseCreature && creature1.creature_id) {
            console.log(`Looking up creature template by creature_id: ${creature1.creature_id}`);
            baseCreature = await Creature.findOne({ _id: creature1.creature_id });
        }
        
        // If still not found, try by name
        if (!baseCreature && creature1.name) {
            console.log(`Looking up creature template by name: ${creature1.name}`);
            baseCreature = await Creature.findOne({ name: creature1.name });
        }
        
        // Last resort, try by creature_type
        if (!baseCreature) {
            console.log(`Looking up creature template by creature_type: ${creature1.creature_type}`);
            baseCreature = await Creature.findOne({ creature_type: creature1.creature_type });
        }
        
        // If still not found, try with a direct MongoDB query to see what's available
        if (!baseCreature) {
            console.log(`Failed to find creature template. Checking available templates...`);
            const allTemplates = await Creature.find({}, 'creature_Id name type creature_type');
            console.log(`Available templates:`, allTemplates.map(t => ({
                id: t._id,
                creature_Id: t.creature_Id,
                name: t.name, 
                type: t.type,
                creature_type: t.creature_type
            })));
            
            return {
                success: false,
                message: `Creature template not found for ${creature1.name} (${creature1.creature_Id_reference || creature1.creature_type})`,
                debug: {
                    searched: {
                        by_reference: creature1.creature_Id_reference,
                        by_id: creature1.creature_id,
                        by_name: creature1.name,
                        by_type: creature1.creature_type
                    },
                    available_templates: allTemplates.map(t => t.creature_Id)
                }
            };
        }
        
        console.log(`Found creature template:`, {
            id: baseCreature._id,
            creature_Id: baseCreature.creature_Id,
            name: baseCreature.name
        });

        // Calculate new level stats
        const newLevel = creature1.level + 1;
        
        // Check if template has getStatsForLevel method
        if (typeof baseCreature.getStatsForLevel !== 'function') {
            console.log(`Template missing getStatsForLevel method. Using level_stats array directly.`);
            
            // Find stats for this level in the level_stats array
            let newStats = {
                attack: creature1.base_attack || creature1.attack,
                health: creature1.base_health || creature1.health,
                gold_coins: baseCreature.gold_coins || creature1.gold_coins || 0,
                arcane_energy: baseCreature.arcane_energy || creature1.arcane_energy || 0
            };
            
            if (baseCreature.level_stats && Array.isArray(baseCreature.level_stats)) {
                const levelStats = baseCreature.level_stats.find(ls => ls.level === newLevel);
                if (levelStats) {
                    console.log(`Found level ${newLevel} stats:`, levelStats);
                    newStats.attack = levelStats.attack || newStats.attack;
                    newStats.health = levelStats.health || newStats.health;
                    newStats.gold = levelStats.gold || newStats.gold_coins;
                    newStats.arcane_energy = levelStats.arcane_energy || newStats.arcane_energy;
                } else {
                    console.log(`No level ${newLevel} stats found in template.`);
                }
            } else {
                console.log(`No level_stats array found in template.`);
            }
            
            // Create the merged creature
            const mergedCreature = {
                creature_id: creature1.creature_id,
                name: creature1.name,
                level: newLevel,
                building_index: creature1.building_index,
                creature_type: creature1.creature_type,
                creature_Id_reference: creature1.creature_Id_reference,
                base_attack: creature1.base_attack || newStats.attack,
                base_health: creature1.base_health || newStats.health,
                attack: newStats.attack,
                health: newStats.health,
                gold_coins: newStats.gold || newStats.gold_coins,
                arcane_energy: newStats.arcane_energy,
                count: 1,
                // Copy other properties from original creature
                critical_damage: creature1.critical_damage,
                critical_damage_percentage: creature1.critical_damage_percentage,
                armor: creature1.armor,
                speed: creature1.speed,
                image: creature1.image,
                description: creature1.description
            };
            
            // Remove both original creatures
            user.creatures.splice(Math.max(creature1Index, creature2Index), 1);
            user.creatures.splice(Math.min(creature1Index, creature2Index), 1);
            
            // Add the merged creature
            user.creatures.push(mergedCreature);
            
            // Save changes
            user.markModified('creatures');
            await user.save();
            
            return {
                success: true,
                message: `Successfully merged creatures to level ${newLevel}`,
                data: {
                    merged_creature: mergedCreature,
                    previous_level: creature1.level,
                    new_level: newLevel,
                    stats_increase: {
                        attack: newStats.attack - creature1.attack,
                        health: newStats.health - creature1.health
                    }
                }
            };
        }
        
        const newStats = baseCreature.getStatsForLevel(newLevel);

        // Create the merged creature
        const mergedCreature = {
            creature_id: creature1.creature_id,
            name: creature1.name,
            level: newLevel,
            building_index: creature1.building_index,
            creature_type: creature1.creature_type,
            creature_Id_reference: creature1.creature_Id_reference,
            base_attack: newStats.attack,
            base_health: newStats.health,
            attack: newStats.attack,
            health: newStats.health,
            gold_coins: creature1.gold_coins,
            arcane_energy: newStats.arcane_energy,
            count: 1,
            // Copy other properties from original creature
            critical_damage: creature1.critical_damage,
            critical_damage_percentage: creature1.critical_damage_percentage,
            armor: creature1.armor,
            speed: creature1.speed,
            image: creature1.image,
            description: creature1.description
        };

        // Remove both original creatures
        user.creatures.splice(Math.max(creature1Index, creature2Index), 1);
        user.creatures.splice(Math.min(creature1Index, creature2Index), 1);

        // Add the merged creature
        user.creatures.push(mergedCreature);

        // Save changes
        user.markModified('creatures');
        await user.save();

        return {
            success: true,
            message: `Successfully merged creatures to level ${newLevel}`,
            data: {
                merged_creature: mergedCreature,
                previous_level: creature1.level,
                new_level: newLevel,
                stats_increase: {
                    attack: newStats.attack - creature1.attack,
                    health: newStats.health - creature1.health
                }
            }
        };
    } catch (error) {
        console.error('Error in mergeCreatures:', error);
        return {
            success: false,
            message: `Error merging creatures: ${error.message}`
        };
    }
}

module.exports = {
    getAllCreatures,
    getCreatureById,
    getCreatureStats,
    updateCreatureLevel,
    createCreature,
    speedUpUnlock,
    mergeCreatures
};
