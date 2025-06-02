const User = require('../models/user');
const Building = require('../models/building');
const Creature = require('../models/creature');
const mongoose = require('mongoose');
const Boost = require('../models/boost');
const BuildingDecoration = require('../models/buildingDecoration');
const questService = require('./questService');

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
            if (template.creature_type) {
                templateByTypeMap[template.creature_type] = template;
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
                
                // If still not found by creature_type, try direct lookup
                if (!template) {
                    console.log(`Looking up creature by creature_type: ${userCreature.creature_type}`);
                    template = creatureTemplates.find(t => t.creature_type === userCreature.creature_type);
                }
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
                creature_type: userCreature.creature_type || template.creature_type || 'Draconic',
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
        
        let user = await User.findOne({ userId }).populate({
            path: 'creatures.creature_id',
            model: 'Creature'
        });
        
        if (!user) throw new Error('User not found');
        
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found');
        
        // Get the current time
        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        
        // Calculate time difference in minutes
        const timeDifferenceMinutes = (currentTime - lastCollectionTime) / (1000 * 60);
        
        console.log(`Time details: Current time: ${currentTime}, Last collection: ${lastCollectionTime}`);
        console.log(`Time difference in minutes: ${timeDifferenceMinutes.toFixed(2)}`);
        
        // Check if there are creatures in this building
        const buildingCreatures = user.creatures.filter(c => c.building_index === buildingIndex && c.creature_id);
        
        console.log(`Found ${buildingCreatures.length} creatures in building ${buildingIndex}`);
        
        let totalGoldGenerated = 0;
        let generationDetails = [];

        if (buildingCreatures && buildingCreatures.length > 0) {
            // Calculate coins using time-proportional logic with max cap
            for (const creatureData of buildingCreatures) {
                if (!creatureData.creature_id && !creatureData.creature_type && !creatureData.name) {
                    console.log(`Creature lacks identification properties`);
                    continue;
                }
                
                console.log(`Processing creature ID: ${creatureData.creature_id}, name: ${creatureData.name || 'unknown'}, type: ${creatureData.creature_type || 'unknown'}`);
                
                // Try to get creature data - either directly or by lookup
                let creature = null;
                
                // First try by ID if it exists
                if (creatureData.creature_id) {
                    creature = await Creature.findById(creatureData.creature_id);
                }
                
                // If ID lookup failed, try by creature_type
                if (!creature && creatureData.creature_type) {
                    console.log(`Looking up creature by creature_type: ${creatureData.creature_type}`);
                    creature = await Creature.findOne({ creature_type: creatureData.creature_type });
                }
                
                // If still not found, try by name
                if (!creature && creatureData.name) {
                    console.log(`Looking up creature by name: ${creatureData.name}`);
                    creature = await Creature.findOne({ 
                        name: { $regex: new RegExp('^' + creatureData.name + '$', 'i') }
                    });
                }
                
                if (!creature) {
                    console.log(`Could not find creature with ID: ${creatureData.creature_id}, name: ${creatureData.name}, type: ${creatureData.creature_type}`);
                    continue;
                }
                
                console.log(`Creature details: Name: ${creature.name}, Gold: ${creature.gold_coins}, Interval: ${creature.interval_time || 60} min`);
                
                // Get creature count
                const count = creatureData.count || 1;
                
                // Get interval time in minutes (default to 60 if not set)
                const intervalMinutes = creature.interval_time || 60;
                
                // Calculate collection percentage (capped at 100%)
                const percentageComplete = Math.min(1, timeDifferenceMinutes / intervalMinutes);
                
                // Calculate gold generated (capped at max gold per interval)
                const maxGoldPerInterval = creature.gold_coins;
                const creatureGold = maxGoldPerInterval * percentageComplete * count;
                
                console.log(`Collection percentage: ${(percentageComplete * 100).toFixed(2)}% of interval`);
                console.log(`Gold calculation: ${maxGoldPerInterval} max gold × ${percentageComplete.toFixed(4)} completion × ${count} count = ${creatureGold.toFixed(2)} gold`);
                
                generationDetails.push({
                    creature_name: creature.name,
                    count: count,
                    interval_minutes: intervalMinutes,
                    gold_per_interval: maxGoldPerInterval,
                    percentage_complete: (percentageComplete * 100).toFixed(2) + '%',
                    gold_generated: creatureGold.toFixed(2),
                    max_gold: (maxGoldPerInterval * count).toFixed(2)
                });
                
                totalGoldGenerated += creatureGold;
            }
        } else {
            // No creatures, use building's default generation with max cap
            const generationInterval = building.generation_interval || 60;
            
            // Calculate collection percentage (capped at 100%)
            const percentageComplete = Math.min(1, timeDifferenceMinutes / generationInterval);
            
            // Calculate gold based on percentage of interval completed
            const maxGoldPerInterval = building.gold_coins;
            const baseGold = maxGoldPerInterval * percentageComplete;
            totalGoldGenerated = baseGold;
            
            console.log(`Collection percentage: ${(percentageComplete * 100).toFixed(2)}% of interval`);
            console.log(`Gold calculation: ${maxGoldPerInterval} max gold × ${percentageComplete.toFixed(4)} completion = ${baseGold.toFixed(2)} gold`);
            
            generationDetails.push({
                source: "building",
                interval_minutes: generationInterval,
                gold_per_interval: maxGoldPerInterval,
                percentage_complete: (percentageComplete * 100).toFixed(2) + '%',
                gold_generated: baseGold.toFixed(2),
                max_gold: maxGoldPerInterval.toFixed(2)
            });
        }
        
        // Apply boost (only to the actual generated amount, not exceeding max)
        const boostMultiplier = parseFloat(boost) / 100 || 0;
        const boostedAmount = totalGoldGenerated * boostMultiplier;
        const finalAmountGenerated = totalGoldGenerated + boostedAmount;
        
        console.log(`Base coins: ${totalGoldGenerated.toFixed(2)}`);
        console.log(`Boost: ${boost}% = +${boostedAmount.toFixed(2)} coins`);
        console.log(`Total generated: ${finalAmountGenerated.toFixed(2)} coins`);
        
        // Get current reserve coins (ensure it's a number)
        let currentReserve = 0;
        if (building.reserveCoins !== undefined && building.reserveCoins !== null) {
            currentReserve = typeof building.reserveCoins === 'string' ? 
                parseFloat(building.reserveCoins) : building.reserveCoins;
        }
        
        // Add to reserve
        const newReserve = currentReserve + finalAmountGenerated;
        
        console.log(`Current reserve: ${currentReserve.toFixed(2)}`);
        console.log(`Adding ${finalAmountGenerated.toFixed(2)} to reserve`);
        console.log(`New reserve: ${newReserve.toFixed(2)}`);
        
        // Update the building
        building.reserveCoins = newReserve;
        building.last_collected = currentTime;
        
        // Save user document
        await user.save();
        
        return {
            buildingId: building.buildingId,
            index: building.index,
            currentReserve: newReserve.toFixed(2),
            addedReserve: finalAmountGenerated.toFixed(2),
            baseAmount: totalGoldGenerated.toFixed(2),
            boostAmount: boostedAmount.toFixed(2),
            boost: boost,
            generationDetails: generationDetails
        };
    } catch (error) {
        console.error(`Error in updateReserveCoins:`, error);
        throw error;
    }
}

// Create a new function to collect reserveCoins
async function collectReserveCoins(userId, buildingIndex, boost = 0) {
    try {
        console.log(`collectReserveCoins called for user ${userId}, building ${buildingIndex}, boost ${boost}`);
        
        let user = await User.findOne({ userId }).populate({
            path: 'creatures.creature_id',
            model: 'Creature'
        });
        
        if (!user) throw new Error('User not found');
        
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found');
        
        // Calculate time difference in minutes
        const currentTime = new Date();
        const lastCollectionTime = building.last_collected || user.logout_time;
        const timeDifferenceMinutes = (currentTime - lastCollectionTime) / (1000 * 60); // minutes
        
        console.log(`Time details: Current time: ${currentTime}, Last collection: ${lastCollectionTime}`);
        console.log(`Time difference in minutes: ${timeDifferenceMinutes.toFixed(2)}`);
        
        const baseGoldRate = building.gold_coins || 0;
        let goldGenerated = 0;
        let collectionDetails = [];
        
        // Check for creatures in this building
        const buildingCreatures = user.creatures.filter(c => c.building_index === buildingIndex);
        
        if (buildingCreatures && buildingCreatures.length > 0) {
            // Process creatures using capped max logic
            console.log(`Found ${buildingCreatures.length} creatures in building ${buildingIndex}:`);
            
            for (const creatureEntry of buildingCreatures) {
                // Debug logging for creature
                console.log(`Processing creature: ${creatureEntry.name || 'unknown name'}, ID: ${creatureEntry.creature_id}`);
                
                // Try to get creature data - either directly or by lookup
                let creature = null;
                
                // First try by ID if it exists
                if (creatureEntry.creature_id) {
                    creature = await Creature.findById(creatureEntry.creature_id);
                }
                
                // If ID lookup failed, try by creature_type (which should match creature_Id)
                if (!creature && creatureEntry.creature_type) {
                    console.log(`Looking up creature by creature_type: ${creatureEntry.creature_type}`);
                    creature = await Creature.findOne({ creature_Id: creatureEntry.creature_type });
                }
                
                // If still not found, try by name
                if (!creature && creatureEntry.name) {
                    console.log(`Looking up creature by name: ${creatureEntry.name}`);
                    creature = await Creature.findOne({ 
                        name: { $regex: new RegExp('^' + creatureEntry.name + '$', 'i') }
                    });
                }
                
                if (!creature) {
                    console.log(`Could not find creature with ID: ${creatureEntry.creature_id}, name: ${creatureEntry.name}, type: ${creatureEntry.creature_type}`);
                    continue;
                }
                
                console.log(`Creature details: Name: ${creature.name}, Gold: ${creature.gold_coins}, Interval: ${creature.interval_time || 60} min`);
                
                const count = creatureEntry.count || 1;
                const intervalMinutes = creature.interval_time || 60;
                
                // Calculate collection percentage (capped at 100%)
                const percentageComplete = Math.min(1, timeDifferenceMinutes / intervalMinutes);
                
                // Calculate gold generated (capped at max gold per interval)
                const maxGoldPerInterval = creature.gold_coins;
                const creatureGold = maxGoldPerInterval * percentageComplete * count;
                
                console.log(`Collection percentage: ${(percentageComplete * 100).toFixed(2)}% of interval`);
                console.log(`Gold calculation: ${maxGoldPerInterval} max gold × ${percentageComplete.toFixed(4)} completion × ${count} count = ${creatureGold.toFixed(2)} gold`);
                
                collectionDetails.push({
                    creature_name: creature.name,
                    creature_type: creature.creature_type,
                    count: count,
                    interval_minutes: intervalMinutes,
                    gold_per_interval: maxGoldPerInterval,
                    percentage_complete: (percentageComplete * 100).toFixed(2) + '%',
                    gold_generated: creatureGold.toFixed(2),
                    max_gold: (maxGoldPerInterval * count).toFixed(2)
                });
                
                goldGenerated += creatureGold;
            }
            
            console.log(`Found ${buildingCreatures.length} creatures, generated ${goldGenerated.toFixed(2)} gold`);
        } else {
            // No creatures, use building's default generation
            const generationInterval = building.generation_interval || 60;
            
            // Calculate collection percentage (capped at 100%)
            const percentageComplete = Math.min(1, timeDifferenceMinutes / generationInterval);
            
            // Calculate gold based on percentage of interval completed
            const maxGoldPerInterval = baseGoldRate;
            const baseGold = maxGoldPerInterval * percentageComplete;
            goldGenerated = baseGold;
            
            console.log(`Collection percentage: ${(percentageComplete * 100).toFixed(2)}% of interval`);
            console.log(`Gold calculation: ${maxGoldPerInterval} max gold × ${percentageComplete.toFixed(4)} completion = ${baseGold.toFixed(2)} gold`);
            
            collectionDetails.push({
                source: "building",
                interval_minutes: generationInterval,
                gold_per_interval: maxGoldPerInterval,
                percentage_complete: (percentageComplete * 100).toFixed(2) + '%',
                gold_generated: baseGold.toFixed(2),
                max_gold: maxGoldPerInterval.toFixed(2)
            });
            
            console.log(`No creatures found, using building generation: ${goldGenerated.toFixed(2)} gold`);
        }
        
        // Get current reserve coins (ensure it's a number)
        let reserveCoins = 0;
        if (building.reserveCoins !== undefined && building.reserveCoins !== null) {
            reserveCoins = typeof building.reserveCoins === 'string' ? 
                parseFloat(building.reserveCoins) : building.reserveCoins;
        }
        
        // Total to collect (time-based + reserve)
        const totalToCollect = goldGenerated + reserveCoins;
        
        console.log(`Total collection: ${goldGenerated.toFixed(2)} time-based + ${reserveCoins.toFixed(2)} reserve = ${totalToCollect.toFixed(2)} total`);
        
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
            
            // Update quest progress
            try {
                // Import quest service
                const questService = require('./questService');
                
                // Track gold collection for quests
                await questService.trackQuestProgress(userId, 'collect_gold', { 
                    amount: totalToCollect,
                    source: 'building',
                    building_id: building.buildingId
                });
            } catch (questError) {
                console.error('Error updating quest progress for gold collection:', questError);
                // Continue with response even if quest update fails
            }
            
            console.log(`Collected ${totalToCollect.toFixed(2)} coins (${goldGenerated.toFixed(2)} time-based + ${reserveCoins.toFixed(2)} reserve)`);
            console.log(`User now has ${user.gold_coins.toFixed(2)} coins`);
            
            return {
                buildingId: building.buildingId,
                name: building.name,
                index: building.index,
                previousGold: previousGold,
                baseGoldAmount: goldGenerated.toFixed(2),
                reserveCoins: reserveCoins.toFixed(2),
                addedGold: totalToCollect.toFixed(2),
                totalGold: user.gold_coins.toFixed(2),
                last_collected: currentTime,
                collection_details: collectionDetails
            };
        } else {
            console.log(`No coins to collect. Total was ${totalToCollect.toFixed(2)}`);
            
            return {
                buildingId: building.buildingId,
                name: building.name,
                index: building.index,
                previousGold: user.gold_coins,
                baseGoldAmount: "0.00",
                reserveCoins: reserveCoins.toFixed(2),
                addedGold: "0.00",
                totalGold: user.gold_coins.toFixed(2),
                last_collected: building.last_collected,
                collection_details: collectionDetails
            };
        }
    } catch (error) {
        console.error(`Error in collectReserveCoins:`, error);
        throw error;
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
        
        // Calculate time difference in minutes
        const timeDifferenceMinutes = (currentTime - lastCollectionTime) / (1000 * 60);
        
        console.log(`Time details: Current time: ${currentTime}, Last collection: ${lastCollectionTime}`);
        console.log(`Time difference in minutes: ${timeDifferenceMinutes.toFixed(2)}`);
        
        const baseGoldRate = building.gold_coins || 0;
        let goldGenerated = 0;
        let collectionDetails = [];
        
        // Check for creatures in this building
        const buildingCreatures = user.creatures.filter(c => c.building_index === buildingIndex);
        
        console.log(`Found ${buildingCreatures.length} creatures in building ${buildingIndex}`);
        
        if (buildingCreatures && buildingCreatures.length > 0) {
            // Process creatures using capped max logic
            for (const creatureEntry of buildingCreatures) {
                console.log(`Processing creature ID: ${creatureEntry.creature_id}, name: ${creatureEntry.name || 'unknown'}, type: ${creatureEntry.creature_type || 'unknown'}`);
                
                // Try to get creature data - either directly or by lookup
                let creature = null;
                
                // First try by ID if it exists
                if (creatureEntry.creature_id) {
                    creature = await Creature.findById(creatureEntry.creature_id);
                }
                
                // If ID lookup failed, try by creature_type (which should match creature_Id)
                if (!creature && creatureEntry.creature_type) {
                    console.log(`Looking up creature by creature_type: ${creatureEntry.creature_type}`);
                    creature = await Creature.findOne({ creature_Id: creatureEntry.creature_type });
                }
                
                // If still not found, try by name
                if (!creature && creatureEntry.name) {
                    console.log(`Looking up creature by name: ${creatureEntry.name}`);
                    creature = await Creature.findOne({ 
                        name: { $regex: new RegExp('^' + creatureEntry.name + '$', 'i') }
                    });
                }
                
                if (!creature) {
                    console.log(`Could not find creature with ID: ${creatureEntry.creature_id}, name: ${creatureEntry.name}, type: ${creatureEntry.creature_type}`);
                    continue;
                }
                
                console.log(`Creature details: Name: ${creature.name}, Gold: ${creature.gold_coins}, Interval: ${creature.interval_time || 60} min`);
                
                const count = creatureEntry.count || 1;
                const intervalMinutes = creature.interval_time || 60;
                
                // Calculate collection percentage (capped at 100%)
                const percentageComplete = Math.min(1, timeDifferenceMinutes / intervalMinutes);
                
                // Calculate gold generated (capped at max gold per interval)
                const maxGoldPerInterval = creature.gold_coins;
                const creatureGoldGenerated = maxGoldPerInterval * percentageComplete * count;
                
                console.log(`Collection percentage: ${(percentageComplete * 100).toFixed(2)}% of interval`);
                console.log(`Gold calculation: ${maxGoldPerInterval} max gold × ${percentageComplete.toFixed(4)} completion × ${count} count = ${creatureGoldGenerated.toFixed(2)} gold`);
                
                collectionDetails.push({
                    creature_name: creature.name,
                    creature_type: creature.creature_type,
                    count: count,
                    interval_minutes: intervalMinutes,
                    gold_per_interval: maxGoldPerInterval,
                    percentage_complete: (percentageComplete * 100).toFixed(2) + '%',
                    gold_generated: creatureGoldGenerated.toFixed(2),
                    max_gold: (maxGoldPerInterval * count).toFixed(2)
                });
                
                goldGenerated += creatureGoldGenerated;
            }
            
            console.log(`Generated ${goldGenerated.toFixed(2)} gold from creatures`);
        } else {
            // No creatures, use building's default generation
            const generationInterval = building.generation_interval || 60;
            
            // Calculate collection percentage (capped at 100%)
            const percentageComplete = Math.min(1, timeDifferenceMinutes / generationInterval);
            
            // Calculate gold based on percentage of interval completed
            const maxGoldPerInterval = baseGoldRate;
            const buildingGoldGenerated = maxGoldPerInterval * percentageComplete;
            goldGenerated = buildingGoldGenerated;
            
            console.log(`Collection percentage: ${(percentageComplete * 100).toFixed(2)}% of interval`);
            console.log(`Gold calculation: ${maxGoldPerInterval} max gold × ${percentageComplete.toFixed(4)} completion = ${buildingGoldGenerated.toFixed(2)} gold`);
            
            collectionDetails.push({
                source: "building",
                interval_minutes: generationInterval,
                gold_per_interval: maxGoldPerInterval,
                percentage_complete: (percentageComplete * 100).toFixed(2) + '%',
                gold_generated: buildingGoldGenerated.toFixed(2),
                max_gold: maxGoldPerInterval.toFixed(2)
            });
        }
        
        // Make sure reserveCoins is a number (default to 0 if undefined/null)
        const reserveCoins = parseFloat(building.reserveCoins || 0);
        
        // Total gold to add is base generation plus reserve
        const addedGold = goldGenerated + reserveCoins;
        
        console.log(`Total collection: ${goldGenerated.toFixed(2)} time-based + ${reserveCoins.toFixed(2)} reserve = ${addedGold.toFixed(2)} total`);
        
        // Only collect if there's something to collect
        if (addedGold > 0) {
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
                baseGoldAmount: goldGenerated.toFixed(2),
                reserveCoins: reserveCoins.toFixed(2),
                addedGold: addedGold.toFixed(2),
                buildingIndex,
                buildingId: building.buildingId,
                name: building.name,
                baseGoldRate: baseGoldRate,
                timeSinceLastCollection: Math.floor(timeDifferenceMinutes) + ' minutes',
                last_collected: currentTime,
                collection_details: collectionDetails
            };
        } else {
            console.log(`No coins to collect. Total was ${addedGold.toFixed(2)}`);
            
            return {
                success: true,
                message: 'No coins to collect',
                totalCoins: user.gold_coins.toFixed(2),
                baseGoldAmount: "0.00",
                reserveCoins: "0.00",
                addedGold: "0.00",
                buildingIndex,
                buildingId: building.buildingId,
                name: building.name,
                baseGoldRate: baseGoldRate,
                timeSinceLastCollection: Math.floor(timeDifferenceMinutes) + ' minutes',
                last_collected: currentTime,
                collection_details: collectionDetails
            };
        }
    } catch (error) {
        console.error(`Error collecting building coins:`, error);
        throw new Error(`Error collecting building coins: ${error.message}`);
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

        // Create new building object with all required fields
        const newBuilding = {
            buildingId: buildingTemplate.buildingId,
            name: buildingTemplate.name,
            cost: buildingTemplate.cost,
            gold_coins: buildingTemplate.gold_coins,
            generation_interval: buildingTemplate.generation_interval || 60, // Default 60 minutes if not specified
            position: position,
            size: buildingTemplate.size,
            index: randomIndex,
            unlockLevel: buildingTemplate.unlockLevel,
            description: buildingTemplate.description || `${buildingTemplate.name} Building`,
            image: buildingTemplate.image,
            reserveCoins: 0,
            last_collected: new Date()
        };
        console.log('Created new building object:', newBuilding);

        // Check if the building has construction time
        const constructionTime = buildingTemplate.constructionTime || 0;
        console.log('Building construction time (minutes):', constructionTime);
        
        let response = {
            success: true,
            message: "",
            data: {
                user: {
                    userId: user.userId,
                    user_name: user.user_name
                },
                building: newBuilding
            }
        };
        
        // If construction time is set, add to building_construction array
        if (constructionTime > 0) {
            // Calculate start and finish times
            const currentTime = new Date();
            const finishTime = new Date(currentTime.getTime() + (constructionTime * 60000)); // convert minutes to milliseconds
            
            // Create construction building object with all required fields
            const constructionBuilding = {
                ...newBuilding,
                started_time: currentTime,
                finished_time: finishTime
            };
            
            // Initialize the building_construction array if it doesn't exist
            if (!user.building_construction) {
                user.building_construction = [];
            }
            
            // Add to construction array
            user.building_construction.push(constructionBuilding);
            
            // Update response with construction details
            response.message = `Building construction started. Will be completed in ${constructionTime} minutes.`;
            response.data.constructionDetails = {
                started_time: currentTime,
                finished_time: finishTime,
                remaining_minutes: constructionTime
            };
            
            console.log('Building added to construction queue, will complete at:', finishTime);
        } else {
            // No construction time, add directly to buildings array
            user.buildings.push(newBuilding);
            response.message = "Building assigned to user successfully";
            console.log('Building assigned directly to user');
        }

        // If creatureIdParam is provided, handle creature assignment
        if (creatureIdParam) {
            console.log('Creature ID provided:', creatureIdParam);
            
            // Find creature template
            const creatureTemplate = await Creature.findOne({ creature_Id: creatureIdParam });
            console.log('Creature template search result:', creatureTemplate ? 'Found' : 'Not found');
            
            if (!creatureTemplate) {
                // Save building but return error about creature
                await user.save();
                console.log('Building saved but creature not found');
                
                // Modify message based on if building is under construction
                if (constructionTime > 0) {
                    return {
                        success: true,
                        message: "Building construction started but creature not found.",
                        data: response.data
                    };
                } else {
                    return {
                        success: true,
                        message: "Building assigned but creature not found",
                        data: response.data
                    };
                }
            }

            // Set creature level to 1 directly using setLevel method
            if (creatureTemplate.setLevel) {
                creatureTemplate.setLevel(1);
                await creatureTemplate.save();
                console.log('Set creature level to 1');
            }
            
            // If building is under construction, we can't add creatures yet
            if (constructionTime > 0) {
                await user.save();
                return {
                    success: true,
                    message: "Building construction started. Creatures can be added once construction is complete.",
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

            // Initialize building.creatures array if it doesn't exist
            if (!newBuilding.creatures) {
                newBuilding.creatures = [];
            }
            
            // Add creature to building's creatures array
            newBuilding.creatures.push(newCreature._id);
            console.log('Added creature to building\'s creatures array:', newCreature._id);

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
        
        // Track quest progress for building placement
        try {
            // Import quest service
            const questService = require('./questService');
            
            // Update quest progress for building placement
            await questService.trackQuestProgress(userIdParam, 'place_building', {
                building_id: buildingTemplate.buildingId,
                building_type: buildingTemplate.type
            });
            
            // If building is directly added (not under construction)
            if (constructionTime <= 0) {
                // Update total buildings count quest
                await questService.trackQuestProgress(userIdParam, 'total_buildings', {
                    amount: user.buildings.length
                });
                
                // If this building has a specific type, update type-specific quests
                if (buildingTemplate.type) {
                    await questService.trackQuestProgress(userIdParam, `place_${buildingTemplate.type}_building`, {
                        amount: 1
                    });
                }
            }
        } catch (questError) {
            console.error('Error updating quest progress for building placement:', questError);
            // Continue with response even if quest update fails
        }
        
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
                description: creatureData.description || (creatureTemplate?.description) || 'A fierce fire-breathing dragon',
                creature_type: creatureTemplate?.creature_type || 'Draconic' // Set proper creature type category
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
            critical_damage: levelStats?.critical_damage || creatureTemplate?.critical_damage || 20,
            interval_time: creatureTemplate?.interval_time || 60,
            unlock_time: creatureTemplate?.unlock_time || 10,
            arcane_energy: creatureTemplate?.arcane_energy
        };

        // If level_stats exist, simplify to only include level, attack and health
        if (creatureTemplate?.level_stats) {
            creatureResponse.level_stats = creatureTemplate.level_stats.map(stat => ({
                level: stat.level,
                attack: stat.attack,
                health: stat.health,
                gold: stat.gold || 0,
                arcane_energy: stat.arcane_energy || 0
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
        
        // Initialize user currency if it doesn't exist
        if (!user.currency) {
            user.currency = { 
                anima: 0,
                arcane_energy: 0,
                gems: 0
            };
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
        let creatureArrayIndex = -1;
        for (let i = 0; i < user.creatures.length; i++) {
            const entry = user.creatures[i];
            if (entry.building_index === buildingIndex) {
                if (entry._id && entry._id.toString() === creatureIdParam) {
                    creatureEntry = entry;
                    creatureArrayIndex = i;
                    break;
                } else if (entry.creature_id && entry.creature_id.toString() === creatureIdParam) {
                    creatureEntry = entry;
                    creatureArrayIndex = i;
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
        
        // Check if trying to update to a milestone level (11, 21, 31)
        if (parsedLevel === 11 || parsedLevel === 21 || parsedLevel === 31) {
            throw new Error(`Cannot update to level ${parsedLevel}. This level can only be achieved by merging two creatures of the previous milestone level.`);
        }
        
        // Check if attempting to upgrade more than one level at a time or downgrade
        if (parsedLevel > previousLevel + 1) {
            throw new Error(`Cannot skip levels. You can only upgrade from level ${previousLevel} to level ${previousLevel + 1}.`);
        }
        
        // Prevent downgrading - ensure new level is higher than previous level
        if (parsedLevel < previousLevel) {
            throw new Error(`Cannot downgrade creature level from ${previousLevel} to ${parsedLevel}.`);
        }
        
        // Only check arcane energy cost if upgrading to a higher level (not initializing or downgrading)
        if (parsedLevel > previousLevel) {
            // Get required arcane energy for this upgrade
            let requiredArcaneEnergy = 0;
            
            // Check if level_stats contains arcane_energy for the current level
            if (creatureTemplate.level_stats && 
                Array.isArray(creatureTemplate.level_stats) && 
                creatureTemplate.level_stats[previousLevel - 1] && 
                creatureTemplate.level_stats[previousLevel - 1].arcane_energy) {
                
                requiredArcaneEnergy = creatureTemplate.level_stats[previousLevel - 1].arcane_energy;
                console.log(`Required arcane energy for upgrading to level ${parsedLevel}: ${requiredArcaneEnergy}`);
            } else {
                // Fallback if level_stats not available - use a basic formula
                requiredArcaneEnergy = (previousLevel * 100) + 50;
                console.log(`Using fallback arcane energy cost: ${requiredArcaneEnergy}`);
            }
            
            // Check if user has enough arcane energy
            if (!user.currency.arcane_energy || user.currency.arcane_energy < requiredArcaneEnergy) {
                throw new Error(`Not enough arcane energy to upgrade. Required: ${requiredArcaneEnergy}, Available: ${user.currency.arcane_energy || 0}`);
            }
            
            // Deduct arcane energy for the upgrade
            user.currency.arcane_energy -= requiredArcaneEnergy;
            user.markModified('currency');
            console.log(`Deducted ${requiredArcaneEnergy} arcane energy. Remaining: ${user.currency.arcane_energy}`);
        }
        
        // Get base stats from creature entry or template
        let baseAttack = creatureEntry.base_attack || creatureTemplate.base_attack;
        let baseHealth = creatureEntry.base_health || creatureTemplate.base_health;
        
        // If base stats are still missing, set defaults
        if (!baseAttack) baseAttack = 10;
        if (!baseHealth) baseHealth = 50;
        
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
        
        // Get gold and arcane energy directly from level_stats array
        let goldCoins = creatureTemplate.gold_coins || 0;
        let arcaneEnergy = creatureTemplate.arcane_energy || 0;
        
        // Check for level stats in creature template
        if (creatureTemplate.level_stats && Array.isArray(creatureTemplate.level_stats)) {
            // Find stats for the specific level
            // Level stats array is 0-indexed (level 1 is at index 0)
            const levelStats = creatureTemplate.level_stats[parsedLevel - 1];
            
            if (levelStats) {
                console.log(`Found level stats for level ${parsedLevel}:`, levelStats);
                
                // Use attack and health from level_stats if available
                if (levelStats.attack) {
                    attack = levelStats.attack;
                }
                
                if (levelStats.health) {
                    health = levelStats.health;
                }
                
                // Use gold from level_stats
                if (levelStats.gold) {
                    goldCoins = levelStats.gold;
                }
                
                // Use arcane_energy from level_stats
                if (levelStats.arcane_energy) {
                    arcaneEnergy = levelStats.arcane_energy;
                    console.log(`Setting arcane energy to ${arcaneEnergy} for level ${parsedLevel}`);
                }
            } else {
                console.log(`No level stats found for level ${parsedLevel}`);
            }
        } else {
            console.log(`No level_stats array found in creature template for ${creatureTemplate.name}`);
        }
        
        // Use direct MongoDB update to update the creature in the creatures array
        console.log(`Updating creature in creatures array at index ${creatureArrayIndex}`);
        console.log(`Setting arcane_energy to ${arcaneEnergy}, attack to ${attack}, health to ${health}, gold_coins to ${goldCoins}, level to ${parsedLevel}`);
        
        // Save the user first to make sure the currency changes are applied
        await user.save();
        
        // Perform a direct MongoDB update on the creature in the creatures array
        const updateResult = await User.updateOne(
            { 
                userId: userIdParam, 
                "creatures._id": new mongoose.Types.ObjectId(creatureEntry._id) 
            },
            { 
                $set: { 
                    "creatures.$.level": parsedLevel,
                    "creatures.$.attack": attack,
                    "creatures.$.health": health,
                    "creatures.$.gold_coins": goldCoins,
                    "creatures.$.arcane_energy": arcaneEnergy
                } 
            }
        );
        
        console.log(`MongoDB update result:`, updateResult);
        
        // Check if the update was successful
        if (updateResult.nModified === 0) {
            console.warn(`Warning: MongoDB update did not modify any documents. This could mean the data didn't change or the query didn't match.`);
        }
        
        console.log(`Updated creature ${creatureEntry.name || creatureEntry.creature_type} from level ${previousLevel} to ${parsedLevel}`);
        console.log(`New stats: Attack ${attack}, Health ${health}, Gold ${goldCoins}, Arcane Energy ${arcaneEnergy}`);

        return {
            success: true,
            message: "Creature level updated successfully",
            data: {
                user: {
                    userId: user.userId,
                    user_name: user.user_name,
                    arcane_energy: user.currency.arcane_energy || 0
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
                    creature_type: userCreature?.creature_type || template?.creature_type || 'Draconic',
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

        // If no buildings and no buildings under construction, return empty array
        if ((!user.buildings || user.buildings.length === 0) && 
            (!user.building_construction || user.building_construction.length === 0)) {
            return { buildings: [], buildings_under_construction: [] };
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
            if (template.creature_type) {
                templateByTypeMap[template.creature_type] = template;
            }
        });

        // Process buildings with enhanced creatures
        const processedBuildings = [];
        
        for (const building of user.buildings || []) {
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
                    
                    // If still not found by creature_type, try direct lookup
                    if (!template) {
                        console.log(`Looking up creature by creature_type: ${userCreature.creature_type}`);
                        template = creatureTemplates.find(t => t.creature_type === userCreature.creature_type);
                    }
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
                    creature_type: userCreature.creature_type || template.creature_type || 'Draconic',
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
                cost: building.cost,
                position: building.position,
                size: building.size,
                index: building.index,
                unlockLevel: building.unlockLevel,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected,
                creature_ids: enhancedCreatures.map(c => c._id),
                creatures: enhancedCreatures
            });
        }
        
        // Process buildings under construction
        const buildingsUnderConstruction = [];
        const currentTime = new Date();
        
        if (user.building_construction && user.building_construction.length > 0) {
            for (const building of user.building_construction) {
                const finishTime = new Date(building.finished_time);
                const remainingTimeMs = finishTime - currentTime;
                const remainingMinutes = Math.max(0, Math.ceil(remainingTimeMs / 60000));
                
                buildingsUnderConstruction.push({
                    buildingId: building.buildingId,
                    name: building.name,
                    cost: building.cost,
                    position: building.position,
                    size: building.size,
                    index: building.index,
                    unlockLevel: building.unlockLevel,
                    gold_coins: building.gold_coins,
                    started_time: building.started_time,
                    finished_time: building.finished_time,
                    remaining_minutes: remainingMinutes,
                    under_construction: true
                });
            }
        }
        
        return { 
            buildings: processedBuildings,
            buildings_under_construction: buildingsUnderConstruction
        };
    } catch (error) {
        console.error('Error in getUserBuildings:', error);
        throw new Error(`Error fetching user buildings: ${error.message}`);
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

        // Debug: Print all user creatures
        console.log('All user creatures:');
        user.creatures.forEach(c => {
            console.log(`- Creature: ${c.name}, _id: ${c._id}, creature_id: ${c.creature_id}, creature_type: ${c.creature_type}`);
        });

        // Debug: Print all battle creatures
        console.log('Current battle creatures:');
        user.battle_selected_creatures.forEach(c => {
            console.log(`- Battle Creature: ${c.name}, creature_id: ${c.creature_id}`);
        });

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
                console.log(`Adding creature with ID: ${creatureId} (type: ${typeof creatureId})`);
                
                // Skip if already in battle selection
                const alreadyInBattle = user.battle_selected_creatures.some(c => {
                    const matchById = c.creature_id && c.creature_id.toString() === creatureId.toString();
                    console.log(`Checking if already in battle: creature_id=${c.creature_id}, match=${matchById}`);
                    return matchById;
                });
                
                if (alreadyInBattle) {
                    console.log(`Creature ${creatureId} already in battle selection, skipping`);
                    continue;
                }

                // Find the creature in user's creatures - check both _id and creature_id fields
                let userCreature = null;
                
                // First try matching by _id (exact match)
                userCreature = user.creatures.find(c => 
                    c._id && c._id.toString() === creatureId.toString()
                );
                
                // If not found, try matching by creature_id
                if (!userCreature) {
                    userCreature = user.creatures.find(c => 
                        c.creature_id && c.creature_id.toString() === creatureId.toString()
                    );
                }

                if (!userCreature) {
                    console.warn(`Creature ${creatureId} not found in user's creatures array`);
                    console.log('Available creatures:', JSON.stringify(user.creatures.map(c => ({ 
                        _id: c._id?.toString(), 
                        creature_id: c.creature_id?.toString(),
                        name: c.name
                    }))));
                    // Force creation of a test creature for debugging
                    console.log("Creating a test creature for debugging purposes");
                    
                    // Try to find the creature directly in the database
                    let dbCreature = null;
                    try {
                        if (mongoose.Types.ObjectId.isValid(creatureId)) {
                            dbCreature = await Creature.findById(creatureId);
                            console.log(`Database creature lookup result: ${dbCreature ? 'Found' : 'Not found'}`);
                        }
                    } catch (err) {
                        console.error(`Error looking up creature in DB: ${err.message}`);
                    }
                    
                    // If we can't find it, use a default creature
                    if (!dbCreature) {
                        userCreature = {
                            _id: new mongoose.Types.ObjectId(creatureId),
                            creature_id: new mongoose.Types.ObjectId(creatureId),
                            name: "Debug Creature",
                            level: 1,
                            creature_type: "unknown",
                            attack: 50,
                            health: 300
                        };
                    } else {
                        userCreature = {
                            _id: dbCreature._id,
                            creature_id: dbCreature._id,
                            name: dbCreature.name,
                            level: 1,
                            creature_type: dbCreature.type || "unknown",
                            attack: dbCreature.base_attack || 50,
                            health: dbCreature.base_health || 300
                        };
                    }
                    console.log(`Created test creature: ${JSON.stringify(userCreature)}`);
                } else {
                    console.log(`Found user creature:`, JSON.stringify(userCreature));
                }

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
                        // Continue anyway, using user creature data
                        creatureDetails = {
                            base_attack: userCreature.attack || userCreature.base_attack || 50,
                            base_health: userCreature.health || userCreature.base_health || 300,
                            type: userCreature.creature_type || 'common'
                        };
                    } else {
                        console.log(`Found creature by name: ${creatureDetails.name}`);
                    }
                }

                // Calculate attack and health based on level
                let attack = creatureDetails?.base_attack || userCreature.attack || 40;
                let health = creatureDetails?.base_health || userCreature.health || 280;
                let creatureType = creatureDetails?.type || userCreature.creature_type || 'common';
                
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
                    creature_id: creatureId,
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

        // Save user changes
        try {
            await user.save();
            console.log('Saved user with updated battle selected creatures');
            console.log('Final battle creatures count:', user.battle_selected_creatures.length);
        } catch (saveError) {
            console.error('Error saving user:', saveError);
            throw saveError;
        }

        // Return success with updated data
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
        
        console.log(`Service addRumbleConstructionArea called with userIdParam: ${userIdParam}`);
        console.log(`Coordinates received:`, JSON.stringify(coordinates));
        console.log(`Time in minutes: ${timeInMinutes}, type: ${typeof timeInMinutes}`);
        
        // Find the user
        const user = await User.findOne({ userId: userIdParam });
        if (!user) {
            console.log(`User not found with userId: ${userIdParam}`);
            throw new Error('User not found');
        }
        
        // Validate inputs
        if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number') {
            console.log(`Invalid coordinates:`, JSON.stringify(coordinates));
            throw new Error('Valid coordinates (x, y) are required');
        }
        
        if (!timeInMinutes || typeof timeInMinutes !== 'number' || timeInMinutes <= 0) {
            console.log(`Invalid timeInMinutes: ${timeInMinutes}`);
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
        // Use exact timeInMinutes parameter, ensure it's not modified
        const exactTimeInMinutes = Number(timeInMinutes); // Ensure it's a number
        const finishedTime = new Date(currentTime.getTime() + exactTimeInMinutes * 60000); // convert minutes to milliseconds
        
        console.log(`Creating rumble construction with exactly ${exactTimeInMinutes} minutes`);
        console.log(`Current time: ${currentTime}`);
        console.log(`Finished time: ${finishedTime}`);
        console.log(`Time difference in minutes: ${(finishedTime - currentTime) / 60000}`);
        
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
            time_in_minutes: exactTimeInMinutes // Return the exact time provided
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
        
        console.log(`Clearing rumble construction area:`);
        console.log(`Start time: ${constructionTime}`);
        console.log(`Finish time: ${finishedTime}`);
        console.log(`Current time: ${currentTime}`);
        
        // Check if current time is before the finished time
        if (currentTime < finishedTime) {
            // Calculate remaining time more accurately
            const remainingMilliseconds = finishedTime - currentTime;
            const remainingMinutes = Math.floor(remainingMilliseconds / (1000 * 60));
            const remainingSeconds = Math.floor((remainingMilliseconds % (1000 * 60)) / 1000);
            
            console.log(`Remaining time: ${remainingMilliseconds}ms (${remainingMinutes}m ${remainingSeconds}s)`);
            
            throw new Error(`Construction not yet complete. ${remainingMinutes} minutes and ${remainingSeconds} seconds remaining.`);
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

// Check building construction status and move completed buildings to user buildings array
async function checkBuildingConstructionStatus(userIdParam) {
    try {
        console.log('Checking building construction status for user:', userIdParam);
        
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            return { success: false, message: "User not found" };
        }
        
        // If no buildings under construction, return early
        if (!user.building_construction || user.building_construction.length === 0) {
            return { 
                success: true, 
                message: "No buildings under construction", 
                data: { 
                    buildings_under_construction: [], 
                    completed_buildings: [] 
                } 
            };
        }
        
        const currentTime = new Date();
        const completedBuildings = [];
        const remainingBuildings = [];
        
        // Process each building under construction
        for (const building of user.building_construction) {
            // Check if building data is complete
            if (!building.buildingId || !building.finished_time) {
                console.warn(`Skipping incomplete building construction record: ${building._id}`);
                continue;
            }
            
            const finishTime = new Date(building.finished_time);
            
            // Check if construction is completed
            if (currentTime >= finishTime) {
                console.log(`Building ${building.name} (${building.index}) construction completed`);
                
                // Add building to user's buildings array
                const completedBuilding = {
                    buildingId: building.buildingId,
                    name: building.name,
                    cost: building.cost,
                    gold_coins: building.gold_coins,
                    generation_interval: building.generation_interval,
                    position: building.position,
                    size: building.size,
                    index: building.index,
                    unlockLevel: building.unlockLevel,
                    reserveCoins: 0,
                    last_collected: new Date()
                };
                
                user.buildings.push(completedBuilding);
                completedBuildings.push({
                    ...completedBuilding,
                    construction_completed: true
                });
            } else {
                // Building still under construction
                const remainingTimeMs = finishTime - currentTime;
                const remainingMinutes = Math.ceil(remainingTimeMs / 60000);
                
                remainingBuildings.push({
                    ...building.toObject(),
                    remaining_minutes: remainingMinutes,
                    construction_completed: false
                });
            }
        }
        
        // Filter out incomplete building data
        const validRemainingBuildings = remainingBuildings.filter(b => 
            b.buildingId && b.name && b.position && b.size && b.index);
        
        // If we found and processed any buildings, update the user
        if (completedBuildings.length > 0 || validRemainingBuildings.length < user.building_construction.length) {
            // Update building_construction to remove completed buildings and any invalid entries
            user.building_construction = validRemainingBuildings.map(b => ({
                buildingId: b.buildingId,
                name: b.name,
                cost: b.cost,
                gold_coins: b.gold_coins,
                position: b.position,
                size: b.size,
                index: b.index,
                unlockLevel: b.unlockLevel,
                started_time: b.started_time,
                finished_time: b.finished_time
            }));
            
            // Save user changes
            await user.save();
            
            console.log(`Updated user: removed ${completedBuildings.length} completed buildings and fixed invalid entries`);
        }
        
        // Prepare response
        const message = completedBuildings.length > 0 
            ? `${completedBuildings.length} buildings completed and moved to user buildings` 
            : "No buildings completed yet";
            
        return {
            success: true,
            message: message,
            data: {
                buildings_under_construction: validRemainingBuildings,
                completed_buildings: completedBuildings
            }
        };
    } catch (error) {
        console.error('Error in checkBuildingConstructionStatus:', error);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
}

/**
 * Helper function to process user data before returning in response
 * @param {Object} user - The user object to process
 * @returns {Object} - Processed user object with simplified fields
 */
function processUserResponse(user) {
    // Convert to regular object if it's a mongoose document
    const userObj = user.toObject ? user.toObject() : {...user};
    
    // Simplify card stats - only keep total_packs_opened
    if (userObj.card_stats) {
        // Extract total packs opened as a direct property of the user
        userObj.total_packs_opened = userObj.card_stats.total_packs_opened || 0;
        
        // Delete the full card_stats object
        delete userObj.card_stats;
    }
    
    // Remove last_opened_packs field
    if (userObj.last_opened_packs) {
        delete userObj.last_opened_packs;
    }

    // Format battlePassSummary.claimed_rewards into separate free and elite arrays
    if (userObj.battlePassSummary && Array.isArray(userObj.battlePassSummary.claimed_rewards)) {
        const claimedRewards = userObj.battlePassSummary.claimed_rewards || [];
        const claimedFreeRewards = claimedRewards.filter(reward => !reward.is_elite);
        const claimedEliteRewards = claimedRewards.filter(reward => reward.is_elite);
        
        // Add formatted claimed_rewards_formatted field for API responses
        userObj.battlePassSummary.claimed_rewards_formatted = {
            free: claimedFreeRewards,
            elite: claimedEliteRewards,
            all: claimedRewards
        };
    }
    
    if (userObj.battlepass_rewards) {
        // Keep the battlepass_rewards field as is
    }
    
    return userObj;
}

/**
 * Assigns a decoration/boost building to a user
 * @param {string} userIdParam - The ID of the user
 * @param {string} decorationId - The ID of the decoration to add
 * @param {object} position - Position coordinates {x, y}
 * @returns {Promise<Object>} - Result of the operation
 */
async function assignDecorationToUser(userIdParam, decorationId, position) {
    try {
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            return { success: false, message: "User not found" };
        }

        // Find decoration template
        const decorationTemplate = await BuildingDecoration.findOne({ decorationId });
        if (!decorationTemplate) {
            return { success: false, message: "Decoration template not found" };
        }

        // Validate position
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return { success: false, message: "Valid position (x, y) is required" };
        }

        // Generate random index for the building
        const randomIndex = Math.floor(1000000000 + Math.random() * 9000000000);

        // Create new decoration object
        const newDecoration = {
            buildingId: decorationTemplate.decorationId,
            name: decorationTemplate.name,
            gold_coins: 0, // Decorations don't generate gold directly
            position: {
                x: position.x,
                y: position.y
            },
            size: {
                x: decorationTemplate.size.x,
                y: decorationTemplate.size.y
            },
            index: randomIndex,
            reserveCoins: 0,
            last_collected: new Date(),
            is_decoration: true, // Flag to identify this as a decoration building
            boostPercent: decorationTemplate.boostPercent,
            creatures: []
        };

        // Check if user has buildings array
        if (!user.buildings) {
            user.buildings = [];
        }

        // Add the decoration to user's buildings
        user.buildings.push(newDecoration);

        // Mark the buildings array as modified
        user.markModified('buildings');

        // Save the user document
        await user.save();

        // Track quest progress for place_decoration action
        await questService.trackQuestProgress(user.userId, 'place_decoration', {
            decorationId: decorationTemplate.decorationId,
            decorationName: decorationTemplate.name
        });

        return {
            success: true,
            message: 'Decoration building added successfully',
            decoration: {
                buildingId: newDecoration.buildingId,
                name: newDecoration.name,
                position: newDecoration.position,
                size: newDecoration.size,
                index: newDecoration.index,
                boostPercent: newDecoration.boostPercent,
                is_decoration: true
            }
        };
    } catch (error) {
        console.error('Error in assignDecorationToUser:', error);
        return { 
            success: false, 
            message: "Error assigning decoration to user", 
            error: error.message 
        };
    }
}

/**
 * Updates a decoration building's position and recalculates gold generation for affected buildings
 * @param {string} userIdParam - The ID of the user
 * @param {string} decorationId - The ID of the decoration building
 * @param {Object} newPosition - New position coordinates {x, y}
 * @param {Array} previouslyAffectedBuildings - Buildings previously affected by this decoration
 * @param {Array} newlyAffectedBuildings - Buildings now affected by this decoration
 * @returns {Object} - Result of the update operation
 */
async function updateDecorationPosition(userIdParam, decorationId, newPosition, previouslyAffectedBuildings = [], newlyAffectedBuildings = []) {
    try {
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            return { success: false, message: "User not found" };
        }

        // Validate position
        if (!newPosition || typeof newPosition.x !== 'number' || typeof newPosition.y !== 'number') {
            return { success: false, message: "Valid position (x, y) is required" };
        }

        // Find the decoration in user's buildings array
        const decorationIndex = user.buildings.findIndex(b => 
            b.buildingId === decorationId && b.is_decoration === true
        );
        
        if (decorationIndex === -1) {
            return { success: false, message: "Decoration building not found for this user" };
        }

        const decoration = user.buildings[decorationIndex];
        const boostPercent = decoration.boostPercent || 0;
        const currentTime = new Date();

        // Step 1: Calculate reserve gold for previously affected buildings
        if (previouslyAffectedBuildings && previouslyAffectedBuildings.length > 0) {
            for (const buildingData of previouslyAffectedBuildings) {
                const buildingIndex = user.buildings.findIndex(b => 
                    b.index === buildingData.buildingIndex && 
                    !b.is_decoration // Skip decoration buildings
                );
                
                if (buildingIndex !== -1) {
                    const building = user.buildings[buildingIndex];
                    const lastCollectedTime = building.last_collected || user.logout_time;
                    
                    // Calculate time difference in hours
                    const timeDifference = (currentTime - lastCollectedTime) / (1000 * 60 * 60);
                    
                    // Use the specific boost percentage for this building or fall back to the decoration's boost
                    const effectiveBoostPercent = buildingData.boostPercent || boostPercent;
                    
                    // Calculate gold that would have been generated with the boost
                    const baseGoldGenerated = building.gold_coins * timeDifference;
                    const boostedAmount = baseGoldGenerated * (effectiveBoostPercent / 100);
                    const totalGenerated = baseGoldGenerated + boostedAmount;
                    
                    // Add to reserve_gold_coins
                    building.reserveCoins = (building.reserveCoins || 0) + totalGenerated;
                    
                    // Update last_collected time
                    building.last_collected = currentTime;
                    
                    console.log(`Updated reserve coins for building index ${building.index}: added ${totalGenerated.toFixed(2)} coins (${effectiveBoostPercent}% boost)`);
                }
            }
        }

        // Step 2: Calculate unboosted generation for newly affected buildings (if they weren't boosted before)
        if (newlyAffectedBuildings && newlyAffectedBuildings.length > 0) {
            for (const buildingData of newlyAffectedBuildings) {
                // Skip if this building was already in the previously affected list
                const wasPreviouslyAffected = previouslyAffectedBuildings && 
                    previouslyAffectedBuildings.some(b => b.buildingIndex === buildingData.buildingIndex);
                
                if (!wasPreviouslyAffected) {
                    const buildingIndex = user.buildings.findIndex(b => 
                        b.index === buildingData.buildingIndex && 
                        !b.is_decoration // Skip decoration buildings
                    );
                    
                    if (buildingIndex !== -1) {
                        const building = user.buildings[buildingIndex];
                        const lastCollectedTime = building.last_collected || user.logout_time;
                        
                        // Calculate time difference in hours
                        const timeDifference = (currentTime - lastCollectedTime) / (1000 * 60 * 60);
                        
                        // Calculate standard (unboosted) gold generation
                        const baseGoldGenerated = building.gold_coins * timeDifference;
                        
                        // Add to reserve_gold_coins
                        building.reserveCoins = (building.reserveCoins || 0) + baseGoldGenerated;
                        
                        // Update last_collected time
                        building.last_collected = currentTime;
                        
                        console.log(`Updated reserve coins for newly boosted building index ${building.index}: added ${baseGoldGenerated.toFixed(2)} coins (unboosted)`);
                    }
                }
            }
        }

        // Step 3: Update the decoration building's position
        user.buildings[decorationIndex].position = {
            x: newPosition.x,
            y: newPosition.y
        };

        // Mark the buildings array as modified
        user.markModified('buildings');

        // Save the user document
        await user.save();

        return {
            success: true,
            message: 'Decoration position updated and affected buildings recalculated',
            decorationId: decorationId,
            newPosition: newPosition,
            affectedBuildings: {
                previously: previouslyAffectedBuildings.length,
                newly: newlyAffectedBuildings.length
            }
        };
    } catch (error) {
        console.error('Error in updateDecorationPosition:', error);
        return { 
            success: false, 
            message: "Error updating decoration position", 
            error: error.message 
        };
    }
}

// Add this function after getUserBuildings but before collectBuildingCoins
async function getDebugBuildingInfo(userIdParam, buildingIdentifier) {
    try {
        const user = await User.findOne({ userId: userIdParam });
        if (!user) throw new Error('User not found');

        const buildingIndex = parseInt(buildingIdentifier);
        const building = user.buildings.find(b => b.index === buildingIndex);
        if (!building) throw new Error('Building not found');

        // Also fetch the building template for comparison
        const Building = require('../models/building');
        const buildingTemplate = await Building.findOne({ buildingId: building.buildingId });

        return {
            success: true,
            user_building: {
                buildingId: building.buildingId,
                name: building.name,
                index: building.index,
                gold_coins: building.gold_coins,
                generation_interval: building.generation_interval,
                last_collected: building.last_collected,
                reserveCoins: building.reserveCoins || 0
            },
            template: buildingTemplate ? {
                buildingId: buildingTemplate.buildingId,
                name: buildingTemplate.name,
                gold_coins: buildingTemplate.gold_coins,
                generation_interval: buildingTemplate.generation_interval
            } : null
        };
    } catch (error) {
        console.error('Error in getDebugBuildingInfo:', error);
        throw new Error(`Error getting building debug info: ${error.message}`);
    }
}

// Purchase a creature using anima currency or from inventory
async function purchaseCreature(userId, creatureType, slotNumber = 1) {
    try {
        console.log(`Attempting to purchase creature ${creatureType} for user ${userId} in slot ${slotNumber}`);
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }
        
        // Find the creature template
        const creatureTemplate = await Creature.findOne({ creature_Id: creatureType });
        if (!creatureTemplate) {
            return {
                success: false,
                message: `Creature type ${creatureType} not found`
            };
        }
        
        // Initialize creature_inventory if it doesn't exist
        if (!user.creature_inventory) {
            user.creature_inventory = [];
        }
        
        // Define animaCost early so it's available for all code paths
        const animaCost = creatureTemplate.anima_cost || 0;
        console.log(`Creature ${creatureTemplate.name} anima cost: ${animaCost}`);
        
        // Try to find this creature in the user's inventory first
        const inventoryCreature = user.creature_inventory.find(c => 
            c.creature_type === creatureType || 
            (c.creature_id && creatureTemplate._id && c.creature_id.toString() === creatureTemplate._id.toString()) ||
            c.name.toLowerCase() === creatureTemplate.name.toLowerCase()
        );
        
        // Check if the creature exists in inventory and has count > 0
        const fromInventory = inventoryCreature && inventoryCreature.count > 0;
        
        if (fromInventory) {
            console.log(`Found creature ${creatureTemplate.name} in inventory with count ${inventoryCreature.count}`);
        } else {
            console.log(`Creature ${creatureTemplate.name} not found in inventory, will purchase with anima`);
            
            // Initialize user currency if it doesn't exist
            if (!user.currency) {
                user.currency = { anima: 0 };
            }
            
            // Check if user has enough anima
            if (!user.currency.anima || user.currency.anima < animaCost) {
                return {
                    success: false,
                    message: `Not enough anima. Required: ${animaCost}, Available: ${user.currency.anima || 0}`
                };
            }
        }
        
        // Check user level requirement
        if (user.level < creatureTemplate.unlock_level) {
            return {
                success: false,
                message: `User level too low. Required: ${creatureTemplate.unlock_level}, Current: ${user.level}`
            };
        }
        
        // Check slot availability
        // First, load the CreatureSlot model to get slot configuration
        const CreatureSlot = mongoose.model('CreatureSlot');
        const slotConfigs = await CreatureSlot.find().sort({ slot_number: 1 });
        
        // Get the configuration for the requested slot
        const slotConfig = slotConfigs.find(s => s.slot_number === parseInt(slotNumber));
        if (!slotConfig) {
            return {
                success: false,
                message: `Invalid slot number: ${slotNumber}. No configuration found.`
            };
        }
        
        console.log(`Slot ${slotNumber} config:`, slotConfig);
        
        // Initialize creature_slots if it doesn't exist
        if (!user.creature_slots || !Array.isArray(user.creature_slots)) {
            user.creature_slots = [
                { slot_number: 1, is_unlocked: true, unlocked_at: new Date() }
            ];
        }
        
        // First, check if there's already a creature being unlocked in this slot
        const isSlotInUse = user.creating_creatures && user.creating_creatures.some(c => 
            c.slot_number === parseInt(slotNumber)
        );
        
        if (isSlotInUse) {
            return {
                success: false,
                message: `Slot ${slotNumber} already has a creature being unlocked. Only one creature can be unlocked at a time per slot.`
            };
        }
        
        // Find if the requested slot is unlocked
        const requestedSlot = user.creature_slots.find(slot => 
            slot.slot_number === parseInt(slotNumber) && slot.is_unlocked
        );
        
        if (!requestedSlot) {
            // Slot 1 is always free
            if (parseInt(slotNumber) === 1) {
                user.creature_slots.push({
                    slot_number: 1,
                    is_unlocked: true,
                    unlocked_at: new Date()
                });
                user.markModified('creature_slots');
                console.log(`Slot 1 is free and always available for user ${userId}`);
            } 
            // Slots 2-5 have specific requirements
            else {
                // If it's an elite slot, check if user is elite
                if (slotConfig.is_elite) {
                    const isEliteUser = user.elite_pass && user.elite_pass.active;
                    if (!isEliteUser) {
                        return {
                            success: false,
                            message: `Slot ${slotNumber} is only available for elite users.`
                        };
                    }
                }
                
                // If the slot has a gold cost, check if user has enough gold
                if (slotConfig.gold_cost > 0) {
                    if (user.gold_coins < slotConfig.gold_cost) {
                        return {
                            success: false,
                            message: `Not enough gold coins to unlock slot ${slotNumber}. Required: ${slotConfig.gold_cost}, Available: ${user.gold_coins}`
                        };
                    }
                    
                    // Deduct gold and unlock the slot
                    user.gold_coins -= slotConfig.gold_cost;
                    console.log(`Deducted ${slotConfig.gold_cost} gold from user. New balance: ${user.gold_coins}`);
                }
                
                // Unlock the slot
                user.creature_slots.push({
                    slot_number: parseInt(slotNumber),
                    is_unlocked: true,
                    unlocked_at: new Date()
                });
                user.markModified('creature_slots');
                console.log(`Unlocked slot ${slotNumber} for user ${userId}`);
            }
        }
        
        // Initialize creating_creatures array if it doesn't exist
        if (!user.creating_creatures) {
            user.creating_creatures = [];
        }
        
        // Store the unlockTimeMinutes, but don't start the timer yet
        const unlockTimeMinutes = creatureTemplate.unlock_time || 10;
        
        // Get current time for creation timestamp only
        const currentTime = new Date();
        
        // Set placeholder dates 1 year in the future for started_time and finished_time
        // These will be properly set when startCreatureUnlock is called
        const placeholderFutureDate = new Date(currentTime.getTime() + 365 * 24 * 60 * 60 * 1000);
        
        // Create a properly structured object directly without using a temporary model
        // This avoids the "Cannot overwrite model" error
        const creatureDoc = {
            _id: new mongoose.Types.ObjectId(),
            creature_id: creatureTemplate._id,
            creature_type: creatureTemplate.creature_type, // Use the correct category type (Draconic/Beast/Fractal)
            creature_Id_reference: creatureTemplate.creature_Id, // Store the reference to creature_Id
            name: creatureTemplate.name,
            unlock_time: unlockTimeMinutes,
            unlock_started: false,
            started_time: placeholderFutureDate, // Placeholder until unlock is started
            finished_time: placeholderFutureDate, // Placeholder until unlock is started
            level: 1,
            base_attack: creatureTemplate.base_attack,
            base_health: creatureTemplate.base_health,
            gold_coins: creatureTemplate.gold_coins,
            arcane_energy: creatureTemplate.arcane_energy || 99, // Add arcane_energy with default fallback
            image: creatureTemplate.image || 'default.png',
            description: creatureTemplate.description || '',
            anima_cost: animaCost,
            slot_number: parseInt(slotNumber) || 1,
            // Add additional stats
            critical_damage: creatureTemplate.critical_damage || 100,
            critical_damage_percentage: creatureTemplate.critical_damage_percentage || 25,
            armor: creatureTemplate.armor || 0,
            speed: creatureTemplate.speed || 100
        };
        
        console.log("Created creature purchase with slot number:", creatureDoc.slot_number, "Type:", typeof creatureDoc.slot_number);
        
        // Add to creating creatures array
        if (!Array.isArray(user.creating_creatures)) {
            user.creating_creatures = [];
        }
        user.creating_creatures.push(creatureDoc);
        
        // If from inventory, decrement count, otherwise subtract anima
        if (fromInventory) {
            // Decrease the count in inventory
            inventoryCreature.count--;
            
            // If count is 0, remove from inventory
            if (inventoryCreature.count <= 0) {
                const inventoryIndex = user.creature_inventory.findIndex(c => c === inventoryCreature);
                if (inventoryIndex !== -1) {
                    user.creature_inventory.splice(inventoryIndex, 1);
                }
            }
            
            console.log(`Using creature from inventory. Decreased count to ${inventoryCreature.count}`);
            user.markModified('creature_inventory');
        } else {
            // Subtract anima from user currency for normal purchase
            console.log(`Purchasing with anima. Cost: ${animaCost}, Current anima: ${user.currency.anima}`);
            user.currency.anima -= animaCost;
            user.markModified('currency');
        }
        
        user.markModified('creating_creatures');
        
        // Save user
        await user.save();
        
        // Prepare a message based on source and slot status
        let purchaseMessage = '';
        if (fromInventory) {
            purchaseMessage = `Creature ${creatureTemplate.name} taken from inventory`;
        } else {
            purchaseMessage = `Creature ${creatureTemplate.name} purchased with anima`;
        }
        
        if (slotConfig && slotConfig.gold_cost > 0) {
            purchaseMessage += ` and placed in slot ${slotNumber} (cost: ${slotConfig.gold_cost} gold)`;
        } else {
            purchaseMessage += ` and placed in slot ${slotNumber}`;
        }
        
        return {
            success: true,
            message: purchaseMessage,
            data: {
                creature: {
                    _id: creatureDoc._id,
                    name: creatureTemplate.name,
                    type: creatureTemplate.type || 'common',
                    base_attack: creatureDoc.base_attack,
                    base_health: creatureDoc.base_health,
                    gold_coins: creatureDoc.gold_coins,
                    arcane_energy: creatureDoc.arcane_energy,
                    critical_damage: creatureDoc.critical_damage,
                    critical_damage_percentage: creatureDoc.critical_damage_percentage,
                    armor: creatureDoc.armor,
                    speed: creatureDoc.speed
                    // Removed: unlock_time, anima_cost, unlock_started, slot_number
                },
                slot_info: {
                    slot_number: parseInt(slotNumber),
                    is_elite: slotConfig ? slotConfig.is_elite : false,
                    gold_cost: slotConfig ? slotConfig.gold_cost : 0
                },
                source: fromInventory ? 'inventory' : 'purchase',
                inventory_info: fromInventory ? {
                    previous_count: inventoryCreature.count + 1,
                    remaining_count: inventoryCreature.count
                } : null,
                user: {
                    userId: user.userId,
                    anima_balance: user.currency.anima,
                    gold_coins: user.gold_coins,
                    creating_creatures_count: user.creating_creatures.length,
                    inventory_count: user.creature_inventory.length
                }
            }
        };
    } catch (error) {
        console.error('Error in purchaseCreature:', error);
        return {
            success: false,
            message: `Error purchasing creature: ${error.message}`
        };
    }
}

// Check unlock status of creatures in creation
async function checkCreatureUnlockStatus(userId) {
    try {
        console.log(`Checking creature unlock status for user ${userId}`);
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
                return {
                    success: false,
                message: 'User not found'
            };
        }
        
        // If no creating_creatures, return empty array
        if (!user.creating_creatures || user.creating_creatures.length === 0) {
            return {
                success: true,
                message: 'No creatures in creation',
                data: {
                    creating_creatures: []
                }
            };
        }
        
        const currentTime = new Date();
        const creaturesInProgress = [];
        const creaturesReadyToUnlock = [];
        
        // Track if we need to save fixes to database inconsistencies
        let needsToSaveFixedData = false;
        
        // Check each creature's status
        user.creating_creatures.forEach(creature => {
            // Check for database inconsistency: valid timestamp but unlock_started is false
            const hasValidTimestamps = creature.started_time && 
                                       creature.finished_time && 
                                       new Date(creature.started_time).getFullYear() < 2100; // Not a far-future placeholder
            
            // Fix database inconsistency on-the-fly if needed
            if (hasValidTimestamps && creature.unlock_started !== true) {
                console.log(`Fixing inconsistent data: Creature ${creature.name} has valid timestamps but unlock_started is false`);
                creature.unlock_started = true;
                // We'll need to save this fix later
                needsToSaveFixedData = true;
            }
            
            // Consider unlocked either by flag or by having valid timestamps
            const unlockStarted = creature.unlock_started === true || hasValidTimestamps;
            const finishedTime = new Date(creature.finished_time);
            
            // A creature is ready if unlock has started AND finished time has passed
            const isReady = unlockStarted && finishedTime <= currentTime;
            
            // Calculate remaining time in minutes - only if unlock has started
            let remainingMinutes = 0;
            if (unlockStarted) {
                const remainingTimeMs = Math.max(0, finishedTime - currentTime);
                remainingMinutes = Math.ceil(remainingTimeMs / 60000);
            } else {
                // If unlock hasn't started, use the full unlock time
                remainingMinutes = creature.unlock_time || 10;
            }
            
            const creatureInfo = {
                _id: creature._id,
                name: creature.name,
                type: creature.creature_type,
                is_ready: isReady,
                unlock_started: unlockStarted,
                remaining_minutes: remainingMinutes,
                level: creature.level,
                base_attack: creature.base_attack,
                base_health: creature.base_health,
                gold_coins: creature.gold_coins,
                arcane_energy: creature.arcane_energy || 99, // Add arcane_energy
                image: creature.image,
                description: creature.description,
                // Add additional stats
                critical_damage: creature.critical_damage || 100,
                critical_damage_percentage: creature.critical_damage_percentage || 25,
                armor: creature.armor || 0,
                speed: creature.speed || 100
                // Removing unwanted fields: started_time, finished_time, unlock_time, anima_cost, slot_number
            };
            
            if (isReady) {
                creaturesReadyToUnlock.push(creatureInfo);
            } else {
                creaturesInProgress.push(creatureInfo);
            }
        });
        
        // If we fixed any inconsistencies, save them to the database
        if (needsToSaveFixedData) {
            console.log(`Saving fixes to database inconsistencies for user ${userId}`);
            user.markModified('creating_creatures');
            
            try {
                await user.save();
                console.log(`Successfully saved fixed data`);
            } catch (saveError) {
                console.error(`Error saving fixed data: ${saveError}`);
                // Continue anyway to return the corrected status to the client
            }
        }
        
        return {
            success: true,
            message: 'Creature unlock status retrieved successfully',
            data: {
                creating_creatures: {
                    ready_to_unlock: creaturesReadyToUnlock,
                    in_progress: creaturesInProgress
                },
                total_count: user.creating_creatures.length,
                ready_count: creaturesReadyToUnlock.length,
                fixed_data: needsToSaveFixedData // Indicate if we fixed any data
            }
        };
    } catch (error) {
        console.error('Error in checkCreatureUnlockStatus:', error);
        return {
            success: false,
            message: `Error checking creature unlock status: ${error.message}`
        };
    }
}

// Unlock a creature when it's ready and add to user's creatures list
async function unlockCreature(userId, creatureId, forceUnlock = false) {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Find the creature in locked_creatures or creating_creatures
        let creatureToUnlock = null;
        let creatureIndex = -1;
        let isFromCreatingCreatures = false;

        // First check in creating_creatures
        if (user.creating_creatures && Array.isArray(user.creating_creatures)) {
            creatureIndex = user.creating_creatures.findIndex(c => c._id.toString() === creatureId);
            if (creatureIndex !== -1) {
                creatureToUnlock = user.creating_creatures[creatureIndex];
                isFromCreatingCreatures = true;
            }
        }

        // If not found, check in locked_creatures
        if (creatureToUnlock === null && user.locked_creatures && Array.isArray(user.locked_creatures)) {
            creatureIndex = user.locked_creatures.findIndex(c => c._id.toString() === creatureId);
            if (creatureIndex !== -1) {
                creatureToUnlock = user.locked_creatures[creatureIndex];
            }
        }

        if (!creatureToUnlock) {
            return {
                success: false,
                message: 'Creature not found'
            };
        }

        // Check if creature is ready to unlock
        if (!forceUnlock && isFromCreatingCreatures) {
            // Check for database inconsistency: has valid timestamps but unlock_started is false
            const hasValidTimestamps = creatureToUnlock.started_time && 
                                     creatureToUnlock.finished_time && 
                                     new Date(creatureToUnlock.started_time).getFullYear() < 2100;
            
            // Fix inconsistency if needed
            if (hasValidTimestamps && !creatureToUnlock.unlock_started) {
                console.log(`Fixing inconsistent data in unlockCreature: Creature ${creatureToUnlock.name} has valid timestamps but unlock_started is false`);
                creatureToUnlock.unlock_started = true;
                user.markModified('creating_creatures');
                await user.save();
                console.log(`Fixed unlock_started flag for creature ${creatureToUnlock.name}`);
            }
            
            // First check if unlock has been started at all (after potential fix)
            if (!creatureToUnlock.unlock_started && !hasValidTimestamps) {
                return {
                    success: false,
                    message: 'Creature unlock timer has not been started yet. Use startCreatureUnlock API first.',
                    unlock_started: false
                };
            }
            
            // Then check if the unlock timer has finished
            const now = new Date();
            const finishTime = new Date(creatureToUnlock.finished_time);
            
            if (now < finishTime) {
                // Timer started but not finished yet
                return {
                    success: false,
                    message: 'Creature is not ready to unlock yet',
                    unlock_started: true,
                    remaining_time: Math.ceil((finishTime - now) / 1000), // in seconds
                    remaining_minutes: Math.ceil((finishTime - now) / 60000) // in minutes
                };
            }
        }

        // Create a copy of the creature for the creatures array, preserving important stats but excluding unwanted fields
        const { slot_number, unlock_started, unlock_time, anima_cost, started_time, finished_time, ...creatureWithoutSlot } = creatureToUnlock.toObject ? 
            creatureToUnlock.toObject() : { ...creatureToUnlock };
            
        // Ensure critical stats are preserved (use defaults if not present)
        if (!creatureWithoutSlot.critical_damage) creatureWithoutSlot.critical_damage = 100;
        if (!creatureWithoutSlot.critical_damage_percentage) creatureWithoutSlot.critical_damage_percentage = 25;
        if (!creatureWithoutSlot.armor) creatureWithoutSlot.armor = 0;
        if (!creatureWithoutSlot.speed) creatureWithoutSlot.speed = 100;
        if (!creatureWithoutSlot.arcane_energy) creatureWithoutSlot.arcane_energy = 99; // Ensure arcane_energy is preserved
            
        // All creatures start with building_index = 0 when unlocked
        // This indicates they need to be assigned to a building by the player
        creatureWithoutSlot.building_index = 0;
        console.log(`Set building_index to 0 for unlocked creature ${creatureToUnlock.name} - player needs to assign it to a building`);
        
        // Log whether this came from a card pack (helpful for debugging)
        if (slot_number === null || slot_number === undefined) {
            console.log(`Unlocking creature ${creatureToUnlock.name} from card pack (no slot_number)`);
        }
        
        // Fix creature_type to use the proper category (Draconic, Beast, Fractal)
        if (creatureWithoutSlot.creature_type) {
            // Look up the creature template to get the proper creature_type
            const creatureTemplate = await Creature.findOne({ 
                creature_Id: creatureWithoutSlot.creature_type 
            });
            
            if (creatureTemplate && creatureTemplate.creature_type) {
                // Replace with the correct category type
                creatureWithoutSlot.creature_type = creatureTemplate.creature_type;
                console.log(`Fixed creature_type from ${creatureToUnlock.creature_type} to ${creatureWithoutSlot.creature_type}`);
            }
        }
        
        // Add the creature to user's creatures array
        user.creatures.push(creatureWithoutSlot);

        // Remove the creature from locked_creatures or creating_creatures
        if (isFromCreatingCreatures) {
            user.creating_creatures.splice(creatureIndex, 1);
            user.markModified('creating_creatures');
        } else {
            user.locked_creatures.splice(creatureIndex, 1);
            user.markModified('locked_creatures');
        }

        // Save the user
        user.markModified('creatures');
        await user.save();

        return {
            success: true,
            message: 'Creature unlocked successfully',
            creature: creatureWithoutSlot
        };
    } catch (error) {
        console.error('Error unlocking creature:', error);
        return {
            success: false,
            message: 'Failed to unlock creature: ' + error.message
        };
    }
}

// Assign creature to a building
async function assignCreatureToBuilding(userId, creatureId, buildingIndex) {
    try {
        console.log(`Assigning creature ${creatureId} to building ${buildingIndex} for user ${userId}`);
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }
        
        // Check if creatures array exists
        if (!user.creatures || user.creatures.length === 0) {
            return {
                success: false,
                message: 'User has no creatures'
            };
        }
        
        // Find the specific creature
        const creatureIndex = user.creatures.findIndex(
            c => c._id.toString() === creatureId
        );
        
        if (creatureIndex === -1) {
            return {
                success: false,
                message: 'Creature not found'
            };
        }
        
        // Check if the building exists
        if (!user.buildings || user.buildings.length === 0) {
            return {
                success: false,
                message: 'User has no buildings'
            };
        }
        
        // Parse buildingIndex as integer to ensure proper comparison
        const parsedBuildingIndex = parseInt(buildingIndex);
        if (isNaN(parsedBuildingIndex)) {
            return {
                success: false,
                message: 'Invalid building index'
            };
        }
        
        // Find the specified building
        const buildingToAssign = user.buildings.find(b => b.index === parsedBuildingIndex);
        if (!buildingToAssign) {
            return {
                success: false,
                message: `Building with index ${parsedBuildingIndex} not found`
            };
        }
        
        // Check if there are already creatures in this building
        const buildingCreatures = user.creatures.filter(c => c.building_index === parsedBuildingIndex);
        if (buildingCreatures.length > 0) {
            // Get the creature to assign
            const newCreature = user.creatures[creatureIndex];
            
            // Primary validation: Check creature_Id_reference first
            if (newCreature.creature_Id_reference && buildingCreatures[0].creature_Id_reference) {
                const existingReference = buildingCreatures[0].creature_Id_reference.toLowerCase();
                const newReference = newCreature.creature_Id_reference.toLowerCase();
                
                // If references don't match, return error
                if (existingReference !== newReference) {
                    return {
                        success: false,
                        message: `This building already contains ${buildingCreatures[0].name} creatures. You can only assign creatures of the same type to this building.`,
                        data: {
                            existing_creature_reference: existingReference,
                            new_creature_reference: newReference
                        }
                    };
                }
            } 
            // Fallback validation: Check creature_type if creature_Id_reference is not available
            else {
                // Get the type of creatures currently in the building
                const existingType = buildingCreatures[0].creature_type?.toLowerCase();
                const newCreatureType = newCreature.creature_type?.toLowerCase();
                
                // If the types don't match, return an error
                if (existingType && existingType !== newCreatureType) {
                    return {
                        success: false,
                        message: `This building already contains ${buildingCreatures[0].name} creatures. You can only assign creatures of the same type to this building.`,
                        data: {
                            existing_creature_type: existingType,
                            new_creature_type: newCreatureType
                        }
                    };
                }
            }
        }
        
        // Update the creature's building_index
        user.creatures[creatureIndex].building_index = parsedBuildingIndex;
        
        // Initialize building.creatures array if it doesn't exist
        if (!buildingToAssign.creatures) {
            buildingToAssign.creatures = [];
        }
        
        // Add the creature to the building's creatures array if not already there
        if (!buildingToAssign.creatures.includes(user.creatures[creatureIndex]._id)) {
            buildingToAssign.creatures.push(user.creatures[creatureIndex]._id);
        }
        
        // Mark modifications
        user.markModified('creatures');
        user.markModified('buildings');
        
        // Save the user
        await user.save();
        
        return {
            success: true,
            message: `Creature ${user.creatures[creatureIndex].name} successfully assigned to building ${buildingIndex}`,
            data: {
                creature: user.creatures[creatureIndex],
                building: buildingToAssign
            }
        };
    } catch (error) {
        console.error('Error in assignCreatureToBuilding:', error);
        return {
            success: false,
            message: `Error assigning creature to building: ${error.message}`
        };
    }
}

// Start the unlock timer for a creature
async function startCreatureUnlock(userId, creatureId) {
    try {
        console.log(`Starting unlock timer for creature ${creatureId} for user ${userId}`);
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }
        
        // Check if creating_creatures exists
        if (!user.creating_creatures || user.creating_creatures.length === 0) {
            return {
                success: false,
                message: 'No creatures in creation queue'
            };
        }
        
        // Find the specific creature
        const creatureIndex = user.creating_creatures.findIndex(
            c => c._id.toString() === creatureId
        );
        
        if (creatureIndex === -1) {
            return {
                success: false,
                message: 'Creature not found in creation queue'
            };
        }
        
        const creature = user.creating_creatures[creatureIndex];
        
        // Set current time and calculate finished time
        const currentTime = new Date();
        const unlockTimeMinutes = creature.unlock_time || 10;
        const finishedTime = new Date(currentTime.getTime() + (unlockTimeMinutes * 60000));
        
        // Create a direct reference to the creature object for clarity
        const creatureToUpdate = user.creating_creatures[creatureIndex];
        
        // Explicitly set each field - helps ensure MongoDB sees the changes
        creatureToUpdate.started_time = currentTime;
        creatureToUpdate.finished_time = finishedTime;
        creatureToUpdate.unlock_started = true;
        
        // Log the update for debugging
        console.log(`Updated creature unlock status:
            creature: ${creatureToUpdate.name}
            unlock_started: ${creatureToUpdate.unlock_started}
            started_time: ${creatureToUpdate.started_time}
            finished_time: ${creatureToUpdate.finished_time}
        `);
        
        // Force MongoDB to recognize the change by setting the entire creating_creatures array
        // This is a more robust way to ensure nested document updates are saved
        user.creating_creatures[creatureIndex] = creatureToUpdate;
        
        // Mark the entire creating_creatures array as modified for Mongoose
        user.markModified('creating_creatures');
        
        // Also mark the specific creature as modified with its index path
        user.markModified(`creating_creatures.${creatureIndex}.unlock_started`);
        user.markModified(`creating_creatures.${creatureIndex}.started_time`);
        user.markModified(`creating_creatures.${creatureIndex}.finished_time`);
        
        // Force save with maximal precautions
        try {
            // First try to save the document with the regular save method
            await user.save();
            console.log(`First save attempt completed for user ${userId}`);
            
            // Verify the save was successful by reading back from the database
            let updatedUser = await User.findOne({ userId });
            let updatedCreature = updatedUser.creating_creatures.find(c => c._id.toString() === creatureId);
            
            // Check if the update was successful
            if (!updatedCreature || updatedCreature.unlock_started !== true) {
                console.error(`WARNING: First save attempt failed to update unlock_started!`);
                console.log(`Attempting more aggressive update with findOneAndUpdate...`);
                
                // If the first save didn't work, try a more direct update using findOneAndUpdate
                const updateResult = await User.findOneAndUpdate(
                    { 
                        userId: userId, 
                        "creating_creatures._id": creatureId 
                    },
                    { 
                        $set: { 
                            "creating_creatures.$.unlock_started": true,
                            "creating_creatures.$.started_time": currentTime,
                            "creating_creatures.$.finished_time": finishedTime
                        } 
                    },
                    { new: true }
                );
                
                if (updateResult) {
                    console.log(`Direct update completed successfully`);
                    updatedUser = updateResult;
                    updatedCreature = updatedUser.creating_creatures.find(c => c._id.toString() === creatureId);
                }
            }
            
            // Final verification
            if (updatedCreature) {
                console.log(`Final verification - creature after save:
                    _id: ${updatedCreature._id}
                    name: ${updatedCreature.name}
                    unlock_started: ${updatedCreature.unlock_started}
                    started_time: ${updatedCreature.started_time}
                    finished_time: ${updatedCreature.finished_time}
                `);
                
                if (!updatedCreature.unlock_started) {
                    console.error(`CRITICAL WARNING: unlock_started is still false after all save attempts!`);
                }
            }
            
            // Return consistent response even if save didn't work properly
            // This ensures the client receives the correct expected state
            return {
                success: true,
                message: `Creature ${creature.name} unlock timer started`,
                data: {
                    creature: {
                        _id: creature._id,
                        name: creature.name,
                        remaining_minutes: unlockTimeMinutes,
                        unlock_started: true, // Explicitly return the updated value
                        started_time: currentTime,
                        finished_time: finishedTime,
                        arcane_energy: creature.arcane_energy || 99 // Add arcane_energy to response
                    }
                }
            };
        } catch (saveError) {
            console.error(`Error saving user with creature unlock status: ${saveError}`);
            throw saveError;
        }
    } catch (error) {
        console.error('Error in startCreatureUnlock:', error);
        return {
            success: false,
            message: `Error starting creature unlock: ${error.message}`
        };
    }
}

// Fix any inconsistencies between creature building_index and building.creatures arrays
async function fixBuildingCreatureRelationships(userIdParam) {
    try {
        console.log(`Fixing building-creature relationships for user ${userIdParam}`);
        
        // Find user
        let user = await User.findOne({ userId: userIdParam });
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam);
        }
        if (!user) {
            return { success: false, message: "User not found" };
        }
        
        // Skip if no creatures or buildings
        if (!user.creatures || !user.buildings) {
            return { success: true, message: "No creatures or buildings to fix" };
        }
        
        let fixCount = 0;
        
        // Loop through all creatures
        for (const creature of user.creatures) {
            // Skip creatures without a building_index
            if (!creature.building_index) continue;
            
            // Find the building this creature is assigned to
            const building = user.buildings.find(b => b.index === creature.building_index);
            if (!building) continue;
            
            // Initialize building.creatures array if it doesn't exist
            if (!building.creatures) {
                building.creatures = [];
            }
            
            // Get creature ID (either _id or creature_id)
            const creatureId = creature._id || creature.creature_id;
            if (!creatureId) continue;
            
            // Check if creature is not in building's creatures array
            const creatureIdStr = creatureId.toString();
            const alreadyInBuilding = building.creatures.some(cid => 
                cid.toString() === creatureIdStr
            );
            
            if (!alreadyInBuilding) {
                // Add creature to building's creatures array
                building.creatures.push(creatureId);
                fixCount++;
            }
        }
        
        if (fixCount > 0) {
            // Save changes if any fixes were made
            user.markModified('buildings');
            await user.save();
        }
        
        return { 
            success: true, 
            message: `Fixed ${fixCount} creature-building relationships` 
        };
    } catch (error) {
        console.error('Error in fixBuildingCreatureRelationships:', error);
        return { success: false, message: error.message };
    }
}

// Add this function after purchaseCreature

/**
 * Update creature slots based on user's subscription status
 * @param {string} userId - User ID
 */
async function updateCreatureSlotsBasedOnSubscription(userId) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Check if user has an active subscription
        const hasActiveSubscription = user.elite_pass && user.elite_pass.active;
        
        // If not a subscriber, no need to update
        if (!hasActiveSubscription) {
            return {
                success: true,
                message: 'User does not have an active subscription, no slot update needed',
                slots_updated: 0
            };
        }

        // Get the slot configurations
        const CreatureSlot = mongoose.model('CreatureSlot');
        const slotConfigs = await CreatureSlot.find().sort({ slot_number: 1 });
        
        // Initialize creature_slots array if it doesn't exist
        if (!user.creature_slots) {
            user.creature_slots = [];
        }
        
        let slotsUpdated = 0;
        
        // For each elite slot, check if user has it unlocked
        for (const slotConfig of slotConfigs) {
            // Only process elite slots
            if (slotConfig.is_elite) {
                const slotNumber = slotConfig.slot_number;
                const existingSlot = user.creature_slots.find(s => s.slot_number === slotNumber);
                
                // If slot doesn't exist or is not unlocked, unlock it
                if (!existingSlot) {
                    user.creature_slots.push({
                        slot_number: slotNumber,
                        is_unlocked: true,
                        unlocked_at: new Date()
                    });
                    slotsUpdated++;
                } else if (!existingSlot.is_unlocked) {
                    existingSlot.is_unlocked = true;
                    existingSlot.unlocked_at = new Date();
                    slotsUpdated++;
                }
            }
        }
        
        // Save user if any slots were updated
        if (slotsUpdated > 0) {
            user.markModified('creature_slots');
            await user.save();
        }
        
        return {
            success: true,
            message: `Updated ${slotsUpdated} elite creature slots based on subscription`,
            slots_updated: slotsUpdated
        };
    } catch (error) {
        console.error('Error updating creature slots based on subscription:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Get a user's creature inventory
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Creature inventory data
 */
async function getCreatureInventory(userId) {
    try {
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Initialize creature_inventory if it doesn't exist
        if (!user.creature_inventory) {
            user.creature_inventory = [];
            await user.save();
        }

        // Fetch all creature templates for more complete information
        const creatureTemplates = await Creature.find();
        const templateMap = {};
        
        creatureTemplates.forEach(template => {
            templateMap[template._id.toString()] = template;
        });

        // Enhance inventory items with more details
        const enhancedInventory = user.creature_inventory.map(item => {
            const template = templateMap[item.creature_id.toString()];
            
            return {
                ...item.toObject ? item.toObject() : item,
                creature_id: item.creature_id.toString(),
                unlock_time: template ? template.unlock_time : 10,
                anima_cost: template ? template.anima_cost : 80,
                base_attack: item.base_attack || (template ? template.base_attack : 50),
                base_health: item.base_health || (template ? template.base_health : 300),
                gold_coins: item.gold_coins || (template ? template.gold_coins : 50),
                arcane_energy: item.arcane_energy || (template ? template.arcane_energy : 99),
                critical_damage: item.critical_damage || (template ? template.critical_damage : 100),
                critical_damage_percentage: item.critical_damage_percentage || (template ? template.critical_damage_percentage : 25),
                armor: item.armor || (template ? template.armor : 0),
                speed: item.speed || (template ? template.speed : 100),
                template_available: !!template
            };
        });

        return {
            success: true,
            message: 'Creature inventory retrieved successfully',
            data: {
                inventory: enhancedInventory,
                total_count: enhancedInventory.length,
                total_creatures: enhancedInventory.reduce((acc, item) => acc + item.count, 0)
            }
        };
    } catch (error) {
        console.error('Error in getCreatureInventory:', error);
        return {
            success: false,
            message: `Error getting creature inventory: ${error.message}`
        };
    }
}

// Export the function
module.exports = {
    getUserWithDetails,
    updateUserGold,
    updateReserveCoins,
    collectReserveCoins,
    collectBuildingCoins,
    updateBuildingPosition,
    getBuildingGoldDetails,
    assignBuildingToUser,
    assignMultipleBuildingsToUser,
    addCreatureToBuilding,
    updateBuildingCreatureLevel,
    getBuildingCreatures,
    getUserBuildings,
    deleteCreatureFromBuilding,
    deleteBuildingFromUser,
    getTotalCreaturesForUser,
    getCreatureLocations,
    updateBattleSelectedCreatures,
    mergeCreatures,
    addBoostToUser,
    removeBoostFromUser,
    addRumbleConstructionArea,
    checkRumbleConstructionArea,
    getUserRumbleAreas,
    clearRumbleConstructionArea,
    checkBuildingConstructionStatus,
    processUserResponse,
    assignDecorationToUser,
    updateDecorationPosition,
    getDebugBuildingInfo,
    purchaseCreature,
    checkCreatureUnlockStatus,
    unlockCreature,
    assignCreatureToBuilding,
    startCreatureUnlock,
    fixBuildingCreatureRelationships,
    updateCreatureSlotsBasedOnSubscription,
    getCreatureInventory
};
    