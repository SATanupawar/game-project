const mongoose = require('mongoose');
const User = require('../models/user');
const ArcaneEnergyBuilding = require('../models/arcaneEnergyBuilding');

/**
 * Add Arcane Energy building to a user
 */
async function addArcaneEnergyBuilding(userId) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Initialize arcaneEnergyBuildings array if it doesn't exist
        if (!user.arcaneEnergyBuildings) {
            user.arcaneEnergyBuildings = [];
        }

        // Check if user already has an Arcane Energy building
        if (user.arcaneEnergyBuildings.length > 0) {
            return {
                success: false,
                message: 'User already has an Arcane Energy building'
            };
        }

        // Get level 1 building data
        const buildingData = await ArcaneEnergyBuilding.findOne({ level: 1 });
        if (!buildingData) {
            return {
                success: false,
                message: 'Building data not found'
            };
        }

        // Create new building object
        const newBuilding = {
            level: buildingData.level,
            is_active: false,
            production_start_time: null,
            production_end_time: null,
            production_time_minutes: buildingData.production_time_minutes,
            arcane_energy_production: buildingData.arcane_energy_production,
            activation_gold_cost: buildingData.activation_gold_cost,
            last_collected: new Date()
        };

        // Add building to user's arcaneEnergyBuildings array
        user.arcaneEnergyBuildings.push(newBuilding);

        // Initialize arcane energy in currency if it doesn't exist
        if (!user.currency) {
            user.currency = { arcane_energy: 0 };
        } else if (!user.currency.arcane_energy) {
            user.currency.arcane_energy = 0;
        }

        user.markModified('arcaneEnergyBuildings');
        user.markModified('currency');
        await user.save();

        return {
            success: true,
            message: 'Arcane Energy building added successfully',
            data: {
                arcaneEnergy: newBuilding
            }
        };
    } catch (error) {
        console.error('Error in addArcaneEnergyBuilding:', error);
        return {
            success: false,
            message: `Error adding Arcane Energy building: ${error.message}`
        };
    }
}

/**
 * Start Arcane Energy production
 */
async function startProduction(userId) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Check if user has an Arcane Energy building
        if (!user.arcaneEnergyBuildings || user.arcaneEnergyBuildings.length === 0) {
            return {
                success: false,
                message: 'User does not have an Arcane Energy building'
            };
        }

        const building = user.arcaneEnergyBuildings[0];

        // Check if production is already active
        if (building.is_active) {
            return {
                success: false,
                message: 'Production is already active'
            };
        }

        // Check if user has enough gold
        if (!user.gold_coins || user.gold_coins < building.activation_gold_cost) {
            return {
                success: false,
                message: `Not enough gold coins. Required: ${building.activation_gold_cost}, Available: ${user.gold_coins || 0}`
            };
        }

        // Deduct gold coins
        user.gold_coins -= building.activation_gold_cost;

        // Set production start and end times
        const currentTime = new Date();
        const endTime = new Date(currentTime.getTime() + (building.production_time_minutes * 60000));

        building.is_active = true;
        building.production_start_time = currentTime;
        building.production_end_time = endTime;

        user.markModified('arcaneEnergyBuildings');
        await user.save();

        return {
            success: true,
            message: 'Production started successfully',
            data: {
                arcaneEnergy: building,
                production_start_time: currentTime,
                production_end_time: endTime
            }
        };
    } catch (error) {
        console.error('Error in startProduction:', error);
        return {
            success: false,
            message: `Error starting production: ${error.message}`
        };
    }
}

/**
 * Collect Arcane Energy
 */
async function collectEnergy(userId) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Check if user has an Arcane Energy building
        if (!user.arcaneEnergyBuildings || user.arcaneEnergyBuildings.length === 0) {
            return {
                success: false,
                message: 'User does not have an Arcane Energy building'
            };
        }

        const building = user.arcaneEnergyBuildings[0];

        // Check if production is active
        if (!building.is_active) {
            return {
                success: false,
                message: 'No active production to collect'
            };
        }

        const currentTime = new Date();
        const endTime = new Date(building.production_end_time);

        // Check if production time is up
        if (currentTime < endTime) {
            const remainingTimeMs = endTime - currentTime;
            const remainingMinutes = Math.ceil(remainingTimeMs / 60000);

            return {
                success: false,
                message: `Production is not complete. ${remainingMinutes} minutes remaining.`
            };
        }

        // Add arcane energy to user currency
        user.currency.arcane_energy += building.arcane_energy_production;

        // Reset production status
        building.is_active = false;
        building.production_start_time = null;
        building.production_end_time = null;
        building.last_collected = currentTime;

        user.markModified('currency');
        user.markModified('arcaneEnergyBuildings');
        await user.save();

        return {
            success: true,
            message: 'Energy collected successfully',
            data: {
                arcane_energy_collected: building.arcane_energy_production,
                arcane_energy_balance: user.currency.arcane_energy
            }
        };
    } catch (error) {
        console.error('Error in collectEnergy:', error);
        return {
            success: false,
            message: `Error collecting energy: ${error.message}`
        };
    }
}

/**
 * Upgrade Arcane Energy building
 */
async function upgradeBuilding(userId) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Check if user has an Arcane Energy building
        if (!user.arcaneEnergyBuildings || user.arcaneEnergyBuildings.length === 0) {
            return {
                success: false,
                message: 'User does not have an Arcane Energy building'
            };
        }

        const building = user.arcaneEnergyBuildings[0];

        // Check if building is active
        if (building.is_active) {
            return {
                success: false,
                message: 'Cannot upgrade while production is active'
            };
        }

        // Check if building is already at max level
        if (building.level >= 8) {
            return {
                success: false,
                message: 'Building is already at maximum level'
            };
        }

        // Get next level data
        const nextLevelData = await ArcaneEnergyBuilding.findOne({ level: building.level + 1 });
        if (!nextLevelData) {
            return {
                success: false,
                message: `Next level data not found for level ${building.level + 1}`
            };
        }

        // Check if user has enough gold for upgrade
        if (!user.gold_coins || user.gold_coins < nextLevelData.upgrade_cost) {
            return {
                success: false,
                message: `Not enough gold coins. Required: ${nextLevelData.upgrade_cost}, Available: ${user.gold_coins || 0}`
            };
        }

        // Deduct gold coins
        user.gold_coins -= nextLevelData.upgrade_cost;

        // Update building with new level values
        building.level = nextLevelData.level;
        building.production_time_minutes = nextLevelData.production_time_minutes;
        building.arcane_energy_production = nextLevelData.arcane_energy_production;
        building.activation_gold_cost = nextLevelData.activation_gold_cost;

        user.markModified('arcaneEnergyBuildings');
        await user.save();

        return {
            success: true,
            message: `Arcane Energy building upgraded to level ${nextLevelData.level}`,
            data: {
                arcaneEnergy: building,
                upgrade_cost: nextLevelData.upgrade_cost,
                gold_coins_remaining: user.gold_coins
            }
        };
    } catch (error) {
        console.error('Error in upgradeBuilding:', error);
        return {
            success: false,
            message: `Error upgrading building: ${error.message}`
        };
    }
}

async function upgradeBuildingToLevel(userId, targetLevel) {
    try {
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        if (!user.arcaneEnergyBuildings || user.arcaneEnergyBuildings.length === 0) {
            return {
                success: false,
                message: 'No Arcane Energy building found'
            };
        }

        const building = user.arcaneEnergyBuildings[0];
        
        if (building.is_active) {
            return {
                success: false,
                message: 'Cannot upgrade while production is active'
            };
        }

        if (building.level >= targetLevel) {
            return {
                success: false,
                message: `Building is already at or above level ${targetLevel}`
            };
        }

        // Calculate total upgrade cost
        let totalUpgradeCost = 0;
        for (let level = building.level; level < targetLevel; level++) {
            const nextLevelData = await ArcaneEnergyBuilding.findOne({ level: level + 1 });
            if (!nextLevelData) {
                return {
                    success: false,
                    message: `Invalid upgrade path to level ${targetLevel}`
                };
            }
            totalUpgradeCost += nextLevelData.upgrade_cost;
        }

        if (user.gold_coins < totalUpgradeCost) {
            return {
                success: false,
                message: `Not enough gold coins for upgrade. Required: ${totalUpgradeCost}`
            };
        }

        // Get the target level data
        const targetLevelData = await ArcaneEnergyBuilding.findOne({ level: targetLevel });
        if (!targetLevelData) {
            return {
                success: false,
                message: `Invalid target level: ${targetLevel}`
            };
        }

        // Deduct the upgrade cost
        user.gold_coins -= totalUpgradeCost;

        // Update building parameters
        building.level = targetLevel;
        building.production_time_minutes = targetLevelData.production_time_minutes;
        building.arcane_energy_production = targetLevelData.arcane_energy_production;
        building.activation_gold_cost = targetLevelData.activation_gold_cost;

        await user.save();

        return {
            success: true,
            message: `Arcane Energy building upgraded to level ${targetLevel}`,
            data: {
                level: building.level,
                is_active: building.is_active,
                production_time_minutes: building.production_time_minutes,
                arcane_energy_production: building.arcane_energy_production,
                activation_gold_cost: building.activation_gold_cost,
                level_transition: {
                    from: building.level - 1,
                    to: building.level
                },
                upgrade_cost: totalUpgradeCost,
                remaining_gold: user.gold_coins
            }
        };
    } catch (error) {
        console.error('Error in upgradeBuildingToLevel:', error);
        return {
            success: false,
            message: error.message || 'Failed to upgrade building'
        };
    }
}

module.exports = {
    addArcaneEnergyBuilding,
    startProduction,
    collectEnergy,
    upgradeBuilding,
    upgradeBuildingToLevel
}; 