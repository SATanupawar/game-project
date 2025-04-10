const User = require('../models/user');
const Building = require('../models/building');
const Creature = require('../models/creature');
const mongoose = require('mongoose');

async function getUserWithDetails(userIdParam) {
    try {
        // Try to find by userId first
        let user = await User.findOne({ userId: userIdParam }).populate([
            {
                path: 'creatures.creature_id',
                model: 'Creature'
            },
            {
                path: 'buildings',
                populate: {
                    path: 'creatures.creature_id',
                    model: 'Creature'
                }
            }
        ]);

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate([
                {
                    path: 'creatures.creature_id',
                    model: 'Creature'
                },
                {
                    path: 'buildings',
                    populate: {
                        path: 'creatures.creature_id',
                        model: 'Creature'
                    }
                }
            ]);
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Format the buildings data
        const formattedBuildings = user.buildings.map(building => {
            const buildingData = {
                _id: building._id,
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected || user.logout_time,
                size: building.size,
                index: building.index,
                is_creature_building: false,
                creature_ids: [] // Array to store creature IDs
            };

            // Check if building has creatures
            const buildingCreatures = user.creatures.filter(c => c.building_index === building.index);
            if (buildingCreatures.length > 0) {
                buildingData.is_creature_building = true;
                // Add creature IDs to the building
                buildingData.creature_ids = buildingCreatures.map(creatureEntry => ({
                    creature_id: creatureEntry.creature_id._id,
                    creature_Id: creatureEntry.creature_id.creature_Id,
                    level: creatureEntry.creature_id.levelNumber
                }));
            }

            return buildingData;
        });

        // Format the creatures data
        const formattedCreatures = user.creatures.map(creatureEntry => {
            const creature = creatureEntry.creature_id;
            return {
                creature_id: creature._id,
                creature_Id: creature.creature_Id,
                name: creature.name,
                level: creature.levelNumber,
                type: creature.type,
                image: creature.image,
                gold_coins: creature.gold_coins,
                description: creature.description,
                attack: creature.level ? creature.level.attack : null,
                health: creature.level ? creature.level.health : null,
                speed: creature.level ? creature.level.speed : null,
                armor: creature.level ? creature.level.armor : null,
                critical_health: creature.level ? creature.level.critical_health : null,
                critical_damage: creature.level ? creature.level.critical_damage : null,
                building_index: creatureEntry.building_index,
                count: creatureEntry.count
            };
        });

        return {
            _id: user._id,
            userId: user.userId,
            user_name: user.user_name,
            level: user.level,
            gold_coins: user.gold_coins,
            logout_time: user.logout_time,
            buildings: formattedBuildings,
            creatures: formattedCreatures
        };
    } catch (error) {
        throw error;
    }
}

async function updateUserGold(userIdParam) {
    try {
        // Try to find by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'buildings',
            populate: { 
                path: 'creatures.creature_id',
                model: 'Creature'
            }
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'buildings',
                populate: { 
                    path: 'creatures.creature_id',
                    model: 'Creature'
                }
            });
        }

        if (!user) {
            throw new Error('User not found');
        }

        const currentTime = new Date();
        const timeDifference = (currentTime - user.logout_time) / (1000 * 60 * 60); // Convert to hours

        let totalGoldGenerated = 0;
        const buildingContributions = [];

        user.buildings.forEach(building => {
            let goldGenerated = 0;
            if (building.creatures && building.creatures.length > 0) {
                // Calculate gold from creatures
                building.creatures.forEach(creatureEntry => {
                    if (creatureEntry.creature_id) {
                        const creature = creatureEntry.creature_id;
                        const count = creatureEntry.count || 1;
                        const goldPerHour = creature.gold_coins * count; // Gold per hour times count
                        goldGenerated += goldPerHour * timeDifference;
                    }
                });
            } else {
                // Calculate gold from building itself
                const buildingGoldPerHour = building.gold_coins; // Use the building's gold_coins
                goldGenerated = buildingGoldPerHour * timeDifference;
            }
            totalGoldGenerated += goldGenerated;
            buildingContributions.push({
                buildingId: building.buildingId,
                name: building.name,
                goldGenerated: goldGenerated.toFixed(2) // Show two decimal places
            });
        });

        const previousGold = user.gold_coins;
        const addedGold = totalGoldGenerated.toFixed(2); // Show two decimal places
        const totalGold = previousGold + parseFloat(addedGold);

        user.gold_coins = totalGold;
        user.logout_time = currentTime; // Update logout time to current time
        await user.save();

        return { previousGold, addedGold, totalGold, buildingContributions };
    } catch (error) {
        throw error;
    }
}

async function getBuildingGoldDetails(userIdParam, buildingId) {
    try {
        // Find user and populate buildings
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'buildings',
            populate: { 
                path: 'creatures.creature_id',
                model: 'Creature'
            }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Find building by index
        const buildingIndex = parseInt(buildingId);
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) {
            throw new Error('Building not found');
        }

        // Calculate time difference since last collection
        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifference = (currentTime - lastCollectionTime) / (1000 * 60 * 60); // Convert to hours

        // Calculate gold generated
        let goldGenerated = 0;
        if (building.creatures && building.creatures.length > 0) {
            // Gold from creatures
            building.creatures.forEach(creatureEntry => {
                if (creatureEntry.creature_id) {
                    const creature = creatureEntry.creature_id;
                    const count = creatureEntry.count || 1;
                    goldGenerated += creature.gold_coins * count * timeDifference;
                }
            });
        } else {
            // Gold from building itself
            goldGenerated = building.gold_coins * timeDifference;
        }

        // Update user and building data if gold was generated
        if (goldGenerated > 0) {
            const previousGold = user.gold_coins;
            const addedGold = goldGenerated.toFixed(2);
            const totalGold = previousGold + parseFloat(addedGold);

            // Update the specific building's last collected time
            const buildingIndexInArray = user.buildings.findIndex(b => b.index === buildingIndex);
            if (buildingIndexInArray !== -1) {
                user.buildings[buildingIndexInArray].last_collected = currentTime;
            }
            
            // Update user's gold
            user.gold_coins = totalGold;
            
            // Save changes
            await user.save();

            // Refresh user data to get the latest changes
            user = await User.findOne({ userId: userIdParam }).populate({
                path: 'buildings',
                populate: { 
                    path: 'creatures.creature_id',
                    model: 'Creature'
                }
            });

            // Get the updated building
            const updatedBuilding = user.buildings.find(b => b.index === buildingIndex);

            return {
                buildingId: updatedBuilding.buildingId,
                name: updatedBuilding.name,
                position: updatedBuilding.position,
                index: updatedBuilding.index,
                previousGold,
                addedGold,
                totalGold,
                last_collected: updatedBuilding.last_collected,
                was_collected: true
            };
        }

        // Return current state if no gold was generated
        return {
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            index: building.index,
            previousGold: user.gold_coins,
            addedGold: "0.00",
            totalGold: user.gold_coins,
            last_collected: building.last_collected,
            was_collected: false
        };
    } catch (error) {
        throw error;
    }
}

// Assign an existing building to a user
async function assignBuildingToUser(userIdParam, buildingIdParam, position) {
    try {
        // Try to find user by userId first
        let user = await User.findOne({ userId: userIdParam });
        
        // If not found and valid ObjectId, try by _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Find the building template in the database
        let buildingTemplate = null;
        
        // First try by buildingId
        buildingTemplate = await Building.findOne({ buildingId: buildingIdParam });
        
        // If not found and valid ObjectId, try by _id
        if (!buildingTemplate && mongoose.Types.ObjectId.isValid(buildingIdParam)) {
            buildingTemplate = await Building.findById(buildingIdParam);
        }

        if (!buildingTemplate) {
            throw new Error('Building template not found in database');
        }

        // Validate position
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            throw new Error('Valid position (x, y) is required');
        }

        // Generate a 10-digit random number for index
        const randomIndex = Math.floor(1000000000 + Math.random() * 9000000000);

        // Create a new building object with the same properties but new index and position
        const newBuilding = {
            buildingId: buildingTemplate.buildingId,
            name: buildingTemplate.name,
            gold_coins: buildingTemplate.gold_coins,
            position: position, // Add the provided position
            size: buildingTemplate.size,
            index: randomIndex // Set 10-digit random index
        };

        // Add the new building to user's buildings array
        user.buildings.push(newBuilding);
        await user.save();

        return {
            user: {
                userId: user.userId,
                user_name: user.user_name
            },
            building: newBuilding
        };
    } catch (error) {
        throw new Error(`Error assigning building to user: ${error.message}`);
    }
}

// Assign multiple existing buildings to a user
async function assignMultipleBuildingsToUser(userIdParam, buildingIds) {
    try {
        // Try to find user by userId first
        let user = await User.findOne({ userId: userIdParam });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }

        if (!user) {
            throw new Error('User not found');
        }

        const results = [];
        const errors = [];

        for (const buildingId of buildingIds) {
            try {
                // Find the building in the buildings table
                let building = await Building.findById(buildingId);
                
                if (!building) {
                    errors.push({
                        buildingId,
                        error: 'Building not found in buildings table'
                    });
                    continue;
                }

                // Add the building to user's buildings array
                user.buildings.push(building._id);
                
                results.push({
                    _id: building._id,
                    buildingId: building.buildingId,
                    name: building.name,
                    gold_coins: building.gold_coins,
                    position: building.position
                });
            } catch (error) {
                errors.push({
                    buildingId,
                    error: error.message
                });
            }
        }

        // Save user only if at least one building was added
        if (results.length > 0) {
            await user.save();
        }

        return {
            user: {
                userId: user.userId,
                user_name: user.user_name
            },
            success: results,
            errors: errors.length > 0 ? errors : undefined
        };
    } catch (error) {
        throw new Error(`Error assigning buildings to user: ${error.message}`);
    }
}

// Add a creature to a user's building
async function addCreatureToBuilding(userIdParam, buildingIdentifier, creatureIdParam) {
    try {
        // Try to find user by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'creatures.creature_id',
            model: 'Creature'
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'creatures.creature_id',
                model: 'Creature'
            });
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Find the building
        let building = null;
        
        // First try by buildingId
        building = user.buildings.find(b => b.buildingId === buildingIdentifier);
        
        // If not found, try by index
        if (!building) {
            building = user.buildings.find(b => b.index === parseInt(buildingIdentifier));
        }
        
        // If still not found and valid ObjectId, try by _id
        if (!building && mongoose.Types.ObjectId.isValid(buildingIdentifier)) {
            building = user.buildings.find(b => b._id.toString() === buildingIdentifier);
        }

        if (!building) {
            throw new Error('Building not found for this user');
        }

        // Find the creature template
        let creatureTemplate = await Creature.findOne({ creature_Id: creatureIdParam });
        
        // If not found and valid ObjectId, try by _id
        if (!creatureTemplate && mongoose.Types.ObjectId.isValid(creatureIdParam)) {
            creatureTemplate = await Creature.findById(creatureIdParam);
        }

        if (!creatureTemplate) {
            throw new Error('Creature not found');
        }

        // Check if building already has creatures
        if (user.creatures && user.creatures.length > 0) {
            const buildingCreatures = user.creatures.filter(c => c.building_index === building.index);
            if (buildingCreatures.length > 0) {
                const firstCreature = buildingCreatures[0].creature_id;
                if (firstCreature.creature_Id !== creatureTemplate.creature_Id) {
                    throw new Error(`This building already has ${firstCreature.name}. You can only add more ${firstCreature.name}s to this building.`);
                }
            }
        }

        // Find level 1 for this creature
        const level1 = await mongoose.model('CreatureLevel').findOne({ 
            creature_Id: creatureTemplate.creature_Id,
            level: 1
        });

        if (!level1) {
            throw new Error('Level 1 not found for this creature');
        }

        // Create a new creature instance
        const newCreature = new Creature({
            creature_Id: creatureTemplate.creature_Id,
            name: creatureTemplate.name,
            type: creatureTemplate.type,
            gold_coins: creatureTemplate.gold_coins,
            description: creatureTemplate.description,
            image: creatureTemplate.image,
            level: level1._id,
            levelNumber: 1
        });
        await newCreature.save();

        // Add the creature to user's creatures array
        if (!user.creatures) {
            user.creatures = [];
        }
        
        // Add new creature to user's creatures array
        user.creatures.push({
            creature_id: newCreature._id,
            building_index: building.index,
            count: 1
        });
        
        await user.save();

        return {
            user: {
                userId: user.userId,
                user_name: user.user_name
            },
            building: {
                buildingId: building.buildingId,
                name: building.name,
                index: building.index
            },
            creature: {
                creature_id: newCreature._id,
                creature_Id: newCreature.creature_Id,
                name: newCreature.name,
                level: newCreature.levelNumber
            }
        };
    } catch (error) {
        throw new Error(`Error adding creature to building: ${error.message}`);
    }
}

// Update specific creature level for a user's building
async function updateBuildingCreatureLevel(userIdParam, buildingIdParam, creatureIdParam, newLevelNumber) {
    try {
        // Try to find user by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'buildings',
            populate: {
                path: 'creatures.creature_id',
                model: 'Creature'
            }
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'buildings',
                populate: {
                    path: 'creatures.creature_id',
                    model: 'Creature'
                }
            });
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Find the building
        let building = null;
        
        // First try by buildingId
        building = user.buildings.find(b => b.buildingId === buildingIdParam);
        
        // If not found and valid ObjectId, try by _id
        if (!building && mongoose.Types.ObjectId.isValid(buildingIdParam)) {
            building = user.buildings.find(b => b._id.toString() === buildingIdParam);
        }

        if (!building) {
            throw new Error('Building not found for this user');
        }

        // Check if building has creatures
        if (!building.creatures || building.creatures.length === 0) {
            throw new Error('Building does not have any creatures assigned');
        }

        // Find the creature in the building
        let creatureEntry = null;
        let creature = null;
        
        for (const entry of building.creatures) {
            if (!entry.creature_id) continue;
            
            const creatureDoc = entry.creature_id;
            
            if ((creatureDoc.creature_Id === creatureIdParam) || 
                (mongoose.Types.ObjectId.isValid(creatureIdParam) && 
                 creatureDoc._id.toString() === creatureIdParam)) {
                creatureEntry = entry;
                creature = creatureDoc;
                break;
            }
        }

        if (!creature) {
            throw new Error('Creature not found in this building');
        }

        // Make sure the new level is valid (1-40)
        if (newLevelNumber < 1 || newLevelNumber > 40) {
            throw new Error('Level must be between 1 and 40');
        }

        // Find the requested level for this creature
        const newLevel = await mongoose.model('CreatureLevel').findOne({
            creature_Id: creature.creature_Id,
            level: newLevelNumber
        });

        if (!newLevel) {
            throw new Error(`Level ${newLevelNumber} not found for this creature`);
        }

        // Store the previous level
        const previousLevel = creature.levelNumber;

        // Update the creature's level
        creature.level = newLevel._id;
        creature.levelNumber = newLevelNumber;
        await creature.save();

        return {
            user: {
                userId: user.userId,
                user_name: user.user_name
            },
            building: {
                buildingId: building.buildingId,
                name: building.name
            },
            creature: {
                creature_Id: creature.creature_Id,
                name: creature.name,
                previousLevel: previousLevel,
                newLevel: newLevelNumber,
                attack: newLevel.attack,
                health: newLevel.health,
                count: creatureEntry.count
            }
        };
    } catch (error) {
        throw new Error(`Error updating creature level: ${error.message}`);
    }
}

// Get building creatures details
async function getBuildingCreatures(userIdParam, buildingIdParam) {
    try {
        // Try to find user by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'buildings',
            populate: {
                path: 'creatures.creature_id',
                model: 'Creature'
            }
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'buildings',
                populate: {
                    path: 'creatures.creature_id',
                    model: 'Creature'
                }
            });
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Find the building
        let building = null;
        
        // First try by buildingId
        building = user.buildings.find(b => b.buildingId === buildingIdParam);
        
        // If not found and valid ObjectId, try by _id
        if (!building && mongoose.Types.ObjectId.isValid(buildingIdParam)) {
            building = user.buildings.find(b => b._id.toString() === buildingIdParam);
        }

        if (!building) {
            throw new Error('Building not found for this user');
        }

        // Check if building has creatures
        if (!building.creatures || building.creatures.length === 0) {
            return {
                buildingId: building.buildingId,
                name: building.name,
                total_creatures: 0,
                total_creature_types: 0,
                creatures: []
            };
        }

        // Extract creature details
        const creatureDetails = [];
        let totalCreatureCount = 0;
        
        for (const entry of building.creatures) {
            if (!entry.creature_id) continue;
            
            const creature = entry.creature_id;
            const count = entry.count || 1;
            totalCreatureCount += count;
            
            creatureDetails.push({
                creature_id: creature._id,
                creature_Id: creature.creature_Id,
                name: creature.name,
                level: creature.levelNumber,
                count: count,
                attack: creature.level ? creature.level.attack : null,
                health: creature.level ? creature.level.health : null,
                type: creature.type,
                image: creature.image,
                gold_coins: creature.gold_coins
            });
        }

        return {
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            total_creatures: totalCreatureCount,
            total_creature_types: creatureDetails.length,
            creatures: creatureDetails,
            building_gold_coins: building.gold_coins
        };
    } catch (error) {
        throw new Error(`Error fetching building creatures: ${error.message}`);
    }
}

// Get user buildings with details
async function getUserBuildings(userIdParam) {
    try {
        // Try to find by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'creatures.creature_id',
            model: 'Creature'
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'creatures.creature_id',
                model: 'Creature'
            });
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Format the buildings data
        const formattedBuildings = user.buildings.map(building => {
            const buildingData = {
                _id: building._id,
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected || user.logout_time,
                size: building.size,
                index: building.index,
                is_creature_building: false,
                creature_ids: [], // Array to store creature IDs
                creatures: [] // Array to store full creature details
            };

            // Check if building has creatures
            const buildingCreatures = user.creatures.filter(c => c.building_index === building.index);
            if (buildingCreatures.length > 0) {
                buildingData.is_creature_building = true;
                // Add creature IDs to the building
                buildingData.creature_ids = buildingCreatures.map(creatureEntry => ({
                    creature_id: creatureEntry.creature_id._id,
                    creature_Id: creatureEntry.creature_id.creature_Id,
                    level: creatureEntry.creature_id.levelNumber
                }));

                // Add full creature details
                buildingData.creatures = buildingCreatures.map(creatureEntry => {
                    const creature = creatureEntry.creature_id;
                    return {
                        creature_id: creature._id,
                        creature_Id: creature.creature_Id,
                        name: creature.name,
                        level: creature.levelNumber,
                        type: creature.type,
                        image: creature.image,
                        gold_coins: creature.gold_coins,
                        description: creature.description,
                        attack: creature.level ? creature.level.attack : null,
                        health: creature.level ? creature.level.health : null,
                        speed: creature.level ? creature.level.speed : null,
                        armor: creature.level ? creature.level.armor : null,
                        critical_health: creature.level ? creature.level.critical_health : null,
                        critical_damage: creature.level ? creature.level.critical_damage : null,
                        count: creatureEntry.count
                    };
                });
            }

            return buildingData;
        });

        return {
            success: true,
            message: 'User buildings fetched successfully',
            data: formattedBuildings
        };
    } catch (error) {
        throw new Error(`Error fetching user buildings: ${error.message}`);
    }
}

// Update building position
async function updateBuildingPosition(userIdParam, buildingIdentifier, newPosition) {
    try {
        // Try to find user by userId first
        let user = await User.findOne({ userId: userIdParam });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Find the building
        let building = null;
        
        // First try by buildingId
        building = user.buildings.find(b => b.buildingId === buildingIdentifier);
        
        // If not found, try by index
        if (!building) {
            building = user.buildings.find(b => b.index === parseInt(buildingIdentifier));
        }
        
        // If still not found and valid ObjectId, try by _id
        if (!building && mongoose.Types.ObjectId.isValid(buildingIdentifier)) {
            building = user.buildings.find(b => b._id.toString() === buildingIdentifier);
        }

        if (!building) {
            throw new Error('Building not found for this user');
        }

        // Validate new position
        if (!newPosition || typeof newPosition.x !== 'number' || typeof newPosition.y !== 'number') {
            throw new Error('Valid position (x, y) is required');
        }

        // Update the building position
        building.position = newPosition;
        await user.save();

        return {
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            index: building.index
        };
    } catch (error) {
        throw new Error(`Error updating building position: ${error.message}`);
    }
}

module.exports = {
    getUserWithDetails,
    updateUserGold,
    getBuildingGoldDetails,
    assignBuildingToUser,
    assignMultipleBuildingsToUser,
    addCreatureToBuilding,
    updateBuildingCreatureLevel,
    getBuildingCreatures,
    getUserBuildings,
    updateBuildingPosition
};
