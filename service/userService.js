const User = require('../models/user');
const Building = require('../models/building');
const Creature = require('../models/creature');
const mongoose = require('mongoose');
const Boost = require('../models/boost');

async function getUserWithDetails(userIdParam) {
    try {
        const User = require('../models/user');
        const Creature = require('../models/creature');

        // Find the user
        const user = await User.findOne({ userId: userIdParam });
        if (!user) {
            throw new Error('User not found');
        }

        // If no creatures, just return the user as is
        if (!user.creatures || user.creatures.length === 0) {
            return user;
        }

        // Fetch all creature templates
        const creatureTemplates = await Creature.find();
        
        // Create lookup maps for quick reference
        const templateMap = {};
        const templateByTypeMap = {};
        
        creatureTemplates.forEach(template => {
            templateMap[template._id.toString()] = template;
            if (template.creature_Id) {
                templateByTypeMap[template.creature_Id] = template;
            }
        });

        // Process each creature to add full data
        const enhancedCreatures = [];
        
        for (const userCreature of user.creatures) {
            let template = null;
            
            // Try to find by creature_id
            if (userCreature.creature_id) {
                const creatureIdString = userCreature.creature_id.toString();
                template = templateMap[creatureIdString];
            }
            
            // If not found, try by creature_type
            if (!template && userCreature.creature_type) {
                template = templateByTypeMap[userCreature.creature_type];
            }
            
            // If still not found, get the first template matching the creature name
            if (!template && userCreature.name) {
                template = creatureTemplates.find(t => 
                    t.name.toLowerCase() === userCreature.name.toLowerCase() ||
                    t.creature_Id.toLowerCase() === userCreature.name.toLowerCase()
                );
            }
            
            // If no template found, use first available or continue
            if (!template && creatureTemplates.length > 0) {
                template = creatureTemplates[0];
            }
            
            if (!template) {
                // Just add the original data if no template found
                enhancedCreatures.push(userCreature);
                continue;
            }
            
            // Get level stats for current level
            const level = userCreature.level || 1;
            const levelStats = template.level_stats.find(stat => stat.level === level) || 
                              (template.level_stats.length > 0 ? template.level_stats[0] : null);
            
            // Create enhanced creature data with full details
            const enhancedCreature = {
                _id: userCreature._id,
                creature_id: userCreature.creature_id || template._id,
                creature_type: userCreature.creature_type || template.creature_Id,
                name: template.name,
                type: template.type,
                level: level,
                building_index: userCreature.building_index,
                base_attack: template.base_attack,
                base_health: template.base_health,
                attack: levelStats ? levelStats.attack : template.base_attack,
                health: levelStats ? levelStats.health : template.base_health,
                gold_coins: levelStats ? levelStats.gold : template.gold_coins,
                arcane_energy: levelStats ? levelStats.arcane_energy : template.arcane_energy,
                speed: template.speed,
                armor: template.armor,
                critical_damage_percentage: template.critical_damage_percentage,
                critical_damage: template.critical_damage,
                image: template.image,
                description: template.description,
                count: userCreature.count || 1
            };
            
            enhancedCreatures.push(enhancedCreature);
        }
        
        // Replace the creatures in the user object with enhanced versions
        const userObject = user.toObject();
        userObject.creatures = enhancedCreatures;
        
        return userObject;
    } catch (error) {
        console.error('Error in getUserWithDetails:', error);
        throw new Error(`Error fetching user details: ${error.message}`);
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

        // Check if a creature of the same type/name already exists in this building
        const creatureName = creatureData.name || (creatureTemplate?.name) || 'dragon';
        const creatureType = creatureData.creature_type || (creatureTemplate?.creature_Id) || 'dragon';
        
        // Get all creatures in this building
        const buildingCreatures = user.creatures.filter(c => c.building_index === effectiveBuildingIndex);
        console.log('Existing creatures in building:', buildingCreatures);
        
        // Check if there are any existing creatures in the building
        if (buildingCreatures.length > 0) {
            // Get the type of the first creature in the building (assuming all are the same)
            const existingType = buildingCreatures[0].creature_type?.toLowerCase() || 
                               buildingCreatures[0].name?.toLowerCase();
                
            console.log(`Building already has creatures of type: ${existingType}`);
            
            // Check if new creature matches the existing type in the building
            const newCreatureType = creatureType.toLowerCase();
            const newCreatureName = creatureName.toLowerCase();
            
            if (existingType && (newCreatureType !== existingType && newCreatureName !== existingType)) {
                console.log(`Cannot add ${newCreatureName}/${newCreatureType} to building that already has ${existingType}`);
                
                // Find the first creature to return its details
                const firstExistingCreature = buildingCreatures[0];
                
                return {
                    success: false,
                    message: `This building already contains "${firstExistingCreature.name}" creatures. Only "${firstExistingCreature.name}" creatures can be added to this building.`,
                    data: {
                        existing_creature: {
                            _id: firstExistingCreature._id || firstExistingCreature.creature_id,
                            name: firstExistingCreature.name,
                            level: firstExistingCreature.level,
                            building_index: effectiveBuildingIndex,
                            type: firstExistingCreature.type
                        }
                    }
                };
            }
            
            // Check for duplicate creature with same name/type
            const existingCreature = buildingCreatures.find(c => 
                c.name?.toLowerCase() === creatureName.toLowerCase() ||
                c.creature_type?.toLowerCase() === creatureType.toLowerCase()
            );

            if (existingCreature) {
                console.log('Found existing creature of the same type in building:', existingCreature);
                
                // We're now allowing multiple creatures of the same type, so we don't return early
                // Just log that we found an existing creature of the same type
                console.log(`Building already has a ${existingCreature.name}, allowing addition of another one`);
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
            building_index: effectiveBuildingIndex,
            creature_type: newCreature.creature_Id
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
            critical_damage_percentage: levelStats?.critical_damage_percentage || creatureTemplate?.critical_damage_percentage || 50,
            critical_damage: levelStats?.critical_damage || creatureTemplate?.critical_damage || 20
        };

        // If level_stats exist, simplify to only include level, attack and health
        if (creatureTemplate?.level_stats) {
            creatureResponse.level_stats = creatureTemplate.level_stats.map(stat => ({
                level: stat.level,
                attack: stat.attack,
                health: stat.health
            }));
        }

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
        
        // Calculate and update gold coins and arcane energy based on type and level
        let baseGold = creatureTemplate.gold_coins;
        let baseArcaneEnergy = creatureTemplate.arcane_energy;
        
        // If not explicitly set in template, use defaults based on creature type
        if (!baseArcaneEnergy) {
            switch(creatureType.toLowerCase()) {
                case 'common':
                    baseArcaneEnergy = 99;
                    if (!baseGold) baseGold = 77;
                    break;
                case 'rare':
                    baseArcaneEnergy = 212;
                    if (!baseGold) baseGold = 125;
                    break;
                case 'epic':
                    baseArcaneEnergy = 403;
                    if (!baseGold) baseGold = 415;
                    break;
                case 'legendary':
                    baseArcaneEnergy = 612;
                    if (!baseGold) baseGold = 1001;
                    break;
                case 'elite':
                    baseArcaneEnergy = 843;
                    if (!baseGold) baseGold = 1503;
                    break;
                default:
                    baseArcaneEnergy = 99;
                    if (!baseGold) baseGold = 77;
            }
        }
        
        // Calculate gold and arcane energy with level multiplier (doubles each level)
        const levelMultiplier = Math.pow(2, parsedLevel - 1);
        const goldCoins = baseGold * levelMultiplier;
        const arcaneEnergy = baseArcaneEnergy * levelMultiplier;
        
        // Save gold and arcane energy values
        creatureEntry.gold_coins = goldCoins;
        creatureEntry.arcane_energy = arcaneEnergy;
        
        // Save the user
        await user.save();
        
        console.log(`Updated creature ${creatureEntry.name || creatureEntry.creature_type} from level ${previousLevel} to ${parsedLevel}`);
        console.log(`New stats: Attack ${attack}, Health ${health}, Gold ${goldCoins}, Arcane Energy ${arcaneEnergy}`);

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
                gold: goldCoins,
                arcane_energy: arcaneEnergy,
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
        const User = require('../models/user');
        const Creature = require('../models/creature');
        
        // Find the user
        const user = await User.findOne({ userId: userIdParam });
        if (!user) {
            throw new Error('User not found');
        }

        // If no buildings, return empty array
        if (!user.buildings || user.buildings.length === 0) {
            return { buildings: [] };
        }

        // Get all creature templates for reference
        const creatureTemplates = await Creature.find();
        
        // Create lookup maps for quick reference
        const templateMap = {};
        const templateByTypeMap = {};
        
        creatureTemplates.forEach(template => {
            templateMap[template._id.toString()] = template;
            if (template.creature_Id) {
                templateByTypeMap[template.creature_Id] = template;
            }
        });

        // Process buildings with enhanced creatures
        const processedBuildings = [];
        
        for (const building of user.buildings) {
            // Find creatures assigned to this building
            const buildingCreatures = user.creatures.filter(
                creature => creature.building_index === building.index
            );
            
            // Process each creature to add full details
            const enhancedCreatures = [];
            
            for (const userCreature of buildingCreatures) {
                let template = null;
                
                // Try to find by creature_id
                if (userCreature.creature_id) {
                    const creatureIdString = userCreature.creature_id.toString();
                    template = templateMap[creatureIdString];
                }
                
                // If not found, try by creature_type
                if (!template && userCreature.creature_type) {
                    template = templateByTypeMap[userCreature.creature_type];
                }
                
                // If still not found, get the first template matching the creature name
                if (!template && userCreature.name) {
                    template = creatureTemplates.find(t => 
                        t.name.toLowerCase() === userCreature.name.toLowerCase() ||
                        t.creature_Id.toLowerCase() === userCreature.name.toLowerCase()
                    );
                }
                
                // If no template found, use first available or continue
                if (!template && creatureTemplates.length > 0) {
                    template = creatureTemplates[0];
                }
                
                if (!template) {
                    // Just add the original data if no template found
                    enhancedCreatures.push(userCreature);
                    continue;
                }
                
                // Get level stats for current level
                const level = userCreature.level || 1;
                const levelStats = template.level_stats.find(stat => stat.level === level) || 
                                  (template.level_stats.length > 0 ? template.level_stats[0] : null);
                
                // Create enhanced creature data with full details
                const enhancedCreature = {
                    _id: userCreature._id,
                    creature_id: userCreature.creature_id || template._id,
                    creature_type: userCreature.creature_type || template.creature_Id,
                    name: template.name,
                    type: template.type,
                    level: level,
                    building_index: userCreature.building_index,
                    base_attack: template.base_attack,
                    base_health: template.base_health,
                    attack: levelStats ? levelStats.attack : template.base_attack,
                    health: levelStats ? levelStats.health : template.base_health,
                    gold_coins: levelStats ? levelStats.gold : template.gold_coins,
                    arcane_energy: levelStats ? levelStats.arcane_energy : template.arcane_energy,
                    speed: template.speed,
                    armor: template.armor,
                    critical_damage_percentage: template.critical_damage_percentage,
                    critical_damage: template.critical_damage,
                    image: template.image,
                    description: template.description,
                    count: userCreature.count || 1
                };
                
                enhancedCreatures.push(enhancedCreature);
            }
            
            // Create processed building with enhanced creatures
            processedBuildings.push({
                _id: building._id,
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                size: building.size,
                index: building.index,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected,
                creature_ids: enhancedCreatures.map(c => c._id),
                creatures: enhancedCreatures
            });
        }
        
        return { buildings: processedBuildings };
    } catch (error) {
        console.error('Error in getUserBuildings:', error);
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

// Update battle selected creatures for a user
async function updateBattleSelectedCreatures(userIdParam, addCreatures = [], removeCreatures = []) {
    try {
        console.log(`Updating battle selected creatures for user ${userIdParam}`);
        console.log(`Adding: ${JSON.stringify(addCreatures)}`);
        console.log(`Removing: ${JSON.stringify(removeCreatures)}`);

        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Fix battle_selected_creatures if it's not an array
        if (!Array.isArray(user.battle_selected_creatures)) {
            console.log('Fixing corrupted battle_selected_creatures field');
            user.battle_selected_creatures = [];
            await user.save();
        }

        // Track changes
        let addedCount = 0;
        let removedCount = 0;
        const addedCreatures = [];
        const removedCreatures = [];

        // Handle removing creatures
        if (removeCreatures && removeCreatures.length > 0) {
            for (const creatureId of removeCreatures) {
                console.log(`Trying to remove creature with ID: ${creatureId}`);
                
                // Find the creature in battle_selected_creatures
                const index = user.battle_selected_creatures.findIndex(
                    c => (c.creature_id && c.creature_id.toString() === creatureId.toString())
                );
                
                console.log(`Found creature at index: ${index}`);
                
                if (index !== -1) {
                    const removed = user.battle_selected_creatures.splice(index, 1)[0];
                    removedCount++;
                    console.log(`Removed creature: ${removed.name}`);
                    
                    removedCreatures.push({
                        _id: removed.creature_id,
                        name: removed.name,
                        level: removed.level,
                        position: removed.position
                    });
                } else {
                    console.log(`Creature ${creatureId} not found in battle selection`);
                }
            }
        }

        // Handle adding creatures
        if (addCreatures && addCreatures.length > 0) {
            // Check if we'd exceed the maximum of 6 creatures
            const projectedCount = user.battle_selected_creatures.length + addCreatures.length;
            if (projectedCount > 6) {
                throw new Error(`Cannot exceed maximum of 6 battle creatures (current: ${user.battle_selected_creatures.length}, trying to add: ${addCreatures.length})`);
            }

            for (const creatureId of addCreatures) {
                console.log(`Adding creature with ID: ${creatureId}`);
                
                // Skip if already in battle selection
                if (user.battle_selected_creatures.some(c => 
                    c.creature_id && c.creature_id.toString() === creatureId.toString()
                )) {
                    console.log(`Creature ${creatureId} already in battle selection, skipping`);
                    continue;
                }

                // Find the creature in user's creatures - check both _id and creature_id fields
                const userCreature = user.creatures.find(c => 
                    (c._id && c._id.toString() === creatureId.toString()) || 
                    (c.creature_id && c.creature_id.toString() === creatureId.toString())
                );

                if (!userCreature) {
                    console.warn(`Creature ${creatureId} not found in user's creatures array`);
                    console.log('Available creatures:', JSON.stringify(user.creatures.map(c => ({ 
                        _id: c._id?.toString(), 
                        creature_id: c.creature_id?.toString(),
                        name: c.name
                    }))));
                    continue;
                }
                
                console.log(`Found user creature:`, userCreature);

                // Get the actual creature ID to use for database lookup
                const actualCreatureId = userCreature.creature_id || userCreature._id;
                console.log(`Using creature ID ${actualCreatureId} for lookup`);

                // Get full creature details from database
                let creatureDetails;
                try {
                    creatureDetails = await Creature.findById(actualCreatureId);
                } catch (err) {
                    console.error(`Error looking up creature by ID ${actualCreatureId}:`, err);
                }

                if (!creatureDetails) {
                    console.warn(`Creature ${actualCreatureId} not found in database`);
                    
                    // Try fallback to find by name
                    try {
                        creatureDetails = await Creature.findOne({ 
                            name: { $regex: new RegExp('^' + userCreature.name + '$', 'i') }
                        });
                    } catch (err) {
                        console.error(`Error looking up creature by name ${userCreature.name}:`, err);
                    }

                    if (!creatureDetails) {
                        console.warn(`Could not find creature template for ${userCreature.name}`);
                        continue;
                    }
                    
                    console.log(`Found creature by name: ${creatureDetails.name}`);
                }

                // Calculate attack and health based on level
                let attack = creatureDetails?.base_attack || 40;
                let health = creatureDetails?.base_health || 280;
                let creatureType = creatureDetails?.type || 'common';
                
                // Apply level multipliers based on type
                let attackGrowth = 0.03; // Default 3% growth
                let healthGrowth = 0.03; // Default 3% growth
                
                if (creatureType) {
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
                    }
                }
                
                // Calculate stats with compounding growth
                for (let level = 1; level < (userCreature.level || 1); level++) {
                    attack += Math.round(attack * attackGrowth);
                    health += Math.round(health * healthGrowth);
                }

                // Assign position (next available slot)
                const positions = user.battle_selected_creatures.map(c => c.position);
                let position = 0;
                while (positions.includes(position) && position < 6) {
                    position++;
                }

                // Create the battle creature entry
                const battleCreature = {
                    creature_id: mongoose.Types.ObjectId.isValid(creatureId) ? 
                        new mongoose.Types.ObjectId(creatureId) : creatureId,
                    name: userCreature.name || 'Unknown Creature',
                    level: userCreature.level || 1,
                    type: creatureType,
                    attack: attack,
                    health: health,
                    position: position
                };

                console.log('Created battle creature entry:', battleCreature);

                // Add to battle selection
                user.battle_selected_creatures.push(battleCreature);
                user.markModified('battle_selected_creatures');
                addedCount++;
                addedCreatures.push({
                    _id: creatureId,
                    name: battleCreature.name,
                    level: battleCreature.level,
                    position: battleCreature.position,
                    type: battleCreature.type,
                    attack: battleCreature.attack,
                    health: battleCreature.health
                });
            }
        }

        // Sort by position
        user.battle_selected_creatures.sort((a, b) => a.position - b.position);

        // Save changes
        await user.save();
        console.log('Saved user with updated battle selected creatures');

        return {
            success: true,
            message: `Updated battle selection: added ${addedCount}, removed ${removedCount}`,
            data: {
                battle_selected_creatures: user.battle_selected_creatures.map(c => ({
                    _id: c.creature_id,
                    name: c.name,
                    level: c.level,
                    position: c.position,
                    type: c.type,
                    attack: c.attack,
                    health: c.health
                })),
                added: addedCreatures,
                removed: removedCreatures,
                count: user.battle_selected_creatures.length
            }
        };
    } catch (error) {
        console.error('Error in updateBattleSelectedCreatures:', error);
        return {
            success: false,
            message: `Error updating battle selected creatures: ${error.message}`
        };
    }
}

// Merge two creatures to create a higher level creature
async function mergeCreatures(userIdParam, creatureIds) {
    try {
        console.log(`Merging creatures for user ${userIdParam}`, creatureIds);
        
        // Validate input
        if (!creatureIds || !Array.isArray(creatureIds) || creatureIds.length !== 2) {
            throw new Error('Exactly two creature IDs must be provided for merging');
        }
        
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Initialize creatures array if it doesn't exist
        if (!user.creatures || !Array.isArray(user.creatures)) {
            throw new Error('User has no creatures');
        }

        // Find the two creatures to merge
        const creaturesToMerge = [];
        
        for (const creatureId of creatureIds) {
            // Find creature by _id or creature_id
            const userCreature = user.creatures.find(c => 
                (c._id && c._id.toString() === creatureId.toString()) || 
                (c.creature_id && c.creature_id.toString() === creatureId.toString())
            );

            if (!userCreature) {
                throw new Error(`Creature ${creatureId} not found in user's creatures`);
            }
            
            creaturesToMerge.push(userCreature);
        }
        
        // Check if both creatures have the same name
        if (creaturesToMerge[0].name.toLowerCase() !== creaturesToMerge[1].name.toLowerCase()) {
            throw new Error(`Cannot merge creatures of different types: ${creaturesToMerge[0].name} and ${creaturesToMerge[1].name}`);
        }
        
        // Check if both creatures have the same level
        if (creaturesToMerge[0].level !== creaturesToMerge[1].level) {
            throw new Error(`Cannot merge creatures of different levels: ${creaturesToMerge[0].level} and ${creaturesToMerge[1].level}`);
        }
        
        // Check if the level is valid for merging (only 10, 20, or 30)
        const validMergeLevels = [10, 20, 30];
        const currentLevel = creaturesToMerge[0].level;
        
        if (!validMergeLevels.includes(currentLevel)) {
            throw new Error(`Cannot merge creatures at level ${currentLevel}. Only creatures at levels 10, 20, or 30 can be merged.`);
        }
        
        console.log(`Found creatures to merge:`, creaturesToMerge);
        
        // Get creature template for stats calculation
        let creatureTemplate;
        try {
            creatureTemplate = await Creature.findOne({ 
                name: { $regex: new RegExp('^' + creaturesToMerge[0].name + '$', 'i') }
            });
        } catch (err) {
            console.warn('Error finding creature template:', err);
        }
        
        if (!creatureTemplate) {
            console.warn(`No template found for creature ${creaturesToMerge[0].name}, using base stats from existing creature`);
        }
        
        // Create merged creature with level 11, 21, or 31 based on input level
        const baseCreature = creaturesToMerge[0];
        const newCreatureId = new mongoose.Types.ObjectId();
        const newLevel = currentLevel + 1; // 10->11, 20->21, 30->31
        
        // Calculate new stats with a boost
        const baseAttack = baseCreature.base_attack || creatureTemplate?.base_attack || 45;
        const baseHealth = baseCreature.base_health || creatureTemplate?.base_health || 250;
        
        // Apply level multipliers based on type
        let attackGrowth = 0.03; // Default 3% growth
        let healthGrowth = 0.03; // Default 3% growth
        const creatureType = baseCreature.type || creatureTemplate?.type || 'common';
        
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
        }
        
        // Calculate stats for the new level
        let newAttack = baseAttack;
        let newHealth = baseHealth;
        
        for (let level = 1; level < newLevel; level++) {
            newAttack += Math.round(newAttack * attackGrowth);
            newHealth += Math.round(newHealth * healthGrowth);
        }
        
        // Calculate gold and arcane energy based on type
        let baseGold = baseCreature.gold_coins || creatureTemplate?.gold_coins || 50;
        let baseArcaneEnergy = baseCreature.arcane_energy || creatureTemplate?.arcane_energy;
        
        // If not explicitly set, use defaults based on creature type
        if (!baseArcaneEnergy) {
            switch(creatureType.toLowerCase()) {
                case 'common':
                    baseArcaneEnergy = 99;
                    if (!baseGold) baseGold = 77;
                    break;
                case 'rare':
                    baseArcaneEnergy = 212;
                    if (!baseGold) baseGold = 125;
                    break;
                case 'epic':
                    baseArcaneEnergy = 403;
                    if (!baseGold) baseGold = 415;
                    break;
                case 'legendary':
                    baseArcaneEnergy = 612;
                    if (!baseGold) baseGold = 1001;
                    break;
                case 'elite':
                    baseArcaneEnergy = 843;
                    if (!baseGold) baseGold = 1503;
                    break;
                default:
                    baseArcaneEnergy = 99;
                    if (!baseGold) baseGold = 77;
            }
        }
        
        // Calculate gold and arcane energy with level multiplier
        const levelMultiplier = Math.pow(2, newLevel - 1);
        const goldCoins = baseGold * levelMultiplier;
        const arcaneEnergy = baseArcaneEnergy * levelMultiplier;
        
        // Create merged creature with boosted stats (10% bonus for merging)
        const mergeBonus = 1.1; // 10% bonus
        const mergedCreature = {
            _id: newCreatureId,
            creature_id: newCreatureId,
            name: baseCreature.name,
            level: newLevel,
            type: creatureType,
            building_index: baseCreature.building_index, // Keep in the same building
            base_attack: baseAttack,
            base_health: baseHealth,
            attack: Math.round(newAttack * mergeBonus), // Apply merge bonus
            health: Math.round(newHealth * mergeBonus), // Apply merge bonus
            gold_coins: goldCoins,
            arcane_energy: arcaneEnergy,
            image: baseCreature.image || creatureTemplate?.image || 'dragon.png',
            description: baseCreature.description || creatureTemplate?.description || 'A merged creature with enhanced powers'
        };
        
        console.log('Created merged creature:', mergedCreature);
        
        // Remove the original creatures from user's creatures array
        const originalIds = creatureIds.map(id => id.toString());
        user.creatures = user.creatures.filter(c => {
            const id = (c._id || c.creature_id).toString();
            return !originalIds.includes(id);
        });
        
        // Add the merged creature
        user.creatures.push(mergedCreature);
        
        // Remove the original creatures from battle_selected_creatures if they exist there
        if (user.battle_selected_creatures && Array.isArray(user.battle_selected_creatures)) {
            user.battle_selected_creatures = user.battle_selected_creatures.filter(c => {
                return !originalIds.includes(c.creature_id.toString());
            });
        }
        
        // Save changes
        user.markModified('creatures');
        user.markModified('battle_selected_creatures');
        await user.save();
        
        return {
            success: true,
            message: 'Creatures merged successfully',
            data: {
                mergedCreature: {
                    _id: mergedCreature._id,
                    name: mergedCreature.name,
                    level: mergedCreature.level,
                    type: mergedCreature.type,
                    attack: mergedCreature.attack,
                    health: mergedCreature.health,
                    building_index: mergedCreature.building_index
                },
                removedCreatures: creaturesToMerge.map(c => ({
                    _id: c._id || c.creature_id,
                    name: c.name,
                    level: c.level
                }))
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

// Add a boost to a user
async function addBoostToUser(userIdParam, boostIdParam) {
    try {
        console.log(`Adding boost ${boostIdParam} to user ${userIdParam}`);
        
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Find boost
        let boost;
        if (mongoose.Types.ObjectId.isValid(boostIdParam)) {
            // If it's a valid ObjectId, search by _id
            boost = await Boost.findById(boostIdParam);
        } else {
            // Otherwise, search by boost_id string
            boost = await Boost.findOne({ boost_id: boostIdParam });
        }

        if (!boost) {
            throw new Error(`Boost ${boostIdParam} not found`);
        }

        // Initialize boosts array if it doesn't exist
        if (!user.boosts) {
            user.boosts = [];
        }

        // Check if user already has this boost
        const existingBoostIndex = user.boosts.findIndex(b => 
            (b.boost_id && b.boost_id.toString() === boost._id.toString())
        );

        if (existingBoostIndex !== -1) {
            // User already has this boost, increment count
            user.boosts[existingBoostIndex].count += 1;
            
            // Save user
            user.markModified('boosts');
            await user.save();
            
            // Return the existing boost with updated count
            return {
                success: true,
                message: `Increased ${boost.name} boost count to ${user.boosts[existingBoostIndex].count}`,
                data: {
                    boost: {
                        boost_id: user.boosts[existingBoostIndex].boost_id,
                        boost_name: user.boosts[existingBoostIndex].boost_name,
                        count: user.boosts[existingBoostIndex].count
                    }
                }
            };
        }

        // Add boost to user
        const userBoost = {
            boost_id: boost._id,
            boost_name: boost.name,
            count: 1
        };

        user.boosts.push(userBoost);
        user.markModified('boosts');
        
        // Save user
        await user.save();

        return {
            success: true,
            message: `Successfully added ${boost.name} boost to user`,
            data: {
                boost: {
                    boost_id: userBoost.boost_id,
                    boost_name: userBoost.boost_name,
                    count: userBoost.count
                }
            }
        };
    } catch (error) {
        console.error('Error in addBoostToUser:', error);
        return {
            success: false,
            message: `Error adding boost to user: ${error.message}`
        };
    }
}

// Remove a boost from a user
async function removeBoostFromUser(userIdParam, boostIdParam) {
    try {
        console.log(`Removing boost ${boostIdParam} from user ${userIdParam}`);
        
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            throw new Error('User not found');
        }

        // Check if user has any boosts
        if (!user.boosts || user.boosts.length === 0) {
            throw new Error('User has no boosts');
        }

        // Find the boost to remove
        let boostObjectId;
        if (mongoose.Types.ObjectId.isValid(boostIdParam)) {
            // If it's a valid ObjectId, use it directly
            boostObjectId = boostIdParam;
        } else {
            // Otherwise, look up the boost to get its ObjectId
            const boost = await Boost.findOne({ boost_id: boostIdParam });
            if (!boost) {
                throw new Error(`Boost ${boostIdParam} not found`);
            }
            boostObjectId = boost._id;
        }

        // Find the index of the boost in the user's array
        const boostIndex = user.boosts.findIndex(b => 
            b.boost_id && b.boost_id.toString() === boostObjectId.toString()
        );

        if (boostIndex === -1) {
            throw new Error(`User does not have boost ${boostIdParam}`);
        }

        // Store boost info before potentially removing
        const boost = {
            boost_id: user.boosts[boostIndex].boost_id,
            boost_name: user.boosts[boostIndex].boost_name,
            count: user.boosts[boostIndex].count
        };

        // Decrement count or remove if count reaches 0
        if (user.boosts[boostIndex].count > 1) {
            user.boosts[boostIndex].count -= 1;
            user.markModified('boosts');
            
            // Save user
            await user.save();
            
            return {
                success: true,
                message: `Decreased ${boost.boost_name} boost count to ${user.boosts[boostIndex].count}`,
                data: {
                    boost: {
                        boost_id: user.boosts[boostIndex].boost_id,
                        boost_name: user.boosts[boostIndex].boost_name,
                        count: user.boosts[boostIndex].count
                    }
                }
            };
        } else {
            // Remove the boost if count would reach 0
            user.boosts.splice(boostIndex, 1);
            user.markModified('boosts');
            
            // Save user
            await user.save();
            
            return {
                success: true,
                message: `Successfully removed ${boost.boost_name} boost from user`,
                data: {
                    removed_boost: {
                        boost_id: boost.boost_id,
                        boost_name: boost.boost_name
                    }
                }
            };
        }
    } catch (error) {
        console.error('Error in removeBoostFromUser:', error);
        return {
            success: false,
            message: `Error removing boost from user: ${error.message}`
        };
    }
}

// Add rumble construction area
async function addRumbleConstructionArea(userIdParam, coordinates, timeInMinutes) {
    try {
        const User = require('../models/user');
        
        // Find the user
        const user = await User.findOne({ userId: userIdParam });
        if (!user) {
            throw new Error('User not found');
        }
        
        // Validate inputs
        if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number') {
            throw new Error('Valid coordinates (x, y) are required');
        }
        
        if (!timeInMinutes || typeof timeInMinutes !== 'number' || timeInMinutes <= 0) {
            throw new Error('Valid timeInMinutes (positive number) is required');
        }
        
        // Initialize rumble_construction_area array if it doesn't exist
        if (!user.rumble_construction_area) {
            user.rumble_construction_area = [];
        }
        
        // Check if these coordinates are already in construction
        const existingArea = user.rumble_construction_area.find(
            area => area.x === coordinates.x && area.y === coordinates.y
        );
        
        if (existingArea) {
            throw new Error('This area is already under construction');
        }
        
        // Check if these coordinates are already cleared
        if (user.clear_rumble && user.clear_rumble.some(
            area => area.x === coordinates.x && area.y === coordinates.y
        )) {
            throw new Error('This area is already cleared');
        }
        
        // Calculate finished time (current time + timeInMinutes)
        const currentTime = new Date();
        const finishedTime = new Date(currentTime.getTime() + timeInMinutes * 60000); // convert minutes to milliseconds
        
        // Add to rumble_construction_area array
        user.rumble_construction_area.push({
            x: coordinates.x,
            y: coordinates.y,
            finished_time: finishedTime,
            started_time: currentTime
        });
        
        // Mark the field as modified to ensure it gets saved
        user.markModified('rumble_construction_area');
        
        // Save the user
        await user.save();
        
        return {
            userId: user.userId,
            coordinates: {
                x: coordinates.x,
                y: coordinates.y
            },
            started_time: currentTime,
            finished_time: finishedTime,
            time_in_minutes: timeInMinutes
        };
    } catch (error) {
        console.error('Error adding rumble construction area:', error);
        throw new Error(`Error adding rumble construction area: ${error.message}`);
    }
}

// Check rumble construction area
async function checkRumbleConstructionArea(userIdParam, coordinates) {
    try {
        const User = require('../models/user');
        
        // Find the user
        const user = await User.findOne({ userId: userIdParam });
        if (!user) {
            throw new Error('User not found');
        }
        
        // Validate coordinates
        if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number') {
            throw new Error('Valid coordinates (x, y) are required');
        }
        
        // Initialize arrays if they don't exist
        if (!user.rumble_construction_area) {
            user.rumble_construction_area = [];
        }
        
        if (!user.clear_rumble) {
            user.clear_rumble = [];
        }
        
        // Check if area is already cleared
        if (user.clear_rumble.some(area => area.x === coordinates.x && area.y === coordinates.y)) {
            return {
                userId: user.userId,
                coordinates: {
                    x: coordinates.x,
                    y: coordinates.y
                },
                status: 'cleared',
                message: 'This area is already cleared'
            };
        }
        
        // Find the area in construction
        const areaIndex = user.rumble_construction_area.findIndex(
            area => area.x === coordinates.x && area.y === coordinates.y
        );
        
        // If area not found in construction
        if (areaIndex === -1) {
            return {
                userId: user.userId,
                coordinates: {
                    x: coordinates.x,
                    y: coordinates.y
                },
                status: 'not_started',
                message: 'This area is not under construction'
            };
        }
        
        const area = user.rumble_construction_area[areaIndex];
        const currentTime = new Date();
        
        // Check if construction is complete
        if (currentTime >= area.finished_time) {
            // Move from construction to cleared
            const clearedArea = {
                x: area.x,
                y: area.y,
                construction_started: area.started_time,
                construction_finished: area.finished_time,
                cleared_time: currentTime
            };
            
            // Remove from construction array
            user.rumble_construction_area.splice(areaIndex, 1);
            
            // Add to cleared array
            user.clear_rumble.push(clearedArea);
            
            // Mark fields as modified
            user.markModified('rumble_construction_area');
            user.markModified('clear_rumble');
            
            // Save the user
            await user.save();
            
            return {
                userId: user.userId,
                coordinates: {
                    x: coordinates.x,
                    y: coordinates.y
                },
                status: 'cleared',
                message: 'Construction complete! Area cleared.',
                construction_details: {
                    started_time: area.started_time,
                    finished_time: area.finished_time,
                    cleared_time: currentTime
                }
            };
        } else {
            // Construction still in progress
            const remainingTime = area.finished_time.getTime() - currentTime.getTime();
            const remainingMinutes = Math.ceil(remainingTime / 60000); // convert ms to minutes
            
            return {
                userId: user.userId,
                coordinates: {
                    x: coordinates.x,
                    y: coordinates.y
                },
                status: 'in_progress',
                message: 'Construction still in progress',
                construction_details: {
                    started_time: area.started_time,
                    finished_time: area.finished_time,
                    remaining_minutes: remainingMinutes
                }
            };
        }
    } catch (error) {
        console.error('Error checking rumble construction area:', error);
        throw new Error(`Error checking rumble construction area: ${error.message}`);
    }
}

// Get all rumble construction and cleared areas
async function getUserRumbleAreas(userIdParam) {
    try {
        const User = require('../models/user');
        
        // Find the user
        const user = await User.findOne({ userId: userIdParam });
        if (!user) {
            throw new Error('User not found');
        }
        
        // Initialize arrays if they don't exist
        if (!user.rumble_construction_area) {
            user.rumble_construction_area = [];
        }
        
        if (!user.clear_rumble) {
            user.clear_rumble = [];
        }
        
        // Process construction areas to add remaining time
        const currentTime = new Date();
        const constructionAreas = user.rumble_construction_area.map(area => {
            const remainingTime = area.finished_time.getTime() - currentTime.getTime();
            const remainingMinutes = Math.ceil(remainingTime / 60000); // convert ms to minutes
            
            return {
                x: area.x,
                y: area.y,
                started_time: area.started_time,
                finished_time: area.finished_time,
                remaining_minutes: remainingMinutes > 0 ? remainingMinutes : 0,
                status: remainingMinutes > 0 ? 'in_progress' : 'ready_to_clear'
            };
        });
        
        // Return both construction and cleared areas
        return {
            userId: user.userId,
            construction_areas: constructionAreas,
            cleared_areas: user.clear_rumble
        };
    } catch (error) {
        console.error('Error getting rumble areas:', error);
        throw new Error(`Error getting rumble areas: ${error.message}`);
    }
}

const clearRumbleConstructionArea = async (userIdParam, x, y) => {
    try {
        const User = require('../models/user');
        
        // Find the user by userId first
        let user = await User.findOne({ userId: userIdParam });
        
        // If not found, try to find by MongoDB _id (if it's a valid ObjectId)
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        
        if (!user) {
            throw new Error('User not found');
        }

        // Initialize arrays if not present
        if (!user.rumble_construction_area) {
            user.rumble_construction_area = [];
        }
        if (!user.clear_rumble) {
            user.clear_rumble = [];
        }

        // Check if the coordinates match any construction area
        const areaIndex = user.rumble_construction_area.findIndex(
            area => area.x === x && area.y === y
        );

        if (areaIndex === -1) {
            throw new Error('No construction area found at these coordinates or construction area is already cleared');
        }

        const area = user.rumble_construction_area[areaIndex];
        
        // Calculate if the construction is complete
        const constructionTime = new Date(area.started_time);
        const finishedTime = new Date(area.finished_time);
        const currentTime = new Date();
        
        // Check if current time is before the finished time
        if (currentTime < finishedTime) {
            // Calculate remaining time in minutes
            const remainingMilliseconds = finishedTime - currentTime;
            const remainingMinutes = Math.ceil(remainingMilliseconds / (1000 * 60));
            const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
            
            throw new Error(`Construction not yet complete. ${remainingMinutes} minutes and ${remainingSeconds % 60} seconds remaining.`);
        }

        // If construction is complete, remove from construction array and add to cleared array
        const clearedArea = {
            x: area.x,
            y: area.y,
            cleared_at: new Date()
        };

        // Remove from construction array
        user.rumble_construction_area.splice(areaIndex, 1);
        
        // Add to cleared array
        user.clear_rumble.push(clearedArea);

        // Save the updated user
        await user.save();

        return {
            userId: user.userId,
            area: clearedArea,
            message: 'Construction area cleared successfully'
        };
    } catch (error) {
        console.error('Error clearing rumble construction area:', error);
        throw error;
    }
};

// Export the functions
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
    updateReserveCoins,
    updateBattleSelectedCreatures,
    mergeCreatures,
    addBoostToUser,
    removeBoostFromUser,
    addRumbleConstructionArea,
    checkRumbleConstructionArea,
    getUserRumbleAreas,
    clearRumbleConstructionArea
};
