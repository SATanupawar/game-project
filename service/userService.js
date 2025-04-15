const User = require('../models/user');
const Building = require('../models/building');
const Creature = require('../models/creature');
const mongoose = require('mongoose');

async function getUserWithDetails(userIdParam) {
    try {
        console.log(`Getting user details for: ${userIdParam}`);

        // First, get the raw user document without population to fix the data
        let user = await User.findOne({ userId: userIdParam }).lean();
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).lean();
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Initialize arrays if they don't exist
        if (!user.buildings) {
            user.buildings = [];
        }
        if (!user.creatures) {
            user.creatures = [];
        }

        console.log('Original user creatures:', JSON.stringify(user.creatures, null, 2));

        // Clean up the creatures array
        const validCreatures = [];
        for (let i = 0; i < user.creatures.length; i++) {
            const creature = user.creatures[i];
            if (creature && creature.creature_id) {
                // Create a valid creature entry with all required fields
                const validCreature = {
                    creature_id: creature.creature_id,
                    name: creature.name || `Creature ${i + 1}`,
                    building_index: typeof creature.building_index === 'number' ? creature.building_index : 0,
                    level: creature.level || 1
                };
                validCreatures.push(validCreature);
            }
        }

        // Update the user document with clean data
        const updateResult = await User.updateOne(
            { _id: user._id },
            { $set: { creatures: validCreatures } }
        );
        console.log('Update result:', updateResult);

        // Now fetch the updated user with populated data
        user = await User.findOne({ _id: user._id })
            .populate({
                path: 'buildings.creatures',
                model: 'Creature'
            });

        if (!user) {
            throw new Error('Failed to fetch updated user');
        }

        // Process buildings
        const processedBuildings = user.buildings.map(building => {
            if (!building.creatures) {
                building.creatures = [];
            }

            const buildingCreatures = building.creatures.map(creature => {
                if (creature) {
                    return {
                        _id: creature._id,
                        name: creature.name,
                        type: creature.type,
                        level: creature.level || 1,
                        base_attack: creature.base_attack,
                        base_health: creature.base_health,
                        gold_coins: creature.gold_coins,
                        image: creature.image,
                        description: creature.description
                    };
                }
                return null;
            }).filter(c => c !== null);

            return {
                _id: building._id,
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                size: building.size,
                index: building.index,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected,
                creatures: buildingCreatures
            };
        });

        // Process creatures for response
        const processedCreatures = validCreatures.map(creature => ({
            _id: creature.creature_id,
            name: creature.name,
            level: creature.level,
            building_index: creature.building_index
        }));

        // Format the response
        const userData = {
            _id: user._id,
            userId: user.userId,
            user_name: user.user_name,
            level: user.level,
            gold_coins: user.gold_coins,
            buildings: processedBuildings,
            creatures: processedCreatures,
            logout_time: user.logout_time,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            __v: user.__v
        };

        return userData;
    } catch (error) {
        console.error('Error in getUserWithDetails:', error);
        return {
            success: false,
            message: "Error fetching user details",
            error: error.message
        };
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

// Reserve coin helper function
async function updateReserveCoins(userId, buildingIndex, boost = 0) {
    try {
        console.log(`updateReserveCoins called for user ${userId}, building ${buildingIndex}, boost ${boost}`);
        
        let user = await User.findOne({ userId });
        if (!user) throw new Error('User not found');
        
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found');
        
        // Calculate time-based gold
        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifference = (currentTime - lastCollectionTime) / (1000 * 60 * 60); // hours
        
        // Calculate base generation
        let baseGold = building.gold_coins * timeDifference; 
        
        // Apply boost
        const boostMultiplier = parseFloat(boost) / 100 || 0.1; // default 10%
        const boostedAmount = baseGold * boostMultiplier;
        const totalGenerated = baseGold + boostedAmount;
        
        // Get current reserve coins (ensure it's a number)
        let currentReserve = 0;
        if (building.reserveCoins !== undefined && building.reserveCoins !== null) {
            currentReserve = typeof building.reserveCoins === 'string' ? 
                parseFloat(building.reserveCoins) : building.reserveCoins;
        }
        
        // Add to reserve
        const newReserve = currentReserve + totalGenerated;
        
        console.log(`Current reserve: ${currentReserve}`);
        console.log(`Adding ${totalGenerated} to reserve`);
        console.log(`New reserve: ${newReserve}`);
        
        // Update the building
        building.reserveCoins = newReserve;
        building.last_collected = currentTime;
        
        // Save user document
        await user.save();
        
        return {
            buildingId: building.buildingId,
            index: building.index,
            currentReserve: newReserve.toFixed(2),
            addedReserve: totalGenerated.toFixed(2),
            boost: boost
        };
    } catch (error) {
        console.error(`Error in updateReserveCoins:`, error);
        throw error;
    }
}

// Create a new function to collect reserveCoins
async function collectReserveCoins(userId, buildingIndex) {
    try {
        console.log(`collectReserveCoins called for user ${userId}, building ${buildingIndex}`);
        
        let user = await User.findOne({ userId });
        if (!user) throw new Error('User not found');
        
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found');
        
        // Calculate time-based gold
        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifference = (currentTime - lastCollectionTime) / (1000 * 60 * 60); // hours
        
        // Calculate base generation for this collection
        let baseGold = building.gold_coins * timeDifference;
        
        // Get current reserve coins (ensure it's a number)
        let reserveCoins = 0;
        if (building.reserveCoins !== undefined && building.reserveCoins !== null) {
            reserveCoins = typeof building.reserveCoins === 'string' ? 
                parseFloat(building.reserveCoins) : building.reserveCoins;
        }
        
        console.log(`Time-based gold: ${baseGold}`);
        console.log(`Current reserve coins: ${reserveCoins}`);
        
        // Total to collect (time-based + reserve)
        const totalToCollect = baseGold + reserveCoins;
        
        // Only proceed if there's something to collect
        if (totalToCollect > 0) {
            // Add to user's gold
            const previousGold = user.gold_coins;
            user.gold_coins += totalToCollect;
            
            // Reset reserve coins
            building.reserveCoins = 0;
            building.last_collected = currentTime;
            
            // Save user
            await user.save();
            
            console.log(`Collected ${totalToCollect} coins (${baseGold} time-based + ${reserveCoins} reserve)`);
            console.log(`User now has ${user.gold_coins} coins`);
            
            return {
                buildingId: building.buildingId,
                name: building.name,
                index: building.index,
                previousGold: previousGold,
                baseGoldAmount: baseGold.toFixed(2),
                reserveCoins: reserveCoins.toFixed(2),
                addedGold: totalToCollect.toFixed(2),
                totalGold: user.gold_coins.toFixed(2),
                last_collected: currentTime
            };
        } else {
            return {
                buildingId: building.buildingId,
                name: building.name,
                index: building.index,
                previousGold: user.gold_coins,
                baseGoldAmount: "0.00",
                reserveCoins: reserveCoins.toFixed(2),
                addedGold: "0.00",
                totalGold: user.gold_coins.toFixed(2),
                last_collected: building.last_collected
            };
        }
    } catch (error) {
        console.error(`Error in collectReserveCoins:`, error);
        throw error;
    }
}

// Update building position with reserve coins handling
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
            const buildingIndex = parseInt(buildingIdentifier);
            building = user.buildings.find(b => b.index === buildingIndex);
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
        building.position = {
            x: newPosition.x,
            y: newPosition.y
        };

        // Save the position update
        await user.save();

        // Now handle reserve coins with boost (extract boost from newPosition if available)
        const boost = newPosition.boost || 10;
        const reserveCoinsResult = await updateReserveCoins(userIdParam, building.index, boost);

        return {
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            index: building.index,
            reserveCoins: reserveCoinsResult.currentReserve,
            boost_percentage: boost
        };
    } catch (error) {
        console.error(`Error in updateBuildingPosition:`, error);
        throw new Error(`Error updating building position: ${error.message}`);
    }
}

// Update getBuildingGoldDetails to use the collectReserveCoins function
async function getBuildingGoldDetails(userIdParam, buildingId, boostPercentage = 0) {
    try {
        // Use the new collectReserveCoins function
        const result = await collectReserveCoins(userIdParam, parseInt(buildingId));
        
        // Add boost percentage to the result
        result.boost_percentage = parseInt(boostPercentage) || 0;
        result.was_collected = true;
        
        return result;
    } catch (error) {
        console.error(`Error in getBuildingGoldDetails:`, error);
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

            // Set creature level to 1 directly using setLevel method
            if (creatureTemplate.setLevel) {
                creatureTemplate.setLevel(1);
                await creatureTemplate.save();
                console.log('Set creature level to 1');
            }

            // Create new creature instance
            const newCreature = new Creature({
                creature_Id: creatureTemplate.creature_Id,
                name: creatureTemplate.name,
                type: creatureTemplate.type,
                gold_coins: creatureTemplate.gold_coins,
                description: creatureTemplate.description,
                image: creatureTemplate.image,
                level: 1 // Set level directly to 1
            });
            
            // Ensure level stats are properly set
            if (newCreature.setLevel) {
                newCreature.setLevel(1);
            }
            
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
            const matchedDetails = await Creature.findOne({ 
                name: newCreature.name,
                level: newCreature.level 
            }).lean();

            response.data.creature = {
                _id: newCreature._id,
                creature_Id: newCreature.creature_Id,
                name: newCreature.name,
                type: newCreature.type,
                level: newCreature.levelNumber,
                gold_coins: newCreature.gold_coins,
                ...matchedDetails
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

// Add creature to building
async function addCreatureToBuilding(userIdParam, buildingIndex, creatureData) {
    let creatureErrors = [];
    try {
        console.log('Adding creature to building:', { userIdParam, buildingIndex, creatureData });

        // Find user and populate creatures
        let user = await User.findOne({ userId: userIdParam }).populate('creatures.creature_id');
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate('creatures.creature_id');
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Parse buildingIndex as integer
        const effectiveBuildingIndex = parseInt(buildingIndex);
        if (isNaN(effectiveBuildingIndex)) {
            throw new Error(`Invalid building index: ${buildingIndex}`);
        }

        // Find the building
        const building = user.buildings.find(b => b.index === effectiveBuildingIndex);
        if (!building) {
            throw new Error(`Building with index ${effectiveBuildingIndex} not found`);
        }

        // Initialize arrays if they don't exist
        if (!building.creatures) {
            building.creatures = [];
        }
        if (!user.creatures) {
            user.creatures = [];
        }

        // Load creature template
        let creatureTemplate = null;
        if (creatureData.creature_type) {
            creatureTemplate = await Creature.findOne({ creature_Id: creatureData.creature_type });
            if (!creatureTemplate) {
                // Fallback to searching by name
                creatureTemplate = await Creature.findOne({ 
                    name: { $regex: new RegExp('^' + creatureData.name + '$', 'i') }
                });
            }
            console.log('Found creature template:', creatureTemplate);
            if (!creatureTemplate) {
                throw new Error(`Creature template not found for type: ${creatureData.creature_type}`);
            }
        }

        let newCreature;
        let creatureId;

        // Check if we should use existing template instead of creating a new entry
        if (creatureData.useExistingTemplate && creatureTemplate) {
            console.log('Using existing creature template without creating new entry');
            
            // Generate a unique ID for the user's creature reference
            creatureId = new mongoose.Types.ObjectId();
            
            // Use template data directly
            newCreature = {
                _id: creatureId,
                creature_Id: creatureTemplate.creature_Id,
                name: creatureData.name || creatureTemplate.name,
                type: creatureTemplate.type,
                level: creatureData.level || 1,
                base_attack: creatureTemplate.base_attack,
                base_health: creatureTemplate.base_health,
                gold_coins: creatureTemplate.gold_coins,
                image: creatureTemplate.image,
                description: creatureTemplate.description
            };
        } else {
            // Create new creature in database (original behavior)
            newCreature = new Creature({
                creature_Id: creatureData.creature_type || (creatureTemplate?.creature_Id) || 'dragon',
                name: creatureData.name || (creatureTemplate?.name) || 'Dragon',
                type: creatureData.type || (creatureTemplate?.type) || 'common',
                level: creatureData.level || 1,
                base_attack: creatureData.base_attack || (creatureTemplate?.base_attack) || 45,
                base_health: creatureData.base_health || (creatureTemplate?.base_health) || 250,
                gold_coins: creatureData.gold_coins || (creatureTemplate?.gold_coins) || 50,
                image: creatureData.image || (creatureTemplate?.image) || 'dragon.png',
                description: creatureData.description || (creatureTemplate?.description) || 'A fierce fire-breathing dragon'
            });

            // Save the new creature
            await newCreature.save();
            console.log('New creature saved:', newCreature);
            creatureId = newCreature._id;
        }

        // Add creature reference to building's creatures array
        if (!building.creatures.some(c => c.toString() === creatureId.toString())) {
            building.creatures.push(creatureId);
        }

        // Create creature entry for user
        const userCreatureEntry = {
            creature_id: creatureId,
            name: newCreature.name,
            level: newCreature.level || 1,
            building_index: effectiveBuildingIndex
        };

        // Validate required fields
        if (!userCreatureEntry.name || typeof userCreatureEntry.building_index !== 'number') {
            throw new Error('Missing or invalid required fields for creature entry');
        }

        // Check if creature already exists in user's creatures array
        const existingCreatureIndex = user.creatures.findIndex(c => 
            c.creature_id && c.creature_id.toString() === creatureId.toString() && 
            c.building_index === effectiveBuildingIndex
        );

        if (existingCreatureIndex === -1) {
            // Add new creature entry
            user.creatures.push(userCreatureEntry);
        } else {
            // Update existing creature entry
            user.creatures[existingCreatureIndex] = {
                ...user.creatures[existingCreatureIndex],
                ...userCreatureEntry
            };
        }

        // Mark arrays as modified to ensure Mongoose picks up the changes
        user.markModified('creatures');
        user.markModified('buildings');

        // Save user
        await user.save();
        console.log('User saved successfully with creatures:', user.creatures);

        // Get the level stats for the creature's level
        const levelStats = creatureTemplate?.level_stats?.find(stat => stat.level === newCreature.level);

        // Calculate attack and health based on level
        let attack = newCreature.base_attack || creatureTemplate?.base_attack || 45;
        let health = newCreature.base_health || creatureTemplate?.base_health || 250;
        
        // Apply level multipliers
        const attackGrowth = 0.03; // 3% growth per level
        const healthGrowth = 0.03; // 3% growth per level
        
        for (let level = 1; level < (newCreature.level || 1); level++) {
            attack += Math.round(attack * attackGrowth);
            health += Math.round(health * healthGrowth);
        }

        // Create the complete creature response
        const creatureResponse = {
            _id: creatureId,
            name: newCreature.name,
            level: newCreature.level || 1,
            building_index: effectiveBuildingIndex,
            creature_Id: newCreature.creature_Id || creatureTemplate?.creature_Id,
            type: newCreature.type || creatureTemplate?.type,
            gold_coins: newCreature.gold_coins || creatureTemplate?.gold_coins,
            description: newCreature.description || creatureTemplate?.description,
            image: newCreature.image || creatureTemplate?.image,
            base_attack: newCreature.base_attack || creatureTemplate?.base_attack,
            base_health: newCreature.base_health || creatureTemplate?.base_health,
            attack: attack,
            health: health,
            speed: levelStats?.speed || creatureTemplate?.speed,
            armor: levelStats?.armor || creatureTemplate?.armor,
            critical_health: levelStats?.critical_health || creatureTemplate?.critical_health,
            critical_damage: levelStats?.critical_damage || creatureTemplate?.critical_damage
        };

        // Log the complete response for debugging
        console.log('Complete creature response:', creatureResponse);

        return {
            success: true,
            message: 'Creature added successfully',
            data: {
                creature: creatureResponse
            }
        };
    } catch (error) {
        console.error('Error in addCreatureToBuilding:', error);
        return {
            success: false,
            message: `Error adding creature to building: ${error.message}`,
            errors: creatureErrors
        };
    }
}

// Update specific creature level for a user's building - with embedded creature data
async function updateBuildingCreatureLevel(userIdParam, buildingIdParam, creatureIdParam, newLevelNumber) {
    try {
        console.log(`Updating creature ${creatureIdParam} to level ${newLevelNumber} in building ${buildingIdParam} for user ${userIdParam}`);
        
        // Try to find user by userId first
        let user = await User.findOne({ userId: userIdParam });
        if (!user) {
            // If not found, try to find by MongoDB _id
            if (mongoose.Types.ObjectId.isValid(userIdParam)) {
                user = await User.findById(userIdParam);
            }
            
            if (!user) {
                throw new Error('User not found');
            }
        }
        
        console.log(`Found user: ${user.userId}`);

        // Find the building
        let building = null;
        let buildingIndex = null;
        
        // First try by buildingId
        building = user.buildings.find(b => b.buildingId === buildingIdParam);
        
        // If not found, try by index
        if (!building && !isNaN(parseInt(buildingIdParam))) {
            buildingIndex = parseInt(buildingIdParam);
            building = user.buildings.find(b => b.index === buildingIndex);
        }
        
        // If still not found and valid ObjectId, try by _id
        if (!building && mongoose.Types.ObjectId.isValid(buildingIdParam)) {
            building = user.buildings.find(b => b._id.toString() === buildingIdParam);
        }

        if (!building) {
            throw new Error('Building not found for this user');
        }
        
        buildingIndex = building.index;
        console.log(`Found building: ${building.buildingId} (index: ${buildingIndex})`);

        // Find the creature in the user's creatures array that's associated with this building
        if (!user.creatures || user.creatures.length === 0) {
            throw new Error('User has no creatures');
        }
        
        // Find the specific creature by its ID
        let creatureEntry = null;
        for (let i = 0; i < user.creatures.length; i++) {
            const entry = user.creatures[i];
            if (entry.building_index === buildingIndex) {
                if (entry._id && entry._id.toString() === creatureIdParam) {
                    creatureEntry = entry;
                    break;
                } else if (entry.creature_id && entry.creature_id.toString() === creatureIdParam) {
                    creatureEntry = entry;
                    break;
                }
            }
        }
        
        if (!creatureEntry) {
            throw new Error('Creature not found in this building');
        }
        
        console.log(`Found creature entry with ID: ${creatureEntry._id || creatureEntry.creature_id}`);
        if (creatureEntry.name) {
            console.log(`Creature name: ${creatureEntry.name}`);
        }
        
        // Add debugging for creature type lookup
        console.log('Creature entry details:', {
            id: creatureEntry._id || creatureEntry.creature_id,
            name: creatureEntry.name,
            building_index: creatureEntry.building_index,
            creature_type: creatureEntry.creature_type
        });
        
        // Check if creature_type exists
        if (!creatureEntry.creature_type) {
            console.error('creature_type is missing from creature entry');
            
            // Try to get the creature_type from the creature document directly
            if (mongoose.Types.ObjectId.isValid(creatureEntry.creature_id)) {
                try {
                    const creatureDoc = await Creature.findById(creatureEntry.creature_id);
                    if (creatureDoc) {
                        console.log('Found creature in database:', {
                            id: creatureDoc._id,
                            name: creatureDoc.name,
                            creature_Id: creatureDoc.creature_Id
                        });
                        // Use the creature_Id from the creature document as the type
                        creatureEntry.creature_type = creatureDoc.creature_Id;
                        console.log(`Set creature_type to ${creatureEntry.creature_type} from creature document`);
                    }
                } catch (err) {
                    console.error('Error finding creature by ID:', err);
                }
            }
        }
        
        // Get the creature template for stat calculations
        console.log(`Looking for creature template with creature_Id: ${creatureEntry.creature_type}`);
        let creatureTemplate = null;
        
        if (creatureEntry.creature_type) {
            creatureTemplate = await Creature.findOne({ creature_Id: creatureEntry.creature_type });
        }
        
        // If still not found, try searching by name
        if (!creatureTemplate && creatureEntry.name) {
            creatureTemplate = await Creature.findOne({ name: creatureEntry.name });
            if (creatureTemplate) {
                console.log(`Found template by name: ${creatureTemplate.name}`);
                // Update the creature_type in the entry
                creatureEntry.creature_type = creatureTemplate.creature_Id;
            }
        }
        
        // If still not found, try listing all templates for manual selection
        if (!creatureTemplate) {
            console.error(`Could not find creature template with creature_Id: ${creatureEntry.creature_type}`);
            
            // List available creature templates for debugging
            const allTemplates = await Creature.find({}, 'creature_Id name type');
            console.log('Available creature templates:', allTemplates.map(t => ({ id: t._id, creature_Id: t.creature_Id, name: t.name, type: t.type })));
            
            // Try to guess a reasonable default based on any available name or other info
            if (creatureEntry.name) {
                const nameMatch = allTemplates.find(t => 
                    t.name.toLowerCase() === creatureEntry.name.toLowerCase() ||
                    creatureEntry.name.toLowerCase().includes(t.name.toLowerCase()) ||
                    t.name.toLowerCase().includes(creatureEntry.name.toLowerCase())
                );
                
                if (nameMatch) {
                    creatureTemplate = nameMatch;
                    creatureEntry.creature_type = nameMatch.creature_Id;
                    console.log(`Matched creature by name similarity to: ${nameMatch.name}`);
                } else {
                    // Just pick the first template as a fallback
                    creatureTemplate = allTemplates[0];
                    creatureEntry.creature_type = allTemplates[0].creature_Id;
                    console.log(`Using default template: ${allTemplates[0].name}`);
                }
            } else {
                // Just pick the first template as a fallback
                creatureTemplate = allTemplates[0];
                creatureEntry.creature_type = allTemplates[0].creature_Id;
                console.log(`Using default template: ${allTemplates[0].name}`);
            }
        }
        
        if (!creatureTemplate) {
            throw new Error('Could not find or assign a creature template for calculating stats');
        }
        
        console.log(`Using creature template: ${creatureTemplate.name} (${creatureTemplate.creature_Id})`);

        // Save the previous level
        const previousLevel = creatureEntry.level || 1;
        
        // Make sure the new level is valid (1-40)
        const parsedLevel = parseInt(newLevelNumber);
        if (isNaN(parsedLevel) || parsedLevel < 1 || parsedLevel > 40) {
            throw new Error('Level must be between 1 and 40');
        }
        
        // Update the creature's level
        creatureEntry.level = parsedLevel;
        
        // Get base stats from creature entry or template
        let baseAttack = creatureEntry.base_attack || creatureTemplate.base_attack;
        let baseHealth = creatureEntry.base_health || creatureTemplate.base_health;
        
        // If base stats are still missing, set defaults
        if (!baseAttack) baseAttack = 10;
        if (!baseHealth) baseHealth = 50;
        
        // Save base stats to the creature entry
        if (!creatureEntry.base_attack) creatureEntry.base_attack = baseAttack;
        if (!creatureEntry.base_health) creatureEntry.base_health = baseHealth;
        
        // Calculate new stats based on the level
        let attack = baseAttack;
        let health = baseHealth;
        
        // Apply level multipliers based on type
        let attackGrowth = 0.03; // Default 3% growth
        let healthGrowth = 0.03; // Default 3% growth
        
        // Adjust growth rates based on type/rarity
        const creatureType = creatureTemplate.type || 'common';
        switch(creatureType.toLowerCase()) {
            case 'legendary':
                attackGrowth = 0.04;
                healthGrowth = 0.04;
                break;
            case 'elite':
                attackGrowth = 0.05;
                healthGrowth = 0.05;
                break;
            case 'epic':
                attackGrowth = 0.04;
                healthGrowth = 0.04;
                break;
            // common and rare use default 3%
        }
        
        // Calculate stats with compounding growth
        for (let level = 1; level < parsedLevel; level++) {
            attack += Math.round(attack * attackGrowth);
            health += Math.round(health * healthGrowth);
        }
        
        // Save the updated stats directly in the creature entry
        creatureEntry.attack = attack;
        creatureEntry.health = health;
        
        // Save the user
        await user.save();
        
        console.log(`Updated creature ${creatureEntry.name || creatureEntry.creature_type} from level ${previousLevel} to ${parsedLevel}`);
        console.log(`New stats: Attack ${attack}, Health ${health}`);

        return {
            user: {
                userId: user.userId,
                user_name: user.user_name
            },
            building: {
                buildingId: building.buildingId,
                name: building.name,
                index: buildingIndex
            },
            creature: {
                creature_id: creatureEntry._id || creatureEntry.creature_id,
                creature_type: creatureEntry.creature_type,
                name: creatureEntry.name || creatureTemplate.name,
                previousLevel: previousLevel,
                newLevel: parsedLevel,
                attack: attack,
                health: health,
                count: creatureEntry.count || 1
            }
        };
    } catch (error) {
        console.error(`Error updating creature level:`, error);
        throw new Error(`Error updating creature level: ${error.message}`);
    }
}

// Get creatures associated with a specific building
async function getBuildingCreatures(userIdParam, buildingIndex) {
    try {
        console.log(`Fetching creatures for building ${buildingIndex} of user ${userIdParam}`);
        
        // Parse buildingIndex as integer
        const effectiveBuildingIndex = parseInt(buildingIndex);
        if (isNaN(effectiveBuildingIndex)) {
            throw new Error(`Invalid building index: ${buildingIndex}`);
        }

        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Find the building
        const building = user.buildings.find(b => b.index === effectiveBuildingIndex);
        if (!building) {
            throw new Error(`Building with index ${effectiveBuildingIndex} not found`);
        }

        console.log('Found building:', building);
        console.log('Building creatures:', building.creatures);

        // Initialize creatures array if it doesn't exist
        if (!building.creatures) {
            building.creatures = [];
        }

        // Load all creature templates for reference
        const templates = await Creature.find({}).lean();
        console.log(`Loaded ${templates.length} creature templates`);

        // Create lookup maps for templates
        const templatesByType = {};
        const templatesById = {};
        
        templates.forEach(template => {
            if (template.creature_Id) {
                templatesByType[template.creature_Id] = template;
            }
            if (template._id) {
                templatesById[template._id.toString()] = template;
            }
        });

        // Get full creature details for each creature ID in the building
        const creatures = [];
        for (const creatureId of building.creatures) {
            console.log(`Looking for creature with ID: ${creatureId}`);
            
            try {
                // Find the creature info in user's creatures array
                const userCreature = user.creatures.find(c => {
                    if (typeof c === 'object') {
                        return c._id?.toString() === creatureId.toString() || c.creature_id?.toString() === creatureId.toString();
                    }
                    return c?.toString() === creatureId.toString();
                });

                console.log('Found user creature:', userCreature);

                // Try to find the creature template based on name and type
                let template = null;
                if (userCreature && typeof userCreature === 'object' && userCreature.name) {
                    // First try exact name match
                    template = templates.find(t => t.name === userCreature.name);
                    
                    // If not found, try case-insensitive match
                    if (!template) {
                        template = templates.find(t => 
                            t.name.toLowerCase() === userCreature.name.toLowerCase() ||
                            t.creature_Id.toLowerCase() === userCreature.creature_type?.toLowerCase()
                        );
                    }
                }

                console.log('Found template:', template);

                // Create the complete creature object
                const completeCreature = {
                    _id: creatureId.toString(),
                    creature_id: creatureId.toString(),
                    creature_type: userCreature?.creature_type || template?.creature_Id || 'dragon',
                    name: userCreature?.name || template?.name || 'Dragon',
                    type: userCreature?.type || template?.type || 'common',
                    level: userCreature?.level || 1,
                    count: userCreature?.count || 1,
                    base_attack: userCreature?.base_attack || template?.base_attack || 10,
                    base_health: userCreature?.base_health || template?.base_health || 50,
                    attack: userCreature?.attack || template?.base_attack || 10,
                    health: userCreature?.health || template?.base_health || 50,
                    gold_coins: userCreature?.gold_coins || template?.gold_coins || 10,
                    image: userCreature?.image || template?.image || 'default.png',
                    description: userCreature?.description || template?.description || 'A powerful creature'
                };

                // Calculate stats based on level and type
                let attackGrowth = 0.03;
                let healthGrowth = 0.03;
                
                if (completeCreature.type) {
                    switch(completeCreature.type.toLowerCase()) {
                        case 'legendary': 
                            attackGrowth = 0.04; 
                            healthGrowth = 0.04;
                            break;
                        case 'elite': 
                            attackGrowth = 0.05; 
                            healthGrowth = 0.05;
                            break;
                        case 'epic': 
                            attackGrowth = 0.04; 
                            healthGrowth = 0.04;
                            break;
                    }
                }
                
                let attack = completeCreature.base_attack;
                let health = completeCreature.base_health;
                
                for (let level = 1; level < completeCreature.level; level++) {
                    attack += Math.round(attack * attackGrowth);
                    health += Math.round(health * healthGrowth);
                }
                
                completeCreature.attack = attack;
                completeCreature.health = health;

                creatures.push(completeCreature);
                console.log('Added complete creature:', completeCreature);
            } catch (error) {
                console.error(`Error processing creature ${creatureId}:`, error);
            }
        }

        return {
            success: true,
            message: `Retrieved ${creatures.length} creatures for building ${building.name}`,
            data: {
                building: {
                    _id: building._id,
                    buildingId: building.buildingId,
                    name: building.name,
                    index: building.index,
                    creatures: building.creatures
                },
                creatures: creatures
            }
        };
    } catch (error) {
        console.error('Error in getBuildingCreatures:', error);
        return {
            success: false,
            message: `Error fetching building creatures: ${error.message}`
        };
    }
}

// Get user buildings with details
async function getUserBuildings(userIdParam) {
    try {
        console.log(`Getting buildings for user: ${userIdParam}`);
        
        // Try to find by userId first with populated creatures
        let user = await User.findOne({ userId: userIdParam });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }

        if (!user) {
            throw new Error('User not found');
        }
        
        console.log(`Found user with ${user.buildings.length} buildings and ${user.creatures ? user.creatures.length : 0} creatures`);

        // Initialize creatures array if not present
        if (!user.creatures) {
            user.creatures = [];
        }
        
        // Check if creatures array contains strings (just IDs) and fetch complete creature data
        const userCreatures = [];
        const creatureIds = [];

        // Collect all creature IDs that need to be fetched
        if (Array.isArray(user.creatures)) {
            user.creatures.forEach(creature => {
                if (typeof creature === 'string' || creature instanceof mongoose.Types.ObjectId) {
                    creatureIds.push(creature.toString());
                } else {
                    // If it's already a creature object, add it to userCreatures
                    userCreatures.push(creature);
                }
            });
        }

        // Load creatures from database if we have IDs
        let dbCreatures = [];
        if (creatureIds.length > 0) {
            console.log(`Fetching ${creatureIds.length} creatures from database`);
            try {
                dbCreatures = await Creature.find({ 
                    _id: { $in: creatureIds.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) } 
                });
                console.log(`Found ${dbCreatures.length} creatures in database`);
            } catch (error) {
                console.error('Error fetching creatures:', error);
            }
        }

        // Load all creature templates for reference
        const allTemplates = await Creature.find({});
        console.log(`Loaded ${allTemplates.length} creature templates`);
        
        // Create lookup maps for quick access
        const templatesByType = {};
        const templatesById = {};
        const creaturesByStringId = {};
        
        // Index templates by type and ID
        allTemplates.forEach(template => {
            if (template.creature_Id) {
                templatesByType[template.creature_Id] = template;
            }
            if (template._id) {
                templatesById[template._id.toString()] = template;
            }
        });
        
        // Index DB creatures by ID for quick lookup
        dbCreatures.forEach(creature => {
            creaturesByStringId[creature._id.toString()] = creature;
        });

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
                creature_ids: [], // Simple IDs for backward compatibility
                creatures: []    // Full creature data
            };

            // Create a list of creatures for this building
            const buildingCreatures = [];
            
            // First add creatures that are already objects in the user.creatures array
            if (userCreatures.length > 0) {
                userCreatures.forEach(creature => {
                    if (creature.building_index === building.index) {
                        buildingCreatures.push(creature);
                    }
                });
            }
            
            // Look for creature IDs that belong to this building
            // We need to check each creature from the database to see if it belongs to this building
            creatureIds.forEach(creatureId => {
                const creature = creaturesByStringId[creatureId];
                if (creature && creature.building_index === building.index) {
                    buildingCreatures.push(creature);
                }
            });

            // Check if building has creatures
            if (buildingCreatures.length > 0) {
                buildingData.is_creature_building = true;
                
                // Process each creature and add complete data
                buildingCreatures.forEach(creatureEntry => {
                    const creatureId = creatureEntry._id?.toString() || creatureEntry;
                    
                    // Get basic creature data from DB or user object
                    let creature = creatureEntry;
                    if (typeof creatureEntry === 'string') {
                        creature = creaturesByStringId[creatureEntry];
                    }
                    
                    // Skip if this is just an ID and we couldn't find the creature
                    if (!creature && typeof creatureEntry === 'string') {
                        console.log(`Couldn't find creature with ID ${creatureEntry}`);
                        return;
                    }
                    
                    // Get basic creature info for the simple array
                    buildingData.creature_ids.push({
                        creature_id: creatureId,
                        creature_type: creature?.creature_type || 'unknown',
                        level: creature?.level || 1,
                        count: creature?.count || 1
                    });
                    
                    // Start with data from the creature entry itself
                    const creatureData = {
                        _id: creatureId,
                        creature_id: creatureId,
                        creature_type: creature?.creature_type,
                        name: creature?.name,
                        type: creature?.type,
                        level: creature?.level || 1,
                        base_attack: creature?.base_attack,
                        base_health: creature?.base_health,
                        attack: creature?.attack,
                        health: creature?.health,
                        gold_coins: creature?.gold_coins,
                        image: creature?.image,
                        description: creature?.description,
                        building_index: building.index,
                        count: creature?.count || 1
                    };
                    
                    // Use template data to fill in missing values if we have a creature_type
                    if (creatureData.creature_type && templatesByType[creatureData.creature_type]) {
                        const template = templatesByType[creatureData.creature_type];
                        
                        if (!creatureData.name) creatureData.name = template.name;
                        if (!creatureData.type) creatureData.type = template.type;
                        if (!creatureData.base_attack) creatureData.base_attack = template.base_attack;
                        if (!creatureData.base_health) creatureData.base_health = template.base_health;
                        if (!creatureData.gold_coins) creatureData.gold_coins = template.gold_coins;
                        if (!creatureData.image) creatureData.image = template.image;
                        if (!creatureData.description) creatureData.description = template.description;
                    }
                    
                    // If we have a direct match by ID in the templates, use that too
                    if (templatesById[creatureId]) {
                        const template = templatesById[creatureId];
                        
                        if (!creatureData.creature_type) creatureData.creature_type = template.creature_Id;
                        if (!creatureData.name) creatureData.name = template.name;
                        if (!creatureData.type) creatureData.type = template.type;
                        if (!creatureData.base_attack) creatureData.base_attack = template.base_attack;
                        if (!creatureData.base_health) creatureData.base_health = template.base_health;
                        if (!creatureData.gold_coins) creatureData.gold_coins = template.gold_coins;
                        if (!creatureData.image) creatureData.image = template.image;
                        if (!creatureData.description) creatureData.description = template.description;
                    }
                    
                    // Calculate attack and health if missing
                    if (!creatureData.attack && creatureData.base_attack) {
                        let baseAttack = creatureData.base_attack;
                        let attackGrowth = 0.03; // Default growth
                        
                        // Adjust growth based on type
                        if (creatureData.type) {
                            switch(creatureData.type.toLowerCase()) {
                                case 'legendary': attackGrowth = 0.04; break;
                                case 'elite': attackGrowth = 0.05; break;
                                case 'epic': attackGrowth = 0.04; break;
                            }
                        }
                        
                        // Calculate attack with compounding growth
                        let attack = baseAttack;
                        for (let level = 1; level < creatureData.level; level++) {
                            attack += Math.round(attack * attackGrowth);
                        }
                        creatureData.attack = attack;
                    }
                    
                    if (!creatureData.health && creatureData.base_health) {
                        let baseHealth = creatureData.base_health;
                        let healthGrowth = 0.03; // Default growth
                        
                        // Adjust growth based on type
                        if (creatureData.type) {
                            switch(creatureData.type.toLowerCase()) {
                                case 'legendary': healthGrowth = 0.04; break;
                                case 'elite': healthGrowth = 0.05; break;
                                case 'epic': healthGrowth = 0.04; break;
                            }
                        }
                        
                        // Calculate health with compounding growth
                        let health = baseHealth;
                        for (let level = 1; level < creatureData.level; level++) {
                            health += Math.round(health * healthGrowth);
                        }
                        creatureData.health = health;
                    }
                    
                    // Set defaults for missing fields
                    if (!creatureData.name) creatureData.name = "Unknown Creature";
                    if (!creatureData.type) creatureData.type = "common";
                    if (!creatureData.attack) creatureData.attack = creatureData.base_attack || 10;
                    if (!creatureData.health) creatureData.health = creatureData.base_health || 50;
                    if (!creatureData.base_attack) creatureData.base_attack = 10;
                    if (!creatureData.base_health) creatureData.base_health = 50;
                    if (!creatureData.gold_coins) creatureData.gold_coins = 10;
                    if (!creatureData.image) creatureData.image = "default.png";
                    if (!creatureData.description) creatureData.description = "A mysterious creature";
                    
                    buildingData.creatures.push(creatureData);
                });
            }

            return buildingData;
        });

        return {
            success: true,
            message: `User buildings (${formattedBuildings.length}) and creatures fetched successfully`,
            data: {
                buildings: formattedBuildings
            }
        };
    } catch (error) {
        console.error('Error fetching user buildings:', error);
        throw new Error(`Error fetching user buildings: ${error.message}`);
    }
}

async function collectBuildingCoins(userIdParam, buildingIdentifier) {
    try {
        let user = await User.findOne({ userId: userIdParam });

        if (!user) throw new Error('User not found ');

        const buildingIndex = parseInt(buildingIdentifier);
        let building = user.buildings.find(b => b.index === buildingIndex);

        if (!building) throw new Error('Building not found inside user data');

        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifference = (currentTime - lastCollectionTime) / (1000 * 60 * 60); // in hours

        let baseGoldGenerated = 0;

        // Track which creatures were found in this building (for debugging)
        const foundCreatures = [];
        
        // Check user's creatures array for creatures in this building
        if (user.creatures && user.creatures.length > 0) {
            const buildingCreatures = user.creatures.filter(c => c.building_index === buildingIndex);
            
            for (let creatureEntry of buildingCreatures) {
                const creature = await Creature.findById(creatureEntry.creature_id);
                if (creature) {
                    foundCreatures.push(creature.name);
                    const count = creatureEntry.count || 1;
                    baseGoldGenerated += creature.gold_coins * count * timeDifference;
                }
            }
            
            console.log(`Found ${foundCreatures.length} creatures in building ${buildingIndex}: ${foundCreatures.join(', ')}`);
        } else {
            console.log(`No creatures found for building ${buildingIndex}, using building base gold rate`);
            baseGoldGenerated = building.gold_coins * timeDifference;
        }

        // Make sure reserveCoins is a number (default to 0 if undefined/null)
        const reserveCoins = parseFloat(building.reserveCoins || 0);
        
        // Total gold to add is base generation plus reserve
        const addedGold = baseGoldGenerated + reserveCoins;

        // Update building data
        building.last_collected = currentTime;
        building.reserveCoins = 0; // Reset reserve coins after collection

        // Add the collected gold to user's total
        user.gold_coins += addedGold;

        await user.save();

        return {
            success: true,
            message: 'Coins collected successfully',
            totalCoins: user.gold_coins.toFixed(2),
            baseGoldAmount: baseGoldGenerated.toFixed(2),
            reserveCoins: reserveCoins.toFixed(2),
            addedGold: addedGold.toFixed(2),
            buildingIndex,
            last_collected: currentTime,
            creatures_found: foundCreatures.length > 0 ? foundCreatures : []
        };
    } catch (error) {
        console.error(`Error collecting building coins:`, error);
        throw new Error(`Error collecting building coins: ${error.message}`);
    }
}

async function deleteCreatureFromBuilding(userIdParam, buildingIndex, creatureId) {
    try {
        console.log(`Attempting to delete creature ${creatureId} from building ${buildingIndex} for user ${userIdParam}`);
        
        // Parse buildingIndex as integer
        const effectiveBuildingIndex = parseInt(buildingIndex);
        if (isNaN(effectiveBuildingIndex)) {
            throw new Error(`Invalid building index: ${buildingIndex}`);
        }

        // Find user and populate creatures
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Find the building
        const building = user.buildings.find(b => b.index === effectiveBuildingIndex);
        if (!building) {
            throw new Error(`Building with index ${effectiveBuildingIndex} not found`);
        }

        console.log('Found building:', building);
        console.log('Current building creatures:', building.creatures);
        console.log('Current user creatures:', user.creatures);

        // Initialize arrays if they don't exist
        if (!building.creatures) {
            building.creatures = [];
        }
        if (!user.creatures) {
            user.creatures = [];
        }

        // Convert creatureId to string for comparison
        const targetCreatureId = String(creatureId);
        
        // Find the creature in the building's creatures array
        const buildingCreatureIndex = building.creatures.findIndex(cId => String(cId) === targetCreatureId);
        
        if (buildingCreatureIndex === -1) {
            throw new Error('Creature not found in this building');
        }

        // Get creature details before removing
        const creatureDetails = await Creature.findById(targetCreatureId);
        console.log('Found creature details:', creatureDetails);

        // Remove the creature from the building
        building.creatures.splice(buildingCreatureIndex, 1);
        console.log('Updated building creatures:', building.creatures);

        // Find and update the creature in user's creatures array
        const userCreatureIndex = user.creatures.findIndex(c => {
            if (typeof c === 'object') {
                return c._id?.toString() === targetCreatureId || c.creature_id?.toString() === targetCreatureId;
            }
            return c?.toString() === targetCreatureId;
        });

        if (userCreatureIndex !== -1) {
            // Remove the creature from user's array
            user.creatures.splice(userCreatureIndex, 1);
            console.log('Removed creature from user creatures array');
        }

        // Save the updated user document
        await user.save();
        console.log('User document saved successfully');

        return {
            success: true,
            message: 'Creature deleted from building successfully',
            data: {
                building: {
                    buildingId: building.buildingId,
                    name: building.name,
                    index: building.index,
                    creatures: building.creatures
                },
                removed_creature: creatureDetails ? {
                    _id: creatureDetails._id,
                    name: creatureDetails.name,
                    type: creatureDetails.type,
                    level: creatureDetails.level
                } : {
                    _id: targetCreatureId
                }
            }
        };
    } catch (error) {
        console.error('Error in deleteCreatureFromBuilding:', error);
        return {
            success: false,
            message: `Error deleting creature from building: ${error.message}`
        };
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

// Get creature locations and details
async function getCreatureLocations(userIdParam, creatureIds) {
    try {
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Initialize result array
        const creatureLocations = [];

        // Convert creatureIds to array if it's a single ID
        const targetCreatureIds = Array.isArray(creatureIds) ? creatureIds : [creatureIds];

        // Find each creature in user's creatures array
        for (const creatureId of targetCreatureIds) {
            const userCreature = user.creatures.find(c => {
                const cId = typeof c === 'object' ? (c._id?.toString() || c.creature_id?.toString()) : c?.toString();
                return cId === creatureId.toString();
            });

            if (userCreature) {
                // Find the building this creature is in
                const building = user.buildings.find(b => b.index === userCreature.building_index);

                creatureLocations.push({
                    creature_id: creatureId,
                    name: userCreature.name || 'Unknown Creature',
                    level: userCreature.level || 1,
                    building: building ? {
                        name: building.name,
                        index: building.index
                    } : null
                });
            } else {
                creatureLocations.push({
                    creature_id: creatureId,
                    name: 'Not Found',
                    level: null,
                    building: null
                });
            }
        }

        return {
            success: true,
            message: `Found information for ${creatureLocations.length} creatures`,
            data: creatureLocations
        };
    } catch (error) {
        console.error('Error in getCreatureLocations:', error);
        return {
            success: false,
            message: `Error getting creature locations: ${error.message}`
        };
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
    getTotalCreaturesForUser,
    getCreatureLocations,
    updateReserveCoins
};
