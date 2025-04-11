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

async function updateUserGold(userIdParam, globalBoostPercentage = 0) {
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
        const boost = parseFloat(globalBoostPercentage) || 0;

        user.buildings.forEach(building => {
            let baseGoldGenerated = 0;
            if (building.creatures && building.creatures.length > 0) {
                // Calculate gold from creatures
                building.creatures.forEach(creatureEntry => {
                    if (creatureEntry.creature_id) {
                        const creature = creatureEntry.creature_id;
                        const count = creatureEntry.count || 1;
                        const goldPerHour = creature.gold_coins * count; // Gold per hour times count
                        baseGoldGenerated += goldPerHour * timeDifference;
                    }
                });
            } else {
                // Calculate gold from building itself
                const buildingGoldPerHour = building.gold_coins; // Use the building's gold_coins
                baseGoldGenerated = buildingGoldPerHour * timeDifference;
            }

            // Apply boost if provided
            let boostedAmount = 0;
            if (boost > 0) {
                boostedAmount = baseGoldGenerated * (boost / 100);
            }
            const totalBuildingGold = baseGoldGenerated + boostedAmount;
            
            totalGoldGenerated += totalBuildingGold;
            
            buildingContributions.push({
                buildingId: building.buildingId,
                name: building.name,
                baseGold: baseGoldGenerated.toFixed(2),
                boostedAmount: boostedAmount.toFixed(2),
                totalGold: totalBuildingGold.toFixed(2),
                boostPercentage: boost
            });
        });

        const previousGold = user.gold_coins;
        const addedGold = totalGoldGenerated.toFixed(2); // Show two decimal places
        const totalGold = previousGold + parseFloat(addedGold);

        user.gold_coins = totalGold;
        user.logout_time = currentTime; // Update logout time to current time
        await user.save();

        return { 
            previousGold, 
            addedGold, 
            totalGold, 
            boostPercentage: boost,
            buildingContributions 
        };
    } catch (error) {
        throw error;
    }
}


async function getBuildingGoldDetails(userIdParam, buildingId, boostPercentage = 0) {
    try {
        // 🧍‍♂️ Get user with embedded buildings
        let user = await User.findOne({ userId: userIdParam });
        if (!user) throw new Error('User not found (यूज़र नहीं मिला)');

        const buildingIndex = parseInt(buildingId);
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found in user (यूज़र के पास यह बिल्डिंग नहीं है)');

        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifference = (currentTime - new Date(lastCollectionTime)) / (1000 * 60 * 60); // in hours

        let baseGoldGenerated = 0;

        // 👉 If building has creatures, calculate from them
        if (building.creatures && building.creatures.length > 0) {
            const creatureIds = building.creatures.map(c => c.creature_id);
            const creatures = await Creature.find({ _id: { $in: creatureIds } });

            const creatureMap = {};
            creatures.forEach(c => creatureMap[c._id.toString()] = c);

            building.creatures.forEach(entry => {
                const creature = creatureMap[entry.creature_id?.toString()];
                if (creature) {
                    const count = entry.count || 1;
                    baseGoldGenerated += creature.gold_coins * count * timeDifference;
                }
            });
        } else {
            baseGoldGenerated = building.gold_coins * timeDifference;
        }

        const boost = parseFloat(boostPercentage) || 0;
        const boostAmount = baseGoldGenerated * (boost / 100);

        const reserveCoins = parseFloat(building.reserveCoins || 0);
        const reserveCoinsBeforeReset = reserveCoins;

        const rawGoldAdded = baseGoldGenerated + boostAmount;
        const totalGoldGenerated = rawGoldAdded + reserveCoins;

        if (totalGoldGenerated > 0) {
            const previousGold = user.gold_coins;
            const totalGold = previousGold + totalGoldGenerated;

            // 🔁 Update building's last_collected & reserve
            building.last_collected = currentTime;
            building.reserveCoins = 0;

            // 🧍‍♂️ Update user's gold
            user.gold_coins = totalGold;
            await user.save(); // saves both user and embedded buildings

            return {
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                index: building.index,
                previousGold,
                baseGoldAmount: baseGoldGenerated.toFixed(2),
                boostAmount: boostAmount.toFixed(2),
                reserveCoins: reserveCoinsBeforeReset.toFixed(2),
                addedGold: totalGoldGenerated.toFixed(2),
                totalGold: totalGold.toFixed(2),
                last_collected: currentTime,
                was_collected: true,
                boost_percentage: boost
            };
        }

        return {
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            index: building.index,
            previousGold: user.gold_coins,
            baseGoldAmount: "0.00",
            boostAmount: "0.00",
            reserveCoins: reserveCoinsBeforeReset.toFixed(2),
            addedGold: "0.00",
            totalGold: user.gold_coins.toFixed(2),
            last_collected: building.last_collected,
            was_collected: false,
            boost_percentage: 0
        };

    } catch (error) {
        throw new Error(`Error fetching building gold details: ${error.message}`);
    }
}



// Assign an existing building to a user
async function assignBuildingToUser(userIdParam, buildingIdParam, position, creatureIdParam) {
    try {
        console.log('Starting assignBuildingToUser with params:', { userIdParam, buildingIdParam, position, creatureIdParam });
        
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            return { success: false, message: "User not found" };
        }
        console.log('User found:', user.userId);

        // Find building template
        let buildingTemplate = await Building.findOne({ buildingId: buildingIdParam });
        if (!buildingTemplate && mongoose.Types.ObjectId.isValid(buildingIdParam)) {
            buildingTemplate = await Building.findById(buildingIdParam);
        }
        if (!buildingTemplate) {
            return { success: false, message: "Building template not found" };
        }
        console.log('Building template found:', buildingTemplate.buildingId);

        // Validate position
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return { success: false, message: "Valid position (x, y) is required" };
        }

        // Generate random index for the building
        const randomIndex = Math.floor(1000000000 + Math.random() * 9000000000);
        console.log('Generated building index:', randomIndex);

        // Create new building object
        const newBuilding = {
            buildingId: buildingTemplate.buildingId,
            name: buildingTemplate.name,
            gold_coins: buildingTemplate.gold_coins,
            position: position,
            size: buildingTemplate.size,
            index: randomIndex,
            reserveCoins: 0 // Initialize reserveCoins here
        };
        console.log('Created new building object:', newBuilding);

        // Add building to user
        user.buildings.push(newBuilding);
        console.log('Added building to user');

        // Prepare response
        const response = {
            success: true,
            message: "Building assigned to user successfully",
            data: {
                user: {
                    userId: user.userId,
                    user_name: user.user_name
                },
                building: newBuilding
            }
        };

        // If creatureIdParam is provided, add creature to the building
        if (creatureIdParam) {
            console.log('Creature ID provided:', creatureIdParam);
            
            // Find creature template
            const creatureTemplate = await Creature.findOne({ creature_Id: creatureIdParam });
            console.log('Creature template search result:', creatureTemplate ? 'Found' : 'Not found');
            
            if (!creatureTemplate) {
                // Save building but return error about creature
                await user.save();
                console.log('Building saved but creature not found');
                return {
                    success: true,
                    message: "Building assigned but creature not found",
                    data: response.data
                };
            }

            // Find level 1 for creature
            const level1 = await mongoose.model('CreatureLevel').findOne({ 
                creature_Id: creatureTemplate.creature_Id,
                level: 1
            });
            console.log('Level 1 search result:', level1 ? 'Found' : 'Not found');
            
            if (!level1) {
                // Save building but return error about creature level
                await user.save();
                console.log('Building saved but creature level not found');
                return {
                    success: true,
                    message: "Building assigned but creature level not found",
                    data: response.data
                };
            }

            // Create new creature instance
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
            
            // Save creature
            await newCreature.save();
            console.log('New creature created with ID:', newCreature._id);

            // Initialize user's creatures array if needed
            if (!user.creatures) {
                user.creatures = [];
                console.log('Initialized user creatures array');
            }

            // Add creature to user and associate with building
            user.creatures.push({
                creature_id: newCreature._id,
                building_index: randomIndex,
                count: 1
            });
            console.log('Added creature to user with building index:', randomIndex);

            // Add creature to response
            response.data.creature = {
                _id: newCreature._id,
                creature_Id: newCreature.creature_Id,
                name: newCreature.name,
                type: newCreature.type,
                level: newCreature.levelNumber,
                gold_coins: newCreature.gold_coins
            };
            
            response.message = "Building and creature assigned successfully";
            console.log('Updated response with creature data');
        }

        // Save changes
        await user.save();
        console.log('Saved all changes to user');
        
        return response;
    } catch (error) {
        console.error('Error in assignBuildingToUser:', error);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
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

        // Format the buildings data - only include creature IDs
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
                creature_ids: [] // Only store creature IDs
            };

            // Check if building has creatures
            const buildingCreatures = user.creatures.filter(c => c.building_index === building.index);
            if (buildingCreatures.length > 0) {
                buildingData.is_creature_building = true;
                // Add creature IDs to the building
                buildingData.creature_ids = buildingCreatures.map(creatureEntry => ({
                    creature_id: creatureEntry.creature_id._id,
                    creature_Id: creatureEntry.creature_id.creature_Id,
                    level: creatureEntry.creature_id.levelNumber,
                    count: creatureEntry.count
                }));
            }

            return buildingData;
        });

        // Create a separate array for all creatures
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
            success: true,
            message: 'User buildings and creatures fetched successfully',
            data: {
                buildings: formattedBuildings,
                creatures: formattedCreatures
            }
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

        // Calculate coins based on last collected time
        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifference = (currentTime - lastCollectionTime) / (1000 * 60 * 60); // Convert to hours

        // Calculate base coins generated
        const baseCoinsGenerated = building.gold_coins * timeDifference; // Assuming gold_coins is the rate per hour

        // Apply boost percentage if provided
        const boostPercentage = 10; // Example boost percentage, you can modify this as needed
        const boostedAmount = baseCoinsGenerated * (boostPercentage / 100);
        const totalCoinsGenerated = baseCoinsGenerated + boostedAmount;

        // Update reserveCoins
        building.reserveCoins = (building.reserveCoins || 0) + totalCoinsGenerated; // Ensure reserveCoins is initialized

        // Update last collected time
        building.last_collected = currentTime;

        await user.save();

        return {
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            index: building.index,
            reserveCoins: building.reserveCoins.toFixed(2) // Ensure this is correctly accessed
        };
    } catch (error) {
        throw new Error(`Error updating building position: ${error.message}`);
    }
}

async function collectBuildingCoins(userIdParam, buildingIdentifier) {
    try {
        let user = await User.findOne({ userId: userIdParam });

        if (!user) throw new Error('User not found (यूज़र नहीं मिला)');

        const buildingIndex = parseInt(buildingIdentifier);
        let building = user.buildings.find(b => b.index === buildingIndex);

        if (!building) throw new Error('Building not found inside user data (यूज़र की बिल्डिंग डेटा में नहीं मिली)');

        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifference = (currentTime - lastCollectionTime) / (1000 * 60 * 60); // in hours

        let baseGoldGenerated = 0;

        if (building.creatures && building.creatures.length > 0) {
            for (let creatureEntry of building.creatures) {
                const creature = await Creature.findById(creatureEntry.creature_id); // we still need creature details
                if (creature) {
                    const count = creatureEntry.count || 1;
                    baseGoldGenerated += creature.gold_coins * count * timeDifference;
                }
            }
        } else {
            baseGoldGenerated = building.gold_coins * timeDifference;
        }

        const reserveCoins = parseFloat(building.reserveCoins || 0);
        const addedGold = baseGoldGenerated + reserveCoins;

        // Update building data
        building.last_collected = currentTime;
        building.reserveCoins = 0; // Reset reserveCoins after collection

        user.gold_coins += addedGold;

        await user.save();

        return {
            success: true,
            message: 'Coins collected successfully (सिक्के सफलतापूर्वक इकट्ठे किए गए)',
            totalCoins: user.gold_coins.toFixed(2),
            baseGoldAmount: baseGoldGenerated.toFixed(2),
            reserveCoins: reserveCoins.toFixed(2),
            addedGold: addedGold.toFixed(2),
            buildingIndex,
            last_collected: currentTime
        };
    } catch (error) {
        throw new Error(`Error collecting building coins: ${error.message}`);
    }
}


async function deleteCreatureFromBuilding(userIdParam, buildingIndexParam, creatureIdParam) {
    try {
        const user = await User.findOne({ userId: userIdParam });
        if (!user) throw new Error('User not found');

        const buildingIndex = parseInt(buildingIndexParam);

        // Find the building by index
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found for this user');

        // Try to delete from building-level creatures array (preferred)
        if (Array.isArray(building.creatures)) {
            const creatureIndex = building.creatures.findIndex(c =>
                c.creature_id?.toString() === creatureIdParam &&
                c.building_index === buildingIndex
            );

            if (creatureIndex !== -1) {
                building.creatures.splice(creatureIndex, 1);
                await user.save();
                return {
                    source: 'building',
                    buildingId: building.buildingId,
                    name: building.name,
                    remainingCreatures: building.creatures.length
                };
            }
        }

        // Fallback: check user-level creatures array (if that's where they are)
        if (Array.isArray(user.creatures)) {
            const creatureIndex = user.creatures.findIndex(c =>
                c.creature_id?.toString() === creatureIdParam &&
                c.building_index === buildingIndex
            );

            if (creatureIndex !== -1) {
                user.creatures.splice(creatureIndex, 1);
                await user.save();
                return {
                    source: 'user',
                    buildingId: building.buildingId,
                    name: building.name,
                    remainingUserLevelCreatures: user.creatures.length
                };
            }
        }

        throw new Error('Creature not found in this building');

    } catch (error) {
        throw new Error(`Error deleting creature from building: ${error.message}`);
    }
}






async function deleteBuildingFromUser(userIdParam, buildingIndexParam) {
    try {
        let user = await User.findOne({ userId: userIdParam });
        if (!user) throw new Error('User not found');

        const buildingIndex = parseInt(buildingIndexParam);
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found for this user');

        user.buildings = user.buildings.filter(b => b.index !== buildingIndex);
        user.creatures = user.creatures.filter(c => c.building_index !== buildingIndex);

        await user.save();

        return {
            message: 'Building and associated creatures deleted successfully',
            remainingBuildings: user.buildings.length,
            remainingCreatures: user.creatures.length
        };
    } catch (error) {
        throw new Error(`Error deleting building from user: ${error.message}`);
    }
}

// Get total creatures for a user
async function getTotalCreaturesForUser(userIdParam) {
    try {
        const user = await User.findOne({ userId: userIdParam });
        if (!user) throw new Error('User not found');

        // Count total creatures
        const totalCreatures = user.creatures.reduce((total, creatureEntry) => {
            return total + creatureEntry.count; // Sum the counts of each creature
        }, 0);

        return totalCreatures;
    } catch (error) {
        throw new Error(`Error fetching total creatures: ${error.message}`);
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
    updateBuildingPosition,
    collectBuildingCoins,
    deleteCreatureFromBuilding,
    deleteBuildingFromUser,
    getTotalCreaturesForUser
};
