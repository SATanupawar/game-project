const express = require('express');
const router = express.Router();
const userService = require('../service/userService');
const currencyService = require('../service/currencyService');
const { 
    updateUserGold, 
    getBuildingGoldDetails, 
    assignBuildingToUser,
    assignMultipleBuildingsToUser,
    addCreatureToBuilding,
    updateBuildingCreatureLevel,
    getBuildingCreatures,
    getUserWithDetails,
    getUserBuildings,
    updateBuildingPosition,
    deleteCreatureFromBuilding,
    deleteBuildingFromUser,
    getTotalCreaturesForUser,
    updateReserveCoins,
    updateBattleSelectedCreatures,
    mergeCreatures,
    addBoostToUser,
    removeBoostFromUser
} = require('../service/userService');
const mongoose = require('mongoose');

// Get all users
router.get('/', async (req, res) => {
    try {
        const User = require('../models/user');
        const users = await User.find({}, { userId: 1, user_name: 1, level: 1 });
        
        res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
});

// Create a new user
router.post('/', async (req, res) => {
    try {
        const { 
            userId, user_name, level, profile_picture, title, 
            trophies, gold_coins, buildingId, creatureName 
        } = req.body;
        
        console.log(`Creating new user with ID: ${userId}`);

        // Get required models
        const User = require('../models/user');
        const Building = require('../models/building');
        const Creature = require('../models/creature');

        // Validate required fields
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!user_name) {
            return res.status(400).json({
                success: false,
                message: 'User name is required'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ userId });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this ID already exists'
            });
        }

        // Create a new user
        const user = new User({
            userId: userId,
            user_name: user_name,
            level: level || 1,
            profile_picture: profile_picture || 'default.jpg',
            title: title || '',
            gold_coins: gold_coins || 1000,
            buildings: [],
            creatures: [],
            battle_selected_creatures: [],
            boosts: [],
            currency: {
                gems: 0,
                arcane_energy: 0,
                gold: gold_coins || 1000, // Initialize with same value as gold_coins
                anima: 0,
                last_updated: new Date()
            }
        });

        // Add trophies if provided
        if (trophies && Array.isArray(trophies)) {
            user.trophies = trophies.map(trophy => ({
                name: trophy.name,
                count: trophy.count || 1
            }));
            
            // Calculate total trophy count
            user.trophy_count = user.trophies.reduce((total, trophy) => total + trophy.count, 0);
        }

        // Process building assignment if buildingId is provided
        let building = null;
        let buildingIndex = null;
        
        if (buildingId) {
            // Find the building template
            building = await Building.findOne({ buildingId });
            
            if (!building) {
                return res.status(404).json({
                    success: false,
                    message: `Building with ID ${buildingId} not found`
                });
            }
            
            // Generate a unique index for the building
            buildingIndex = Math.floor(Math.random() * 10000000000);
            
            // Add the building to the user
            user.buildings.push({
                buildingId: building.buildingId,
                name: building.name,
                gold_coins: building.gold_coins || 0,
                position: { x: 10, y: 10 }, // Default position
                size: building.size || { x: 2, y: 2 },
                index: buildingIndex,
                reserveCoins: 0,
                last_collected: new Date()
            });
            
            console.log(`Added building ${building.name} to user ${userId}`);
        }
        
        // Process creature assignment if creatureName is provided and a building was added
        if (creatureName && buildingIndex) {
            // Find the creature template (case insensitive)
            const creature = await Creature.findOne({
                name: { $regex: new RegExp('^' + creatureName + '$', 'i') }
            });
            
            if (!creature) {
                return res.status(404).json({
                    success: false,
                    message: `Creature with name ${creatureName} not found`
                });
            }
            
            // Create a creature ID
            const creatureId = new mongoose.Types.ObjectId();
            
            // Add the creature to the user
            user.creatures.push({
                _id: creatureId,
                creature_id: creatureId,
                creature_type: creature.creature_Id,
                name: creature.name,
                level: 1,
                building_index: buildingIndex,
                base_attack: creature.base_attack,
                base_health: creature.base_health,
                attack: creature.base_attack,
                health: creature.base_health,
                gold_coins: creature.gold_coins,
                count: 1
            });
            
            console.log(`Added creature ${creature.name} to building index ${buildingIndex}`);
        } else if (creatureName && !buildingIndex) {
            console.log(`Creature ${creatureName} not added because no building was specified`);
        }

        // Save the user
        await user.save();

        // Format the response
        const userData = {
            _id: user._id,
            userId: user.userId,
            user_name: user.user_name,
            level: user.level,
            profile_picture: user.profile_picture,
            title: user.title,
            trophies: user.trophies || [],
            trophy_count: user.trophy_count || 0,
            gold_coins: user.gold_coins,
            buildings: user.buildings || [],
            creatures: user.creatures || [],
            currency: user.currency || {
                gems: 0,
                arcane_energy: 0,
                gold: user.gold_coins,
                anima: 0
            }
        };

        res.status(201).json({
            success: true,
            message: "User created successfully",
            data: userData
        });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
});

// Get user details
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching details for user: ${userId}`);

        // Get required models
        const User = require('../models/user');
        const Creature = require('../models/creature');

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Initialize arrays if they don't exist
        if (!user.buildings) {
            user.buildings = [];
        }
        if (!user.creatures) {
            user.creatures = [];
        }
        
        // Ensure currency object is complete
        if (!user.currency) {
            user.currency = {
                gems: 0,
                arcane_energy: 0,
                gold: user.gold_coins || 0,
                anima: 0,
                last_updated: new Date()
            };
        } else if (user.currency.gold === undefined) {
            // Ensure gold is always present in the currency object
            user.currency.gold = user.gold_coins || 0;
            user.markModified('currency');
        }
        
        // Check for any missing currency fields and initialize them
        const currencyFields = ['gems', 'arcane_energy', 'gold', 'anima'];
        let currencyUpdated = false;
        
        for (const field of currencyFields) {
            if (user.currency[field] === undefined) {
                user.currency[field] = field === 'gold' ? user.gold_coins || 0 : 0;
                currencyUpdated = true;
            }
        }
        
        if (currencyUpdated) {
            user.markModified('currency');
            await user.save();
        }

        // Process buildings (without creatures)
        const processedBuildings = user.buildings.map(building => {
            return {
                _id: building._id,
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                size: building.size,
                index: building.index,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected,
                creature_ids: user.creatures
                    .filter(c => c.building_index === building.index)
                    .map(c => c._id.toString())
            };
        });

        // Process creatures with template data
        const processedCreatures = await Promise.all(user.creatures.map(async userCreature => {
            // Find creature template (case insensitive search)
            const creatureTemplate = await Creature.findOne({
                name: { $regex: new RegExp('^' + userCreature.name + '$', 'i') }
            });

            if (creatureTemplate) {
                // Find the level stats for this creature's level
                let levelStats = null;
                if (creatureTemplate.level_stats && creatureTemplate.level_stats.length > 0) {
                    levelStats = creatureTemplate.level_stats.find(
                        stats => stats.level === userCreature.level
                    );
                }

                // If we found matching level stats, use them
                if (levelStats) {
                    return {
                        _id: userCreature._id,
                        name: creatureTemplate.name,
                        level: userCreature.level,
                        building_index: userCreature.building_index,
                        type: creatureTemplate.type,
                        base_attack: creatureTemplate.base_attack,
                        base_health: creatureTemplate.base_health,
                        attack: levelStats.attack,
                        health: levelStats.health,
                        speed: levelStats.speed,
                        armor: levelStats.armor,
                        critical_damage_percentage: levelStats.critical_damage_percentage,
                        critical_damage: levelStats.critical_damage,
                        gold_coins: creatureTemplate.gold_coins,
                        image: creatureTemplate.image,
                        description: creatureTemplate.description
                    };
                } else {
                    // Calculate stats based on level if no level_stats found
                    let attack = creatureTemplate.base_attack;
                    let health = creatureTemplate.base_health;
                    if (userCreature.level > 1) {
                        const multiplier = 1 + ((userCreature.level - 1) * 0.1);
                        attack = Math.round(attack * multiplier);
                        health = Math.round(health * multiplier);
                    }

                    return {
                        _id: userCreature._id,
                        name: creatureTemplate.name,
                        level: userCreature.level,
                        building_index: userCreature.building_index,
                        type: creatureTemplate.type,
                        base_attack: creatureTemplate.base_attack,
                        base_health: creatureTemplate.base_health,
                        attack: attack,
                        health: health,
                        speed: creatureTemplate.speed,
                        armor: creatureTemplate.armor,
                        critical_damage_percentage: creatureTemplate.critical_damage_percentage,
                        critical_damage: creatureTemplate.critical_damage,
                        gold_coins: creatureTemplate.gold_coins,
                        image: creatureTemplate.image,
                        description: creatureTemplate.description
                    };
                }
            } else {
                // Return basic info if no template found
                return {
                    _id: userCreature._id,
                    name: userCreature.name,
                    level: userCreature.level,
                    building_index: userCreature.building_index
                };
            }
        }));

        // Format the response
        const userData = {
            _id: user._id,
            userId: user.userId,
            user_name: user.user_name,
            level: user.level,
            profile_picture: user.profile_picture || 'default.jpg',
            title: user.title || '',
            trophies: user.trophies || [],
            trophy_count: user.trophy_count || 0,
            gold_coins: user.gold_coins,
            buildings: processedBuildings,
            creatures: processedCreatures,
            battle_selected_creatures: Array.isArray(user.battle_selected_creatures) 
                ? user.battle_selected_creatures.map(c => ({
                    _id: c.creature_id,
                    name: c.name,
                    level: c.level,
                    position: c.position,
                    type: c.type,
                    attack: c.attack,
                    health: c.health
                }))
                : [],
            boosts: Array.isArray(user.boosts)
                ? user.boosts.map(b => ({
                    boost_id: b.boost_id,
                    boost_name: b.boost_name,
                    count: b.count
                }))
                : [],
            currency: user.currency || {
                gems: 0,
                arcane_energy: 0,
                gold: 0,
                anima: 0,
                last_updated: new Date()
            },
            logout_time: user.logout_time,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            __v: user.__v
        };

        console.log("Sending user data with currency:", user.currency);

        res.status(200).json({
            success: true,
            message: "User details fetched successfully",
            data: userData
        });

    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user details',
            error: error.message
        });
    }
});

// Update user profile information
router.post('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { user_name, level, title, profile_picture, trophies } = req.body;
        console.log(`Updating profile for user: ${userId}`);

        // Get required models
        const User = require('../models/user');

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update user fields if provided
        if (user_name) user.user_name = user_name;
        if (level) user.level = parseInt(level);
        if (title) user.title = title;
        if (profile_picture) user.profile_picture = profile_picture;

        // Update trophies if provided
        if (trophies && Array.isArray(trophies)) {
            // Initialize trophies array if it doesn't exist
            if (!user.trophies) {
                user.trophies = [];
            }
            
            // Track trophy changes for the response
            const trophyChanges = [];
            
            // Process each trophy
            trophies.forEach(newTrophy => {
                if (!newTrophy.name) return; // Skip if no name provided
                
                // Check if the trophy already exists
                const existingTrophy = user.trophies.find(t => t.name === newTrophy.name);
                
                // Check if we should replace instead of increment (default is now increment)
                const shouldReplace = newTrophy.replace === true;
                
                if (existingTrophy) {
                    // Store previous count for response
                    const previousCount = existingTrophy.count;
                    
                    // Update existing trophy count - either replace or increment (now increment by default)
                    if (!shouldReplace && newTrophy.count !== undefined) {
                        // Add to existing count (DEFAULT BEHAVIOR)
                        existingTrophy.count += newTrophy.count;
                        
                        // Record the change
                        trophyChanges.push({
                            name: newTrophy.name,
                            operation: 'increment',
                            previous_count: previousCount,
                            increment_amount: newTrophy.count,
                            new_count: existingTrophy.count
                        });
                    } else if (newTrophy.count !== undefined) {
                        // Replace the count (only if replace=true)
                        existingTrophy.count = newTrophy.count;
                        
                        // Record the change
                        trophyChanges.push({
                            name: newTrophy.name,
                            operation: 'replace',
                            previous_count: previousCount,
                            new_count: existingTrophy.count
                        });
                    }
                } else {
                    // Add new trophy
                    const newCount = newTrophy.count || 1;
                    user.trophies.push({
                        name: newTrophy.name,
                        count: newCount
                    });
                    
                    // Record the change
                    trophyChanges.push({
                        name: newTrophy.name,
                        operation: 'new',
                        new_count: newCount
                    });
                }
            });
            
            // Calculate total trophy count
            const previousTotalCount = user.trophy_count || 0;
            user.trophy_count = user.trophies.reduce((total, trophy) => total + trophy.count, 0);
            
            // Save trophy changes for the response
            req.trophyChanges = {
                changes: trophyChanges,
                previous_total: previousTotalCount,
                new_total: user.trophy_count
            };
        }

        // Save updated user
        await user.save();

        // Format response with updated user data
        const userData = {
            _id: user._id,
            userId: user.userId,
            user_name: user.user_name,
            level: user.level,
            profile_picture: user.profile_picture,
            title: user.title,
            trophies: user.trophies || [],
            trophy_count: user.trophy_count || 0,
            gold_coins: user.gold_coins,
            currency: user.currency || {
                gems: 0,
                arcane_energy: 0,
                gold: 0,
                anima: 0
            }
        };

        res.status(200).json({
            success: true,
            message: "User profile updated successfully",
            data: userData,
            trophy_operations: req.trophyChanges
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user profile',
            error: error.message
        });
    }
});

router.get('/update-gold/:userId', async (req, res) => {
    try {
        const { boost } = req.query; // Get boost percentage from query params
        const result = await updateUserGold(req.params.userId, boost);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get gold details for a specific building
router.get('/:userId/building/:buildingId', async (req, res) => {
    try {
        const { userId, buildingId } = req.params;
        const { boost } = req.query; // Get boost percentage from query params
        
        // Convert boost to number if provided
        const boostValue = boost ? parseFloat(boost) : 0;
        
        const buildingDetails = await getBuildingGoldDetails(userId, buildingId, boostValue);
        res.json(buildingDetails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Assign an existing building to a user
router.post('/:userId/buildings/assign', async (req, res) => {
    try {
        const { userId } = req.params;
        const { buildingId, position, creatureId } = req.body;
        
        if (!buildingId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Building ID is required' 
            });
        }

        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return res.status(400).json({ 
                success: false, 
                message: 'Valid position (x, y) is required' 
            });
        }
        
        const result = await assignBuildingToUser(userId, buildingId, position, creatureId);
        res.status(201).json(result);
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Assign multiple buildings to user
router.post('/:userId/buildings/assign-multiple', async (req, res) => {
    try {
        const { userId } = req.params;
        const { buildingIds } = req.body;
        
        if (!buildingIds || !Array.isArray(buildingIds) || buildingIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Array of building IDs is required' 
            });
        }
        
        const result = await assignMultipleBuildingsToUser(userId, buildingIds);
        res.status(201).json({
            success: true,
            message: 'Buildings assigned to user successfully',
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Add creature to building
router.post('/:userId/buildings/:buildingId/creatures/:creatureName', async (req, res) => {
    try {
        const { userId, buildingId, creatureName } = req.params;
        console.log(`Adding creature ${creatureName} to building ${buildingId} for user ${userId}`);

        // Prepare creature data
        const creatureData = {
            name: creatureName,
            creature_type: creatureName,
            level: req.body.level || 1,
            useExistingTemplate: true, // Flag to use existing template without creating new entry
            ...req.body // Include any additional creature data from request body
        };

        // Use the service function to add the creature
        const result = await addCreatureToBuilding(userId, buildingId, creatureData);

        // Return the result
        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error adding creature:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update creature level
router.put('/:userId/buildings/:buildingId/creatures/:creatureId/level/:levelNumber', async (req, res) => {
    try {
        const { userId, buildingId, creatureId, levelNumber } = req.params;
        
        // Parse buildingId as integer if it looks like a number
        let effectiveBuildingId = buildingId;
        if (!isNaN(parseInt(buildingId))) {
            effectiveBuildingId = parseInt(buildingId);
            console.log(`Parsed buildingId ${buildingId} as integer: ${effectiveBuildingId}`);
        }
        
        // Parse level number as integer
        const parsedLevel = parseInt(levelNumber);
        if (isNaN(parsedLevel) || parsedLevel < 1 || parsedLevel > 40) {
            return res.status(400).json({ 
                success: false, 
                message: 'Level must be a number between 1 and 40' 
            });
        }
        
        console.log(`Updating creature ${creatureId} to level ${parsedLevel} in building ${effectiveBuildingId} for user ${userId}`);
        const result = await updateBuildingCreatureLevel(userId, effectiveBuildingId, creatureId, parsedLevel);
        
        res.status(200).json({
            success: true,
            message: 'Creature level updated successfully',
            data: result
        });
    } catch (error) {
        console.error(`Error updating creature level:`, error);
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Get building creatures details
router.get('/:userId/buildings/:buildingId/creatures', async (req, res) => {
    try {
        const { userId, buildingId } = req.params;
        
        // Parse buildingId as integer if it looks like a number
        let effectiveBuildingId = buildingId;
        if (!isNaN(parseInt(buildingId))) {
            effectiveBuildingId = parseInt(buildingId);
            console.log(`Parsed buildingId ${buildingId} as integer: ${effectiveBuildingId}`);
        }
        
        console.log(`Getting creatures for user ${userId}, building ${effectiveBuildingId} (original: ${buildingId})`);
        const result = await getBuildingCreatures(userId, effectiveBuildingId);
        
        res.status(200).json({
            success: true,
            message: 'Building creatures fetched successfully',
            data: result
        });
    } catch (error) {
        console.error(`Error getting building creatures:`, error);
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Get user buildings
router.get('/:userId/buildings', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching buildings for user ${userId}`);

        // Get required models
        const User = require('../models/user');
        const Creature = require('../models/creature');

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Process buildings and fetch creature information
        const processedBuildings = await Promise.all(user.buildings.map(async building => {
            // Find all creatures for this building
            const buildingCreatures = user.creatures.filter(c => c.building_index === building.index);
            
            // Get complete creature information from creature table
            const processedCreatures = await Promise.all(buildingCreatures.map(async userCreature => {
                // Find creature template (case insensitive search)
                const creatureTemplate = await Creature.findOne({
                    name: { $regex: new RegExp('^' + userCreature.name + '$', 'i') }
                });
                
                if (creatureTemplate) {
                    // Find the level stats for this creature's level
                    let levelStats = null;
                    if (creatureTemplate.level_stats && creatureTemplate.level_stats.length > 0) {
                        levelStats = creatureTemplate.level_stats.find(
                            stats => stats.level === userCreature.level
                        );
                    }

                    // If we found matching level stats, use them
                    if (levelStats) {
                        return {
                            _id: userCreature._id,
                            name: creatureTemplate.name,
                            level: userCreature.level,
                            building_index: userCreature.building_index,
                            type: creatureTemplate.type,
                            base_attack: creatureTemplate.base_attack,
                            base_health: creatureTemplate.base_health,
                            attack: levelStats.attack,
                            health: levelStats.health,
                            speed: levelStats.speed,
                            armor: levelStats.armor,
                            critical_damage_percentage: levelStats.critical_damage_percentage,
                            critical_damage: levelStats.critical_damage,
                            gold_coins: creatureTemplate.gold_coins,
                            image: creatureTemplate.image,
                            description: creatureTemplate.description
                        };
                    } else {
                        // Calculate stats based on level if no level_stats found
                        let attack = creatureTemplate.base_attack;
                        let health = creatureTemplate.base_health;
                        if (userCreature.level > 1) {
                            const multiplier = 1 + ((userCreature.level - 1) * 0.1);
                            attack = Math.round(attack * multiplier);
                            health = Math.round(health * multiplier);
                        }

                        return {
                            _id: userCreature._id,
                            name: creatureTemplate.name,
                            level: userCreature.level,
                            building_index: userCreature.building_index,
                            type: creatureTemplate.type,
                            base_attack: creatureTemplate.base_attack,
                            base_health: creatureTemplate.base_health,
                            attack: attack,
                            health: health,
                            speed: creatureTemplate.speed,
                            armor: creatureTemplate.armor,
                            critical_damage_percentage: creatureTemplate.critical_damage_percentage,
                            critical_damage: creatureTemplate.critical_damage,
                            gold_coins: creatureTemplate.gold_coins,
                            image: creatureTemplate.image,
                            description: creatureTemplate.description
                        };
                    }
                } else {
                    // Return basic info if no template found
                    return {
                        _id: userCreature._id,
                        name: userCreature.name,
                        level: userCreature.level,
                        building_index: userCreature.building_index
                    };
                }
            }));

            // Return building with creature information
            return {
                _id: building._id,
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                size: building.size,
                index: building.index,
                type: building.type,
                status: building.status,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected,
                creature_ids: buildingCreatures.map(c => c._id),
                creatures: processedCreatures
            };
        }));

        res.status(200).json({
            success: true,
            message: `User buildings (${processedBuildings.length}) fetched successfully`,
            data: {
                buildings: processedBuildings
            }
        });
    } catch (error) {
        console.error('Error fetching buildings:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update building position
router.put('/:userId/buildings/:buildingId/position', async (req, res) => {
    try {
        const { userId, buildingId } = req.params;
        const { position, boost } = req.body;

        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
            return res.status(400).json({
                success: false,
                message: 'Valid position (x, y) is required'
            });
        }

        // Get required models
        const User = require('../models/user');

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find building
        const building = user.buildings.find(b => b.index === parseInt(buildingId));
        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found'
            });
        }

        // Update position
        building.position = {
            x: position.x,
            y: position.y
        };

        let response = {
            success: true,
            message: 'Building position updated successfully',
            data: {
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                index: building.index
            }
        };

        // Only generate reserve coins if boost is provided
        if (boost !== undefined) {
            const reserveCoinsResult = await updateReserveCoins(userId, building.index, boost);
            
            // Add reserve coins info to response
            response.data.reserveCoins = reserveCoinsResult.currentReserve;
            response.data.boost_percentage = boost;
        }

        // Save user
        await user.save();

        res.status(200).json(response);
    } catch (error) {
        console.error('Error updating building position:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

router.delete('/:userId/buildings/:index/creatures/:creatureId', async (req, res) => {
    try {
        const { userId, index, creatureId } = req.params;
        console.log(`Deleting creature ${creatureId} from building ${index} for user ${userId}`);

        // Get required models
        const User = require('../models/user');

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find and remove the creature from user's creatures array
        const creatureIndex = user.creatures.findIndex(c => 
            c._id.toString() === creatureId || 
            (c._id && c._id.toString() === creatureId)
        );

        if (creatureIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Creature not found'
            });
        }

        // Remove the creature
        user.creatures.splice(creatureIndex, 1);
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Creature deleted successfully',
            data: {
                deleted_creature_id: creatureId
            }
        });
    } catch (error) {
        console.error('Error deleting creature:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Delete a building from a user
router.delete('/:userId/buildings/:index', async (req, res) => {
    try {
        const { userId, index } = req.params;
        const result = await deleteBuildingFromUser(userId, index);
        
        res.status(200).json({
            success: true,
            message: 'Building deleted from user successfully',
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Get total creatures for a user
router.get('/:userId/creatures/total', async (req, res) => {
    try {
        const { userId } = req.params;
        const totalCreatures = await getTotalCreaturesForUser(userId);
        
        res.status(200).json({
            success: true,
            message: 'Total creatures fetched successfully',
            data: { totalCreatures }
        });
    } catch (error) {
        if (error.message.includes('not found')) {
            res.status(404).json({ 
                success: false, 
                message: error.message 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message 
            });
        }
    }
});

// Migration endpoint to convert existing creatures to the new format
router.get('/:userId/migrate-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Migrating creature data for user: ${userId}`);
        
        // Load user and templates
        const User = require('../models/user');
        const Creature = require('../models/creature');
        const mongoose = require('mongoose');
        
        let user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Initialize creatures array if it doesn't exist
        if (!user.creatures) {
            user.creatures = [];
            console.log('Initialized empty creatures array for user');
        }
        
        // Make sure creatures is an array
        if (!Array.isArray(user.creatures)) {
            console.log(`User creatures is not an array, converting. Current type: ${typeof user.creatures}`);
            user.creatures = [];
        }
        
        console.log(`User has ${user.creatures.length} creatures in database`);
        
        // Load all creature templates for reference
        const templates = await Creature.find({});
        console.log(`Loaded ${templates.length} creature templates`);
        
        // Create lookup tables
        const templatesByType = {};
        const templatesById = {};
        
        templates.forEach(template => {
            if (template._id) {
                templatesById[template._id.toString()] = template;
            }
            if (template.creature_Id) {
                templatesByType[template.creature_Id] = template;
            }
        });
        
        // Process each creature
        const migrated = [];
        
        for (const creature of user.creatures) {
            // Skip if already migrated with all fields
            if (creature._id && 
                creature.creature_type && 
                creature.name && 
                creature.attack && 
                creature.health) {
                continue;
            }
            
            console.log(`Migrating creature: ${creature._id || creature.creature_id}`);
            
            // Store what fields were added
            const fieldsAdded = [];
            
            // Ensure _id is set
            if (!creature._id) {
                creature._id = creature.creature_id || new mongoose.Types.ObjectId();
                fieldsAdded.push('_id');
            }
            
            // Find matching template
            let template = null;
            
            // Try to find by creature_id
            if (creature.creature_id && templatesById[creature.creature_id.toString()]) {
                template = templatesById[creature.creature_id.toString()];
            }
            
            // If not found, try by creature_type
            if (!template && creature.creature_type && templatesByType[creature.creature_type]) {
                template = templatesByType[creature.creature_type];
            }
            
            // If still no match, use dragon or first template
            if (!template) {
                template = templates.find(t => t.creature_Id === 'dragon') || templates[0];
            }
            
            // Set fields from template
            if (template) {
                // Main identifiers
                if (!creature.creature_type) {
                    creature.creature_type = template.creature_Id;
                    fieldsAdded.push('creature_type');
                }
                
                if (!creature.name) {
                    creature.name = template.name;
                    fieldsAdded.push('name');
                }
                
                if (!creature.type) {
                    creature.type = template.type;
                    fieldsAdded.push('type');
                }
                
                // Base stats
                if (!creature.base_attack) {
                    creature.base_attack = template.base_attack || 10;
                    fieldsAdded.push('base_attack');
                }
                
                if (!creature.base_health) {
                    creature.base_health = template.base_health || 50;
                    fieldsAdded.push('base_health');
                }
                
                // Image and description
                if (!creature.image) {
                    creature.image = template.image || 'default.png';
                    fieldsAdded.push('image');
                }
                
                if (!creature.description) {
                    creature.description = template.description || 'A mysterious creature';
                    fieldsAdded.push('description');
                }
                
                if (!creature.gold_coins) {
                    creature.gold_coins = template.gold_coins || 10;
                    fieldsAdded.push('gold_coins');
                }
                
                // Calculate stats based on level
                const level = creature.level || 1;
                let attackGrowth = 0.03;
                let healthGrowth = 0.03;
                
                // Adjust growth rates based on type
                if (template.type) {
                    switch(template.type.toLowerCase()) {
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
                
                // Calculate attack with compounding growth
                if (!creature.attack) {
                    let attack = creature.base_attack || template.base_attack || 10;
                    for (let i = 1; i < level; i++) {
                        attack += Math.round(attack * attackGrowth);
                    }
                    creature.attack = attack;
                    fieldsAdded.push('attack');
                }
                
                // Calculate health with compounding growth
                if (!creature.health) {
                    let health = creature.base_health || template.base_health || 50;
                    for (let i = 1; i < level; i++) {
                        health += Math.round(health * healthGrowth);
                    }
                    creature.health = health;
                    fieldsAdded.push('health');
                }
                
                // Set level if missing
                if (!creature.level) {
                    creature.level = 1;
                    fieldsAdded.push('level');
                }
                
                // Set count if missing
                if (!creature.count) {
                    creature.count = 1;
                    fieldsAdded.push('count');
                }
                
                if (fieldsAdded.length > 0) {
                    migrated.push({
                        _id: creature._id,
                        creature_type: creature.creature_type,
                        name: creature.name,
                        fields_added: fieldsAdded
                    });
                }
            }
        }
        
        // Save changes if there were any migrations
        if (migrated.length > 0) {
            await user.save();
            console.log(`Migrated ${migrated.length} creatures`);
        }
        
        res.status(200).json({
            success: true,
            message: `Migrated ${migrated.length} creatures to new format`,
            migrated: migrated
        });
    } catch (error) {
        console.error(`Error migrating creatures:`, error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

// Test endpoint to create a sample user with creatures
router.get('/create-test-user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Check if user already exists
        const User = require('../models/user');
        const Creature = require('../models/creature');
        const mongoose = require('mongoose');
        
        let existingUser = await User.findOne({ userId });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }
        
        // Create a sample building
        const building1Index = Math.floor(Math.random() * 10000000000);
        const building2Index = Math.floor(Math.random() * 10000000000);
        
        // Create a new user
        const newUser = new User({
            userId: userId,
            user_name: `Test_${userId}`,
            level: 1,
            gold_coins: 1000,
            buildings: [
                {
                    buildingId: 'building1',
                    name: 'Dark Library',
                    gold_coins: 30,
                    position: { x: 10, y: 20 },
                    size: { x: 2, y: 3 },
                    index: building1Index
                },
                {
                    buildingId: 'building2',
                    name: 'Beast Sanctum',
                    gold_coins: 40,
                    position: { x: 20, y: 30 },
                    size: { x: 3, y: 3 },
                    index: building2Index
                }
            ],
            creatures: []
        });
        
        // Add a dragon creature
        const creatureId = new mongoose.Types.ObjectId();
        
        // Create creature data directly (without using the creature model)
        const creatureData = {
            _id: creatureId,
            creature_id: creatureId,
            creature_type: 'dragon',
            name: 'Dragon',
            type: 'legendary',
            level: 1,
            base_attack: 45,
            base_health: 250, 
            attack: 45,
            health: 250,
            gold_coins: 50,
            image: 'dragon.png',
            description: 'A fierce fire-breathing dragon with immense power',
            building_index: building1Index,
            count: 1
        };
        
        // Add the creature to the user
        newUser.creatures.push(creatureData);
        
        // Save the user
        await newUser.save();
        
        res.status(201).json({
            success: true,
            message: 'Test user created successfully',
            data: {
                user: {
                    userId: newUser.userId,
                    user_name: newUser.user_name
                },
                buildings: newUser.buildings,
                creatures: newUser.creatures
            }
        });
    } catch (error) {
        console.error('Error creating test user:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

// Create a new debug endpoint that returns all buildings with full creature data
router.get('/:userId/buildings-with-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Getting all buildings with creatures for user: ${userId}`);
        
        // Get user service
        const userService = require('../service/userService');
        
        // Get all user buildings
        const result = await userService.getUserBuildings(userId);
        
        // Extract buildings from the result, handle both array and object response formats
        let buildings = [];
        if (result && result.success && result.data && result.data.buildings) {
            // New format - extract from data.buildings
            buildings = result.data.buildings;
        } else if (Array.isArray(result)) {
            // Old format - direct array
            buildings = result;
        } else {
            console.log('Unexpected response format from getUserBuildings:', result);
        }
        
        if (!buildings || buildings.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No buildings found for this user',
                data: []
            });
        }
        
        console.log(`Found ${buildings.length} buildings for user ${userId}`);
        
        // Get detailed creature data for each building
        const buildingsWithCreatures = [];
        
        for (const building of buildings) {
            const buildingData = {
                ...building, // Include all building properties
                creatures: [] // Will store full creature details
            };
            
            // Try to get creatures for all buildings, not just ones marked as creature buildings
            // This is because the is_creature_building flag might not be accurate
            try {
                // Get detailed creature data for this building using index
                const buildingCreatures = await userService.getBuildingCreatures(userId, building.index);
                
                if (buildingCreatures && buildingCreatures.creatures && buildingCreatures.creatures.length > 0) {
                    buildingData.creatures = buildingCreatures.creatures;
                    buildingData.is_creature_building = true; // Update flag if we found creatures
                    console.log(`Found ${buildingCreatures.creatures.length} creatures for building ${building.name} (index: ${building.index})`);
                } else {
                    console.log(`No creatures found for building ${building.name} (index: ${building.index})`);
                }
            } catch (error) {
                console.error(`Error fetching creatures for building ${building.buildingId} (index: ${building.index}):`, error.message);
            }
            
            buildingsWithCreatures.push(buildingData);
        }
        
        res.status(200).json({
            success: true,
            message: `Retrieved ${buildingsWithCreatures.length} buildings with creature data`,
            data: buildingsWithCreatures
        });
        
    } catch (error) {
        console.error(`Error getting buildings with creatures:`, error);
        res.status(500).json({
            success: false,
            message: `Error: ${error.message}`,
            stack: error.stack
        });
    }
});

// Test endpoint to directly add a creature to a building
router.get('/:userId/test-add-creature/:buildingIndex', async (req, res) => {
    try {
        const { userId, buildingIndex } = req.params;
        const buildingIdx = parseInt(buildingIndex);
        
        console.log(`Adding test creature to building ${buildingIndex} for user ${userId}`);
        
        // Get user model and mongoose
        const User = require('../models/user');
        const mongoose = require('mongoose');
        
        let user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Find the building
        const building = user.buildings.find(b => b.index === buildingIdx);
        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found',
                available_indexes: user.buildings.map(b => b.index)
            });
        }
        
        // Generate a creature ID
        const creatureId = new mongoose.Types.ObjectId();
        
        // Create a simple creature - use string ID to avoid MongoDB object conversion issues
        const dragonData = {
            _id: creatureId.toString(),
            creature_id: creatureId.toString(),
            creature_type: 'dragon',
            name: 'Test Dragon',
            type: 'legendary',
            level: 1,
            base_attack: 45,
            base_health: 250, 
            attack: 45,
            health: 250,
            gold_coins: 50,
            image: 'dragon.png',
            description: 'A fierce fire-breathing dragon with immense power',
            building_index: buildingIdx,
            count: 1
        };
        
        // Initialize creatures array if needed
        if (!user.creatures) {
            user.creatures = [];
            console.log('Initialized empty creatures array');
        }
        
        // Make sure creatures is an array
        if (!Array.isArray(user.creatures)) {
            console.log(`creatures is not an array (${typeof user.creatures}), converting to array`);
            user.creatures = [];
        }
        
        // Add the creature directly
        user.creatures.push(dragonData);
        console.log(`Added creature, array length now: ${user.creatures.length}`);
        
        // Save the user
        await user.save();
        console.log('User saved successfully');
        
        res.status(200).json({
            success: true,
            message: 'Test creature added successfully',
            data: {
                user: {
                    userId: user.userId,
                    user_name: user.user_name
                },
                building: {
                    buildingId: building.buildingId,
                    name: building.name,
                    index: building.index  
                },
                creature: dragonData
            }
        });
    } catch (error) {
        console.error('Error adding test creature:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

// Debug endpoint to get all user creatures with complete data
router.get('/:userId/debug-all-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        
        console.log(`Fetching all creatures for user: ${userId}`);
        
        // Find the user
        let user = await userService.getUserWithDetails(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if user has creatures array
        if (!user.creatures || !Array.isArray(user.creatures)) {
            return res.json({
                success: true,
                message: 'User has no creatures',
                data: {
                    userId: user.userId,
                    userName: user.user_name,
                    creatures: []
                }
            });
        }
        
        // Prepare to fetch creature data
        const creatureIds = [];
        const userCreatures = [];
        
        // Separate creature IDs and direct objects
        user.creatures.forEach(creature => {
            if (typeof creature === 'string' || (creature instanceof mongoose.Types.ObjectId)) {
                creatureIds.push(creature.toString());
            } else {
                userCreatures.push(creature);
            }
        });
        
        console.log(`Found ${userCreatures.length} direct creature objects and ${creatureIds.length} creature IDs`);
        
        // Fetch creatures from database if we have IDs
        let dbCreatures = [];
        if (creatureIds.length > 0) {
            try {
                const Creature = require('../models/creature');
                dbCreatures = await Creature.find({
                    _id: { $in: creatureIds.map(id => 
                        mongoose.Types.ObjectId.isValid(id) ? 
                        new mongoose.Types.ObjectId(id) : id
                    )}
                });
                console.log(`Found ${dbCreatures.length} creatures in database`);
            } catch (error) {
                console.error('Error fetching creatures from database:', error);
            }
        }
        
        // Fetch all creature templates for reference
        const Creature = require('../models/creature');
        const allTemplates = await Creature.find({});
        console.log(`Loaded ${allTemplates.length} creature templates for reference`);
        
        // Create lookup maps
        const templatesByType = {};
        const templatesById = {};
        const creaturesByStringId = {};
        
        // Index templates
        allTemplates.forEach(template => {
            if (template.creature_Id) {
                templatesByType[template.creature_Id] = template;
            }
            if (template._id) {
                templatesById[template._id.toString()] = template;
            }
        });
        
        // Index database creatures
        dbCreatures.forEach(creature => {
            creaturesByStringId[creature._id.toString()] = creature;
        });
        
        // Format all creatures with complete data
        const formattedCreatures = [];
        
        // Process direct creature objects
        userCreatures.forEach(creature => {
            const creatureData = {
                _id: creature._id,
                creature_id: creature.creature_id || creature._id,
                creature_type: creature.creature_type,
                name: creature.name,
                type: creature.type,
                level: creature.level || 1,
                base_attack: creature.base_attack,
                base_health: creature.base_health,
                attack: creature.attack,
                health: creature.health,
                gold_coins: creature.gold_coins,
                image: creature.image,
                description: creature.description,
                building_index: creature.building_index,
                count: creature.count || 1
            };
            
            // Use template data to fill in missing values
            if (creature.creature_type && templatesByType[creature.creature_type]) {
                const template = templatesByType[creature.creature_type];
                
                if (!creatureData.name) creatureData.name = template.name;
                if (!creatureData.type) creatureData.type = template.type;
                if (!creatureData.base_attack) creatureData.base_attack = template.base_attack;
                if (!creatureData.base_health) creatureData.base_health = template.base_health;
                if (!creatureData.gold_coins) creatureData.gold_coins = template.gold_coins;
                if (!creatureData.image) creatureData.image = template.image;
                if (!creatureData.description) creatureData.description = template.description;
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
            
            formattedCreatures.push(creatureData);
        });
        
        // Process creature IDs
        creatureIds.forEach(creatureId => {
            // Try to find the creature in the database results
            const dbCreature = creaturesByStringId[creatureId];
            
            // Or try to find in templates as a fallback
            const template = templatesById[creatureId];
            
            // Skip if we can't find any data for this ID
            if (!dbCreature && !template) {
                console.log(`No data found for creature ID: ${creatureId}`);
                formattedCreatures.push({
                    _id: creatureId,
                    creature_id: creatureId,
                    name: "Unknown Creature",
                    type: "common",
                    level: 1,
                    base_attack: 10,
                    base_health: 50,
                    attack: 10, 
                    health: 50,
                    gold_coins: 10,
                    description: "A mysterious creature with no data",
                    image: "unknown.png"
                });
                return;
            }
            
            // Start with database creature data if available
            const creatureData = {
                _id: creatureId,
                creature_id: creatureId,
                creature_type: dbCreature?.creature_type || template?.creature_Id,
                name: dbCreature?.name || template?.name || "Unknown Creature",
                type: dbCreature?.type || template?.type || "common",
                level: dbCreature?.level || 1,
                base_attack: dbCreature?.base_attack || template?.base_attack || 10,
                base_health: dbCreature?.base_health || template?.base_health || 50,
                attack: dbCreature?.attack || template?.base_attack || 10,
                health: dbCreature?.health || template?.base_health || 50,
                gold_coins: dbCreature?.gold_coins || template?.gold_coins || 10,
                image: dbCreature?.image || template?.image || "default.png",
                description: dbCreature?.description || template?.description || "A mysterious creature",
                building_index: dbCreature?.building_index,
                count: dbCreature?.count || 1
            };
            
            formattedCreatures.push(creatureData);
        });
        
        res.json({
            success: true,
            message: `Retrieved ${formattedCreatures.length} creatures for user ${userId}`,
            data: {
                userId: user.userId,
                userName: user.user_name,
                creatures: formattedCreatures
            }
        });
    } catch (error) {
        console.error('Error in debug-all-creatures endpoint:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: error.stack
        });
    }
});

// Raw user data debugging endpoint
router.get('/:userId/raw-user-data', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Getting raw user data for: ${userId}`);
        
        // Get the models
        const User = require('../models/user');
        const Creature = require('../models/creature');
        const mongoose = require('mongoose');
        
        // Find the user directly without using service functions
        let user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Load all creature templates for reference
        const templates = await Creature.find({});
        console.log(`Loaded ${templates.length} creature templates`);
        
        // Create lookup maps
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

        // Get full creature details
        const fullCreatureDetails = [];
        for (const creatureId of user.creatures) {
            try {
                const creature = await Creature.findById(creatureId);
                if (creature) {
                    fullCreatureDetails.push({
                        _id: creature._id,
                        creature_Id: creature.creature_Id,
                        name: creature.name,
                        type: creature.type,
                        level: creature.level,
                        gold_coins: creature.gold_coins,
                        base_attack: creature.base_attack,
                        base_health: creature.base_health,
                        attack: creature.attack,
                        health: creature.health,
                        speed: creature.speed,
                        armor: creature.armor,
                        critical_damage_percentage: creature.critical_damage_percentage,
                        critical_damage: creature.critical_damage,
                        image: creature.image,
                        description: creature.description
                    });
                } else {
                    // If creature not found, try to use template
                    const template = templatesById[creatureId.toString()];
                    if (template) {
                        fullCreatureDetails.push({
                            _id: creatureId,
                            creature_Id: template.creature_Id,
                            name: template.name,
                            type: template.type || 'common',
                            level: 1,
                            gold_coins: template.gold_coins,
                            base_attack: template.base_attack,
                            base_health: template.base_health,
                            attack: template.base_attack,
                            health: template.base_health,
                            speed: template.speed,
                            armor: template.armor,
                            critical_damage_percentage: template.critical_damage_percentage,
                            critical_damage: template.critical_damage,
                            image: template.image,
                            description: template.description
                        });
                    } else {
                        fullCreatureDetails.push({
                            _id: creatureId,
                            name: 'Unknown Creature',
                            type: 'unknown',
                            level: 1,
                            status: 'Creature not found'
                        });
                    }
                }
            } catch (error) {
                console.error(`Error fetching creature ${creatureId}:`, error);
                fullCreatureDetails.push({
                    _id: creatureId,
                    error: `Failed to load creature: ${error.message}`
                });
            }
        }
        
        // Create a simplified response with full creature details
        const safeUserData = {
            _id: user._id,
            userId: user.userId,
            user_name: user.user_name,
            level: user.level,
            gold_coins: user.gold_coins,
            buildings: user.buildings,
            creatures: fullCreatureDetails, // Now includes full creature details
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            __v: user.__v
        };
        
        // Print some debugging info
        console.log(`User has ${user.buildings?.length || 0} buildings`);
        console.log(`User has ${fullCreatureDetails.length} creatures with full details`);
        
        res.json({
            success: true,
            message: 'Raw user data fetched with full creature details',
            data: safeUserData
        });
    } catch (error) {
        console.error('Error fetching raw user data:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

// Advanced endpoint to get buildings with full creature data
router.get('/:userId/buildings-with-full-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Getting buildings with full creatures for user: ${userId}`);
        
        // Get the User and Creature models
        const User = require('../models/user');
        const Creature = require('../models/creature');
        
        // Find the user directly
        let user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get all buildings
        const buildings = user.buildings || [];
        console.log(`Found ${buildings.length} buildings for user ${userId}`);
        
        // Check if user has creatures array
        if (!user.creatures || !Array.isArray(user.creatures)) {
            console.log('User has no creatures array, initializing empty array');
            user.creatures = [];
        }
        
        // Extract creature IDs if they're stored as strings
        const creatureIds = [];
        const userCreatureObjects = [];
        
        user.creatures.forEach(creature => {
            if (typeof creature === 'string' || creature instanceof mongoose.Types.ObjectId) {
                creatureIds.push(creature.toString());
            } else {
                userCreatureObjects.push(creature);
            }
        });
        
        console.log(`Found ${userCreatureObjects.length} direct creature objects and ${creatureIds.length} creature IDs`);
        
        // Load all creature documents from database that match the IDs
        let dbCreatures = [];
        if (creatureIds.length > 0) {
            try {
                dbCreatures = await Creature.find({
                    _id: { $in: creatureIds }
                });
                console.log(`Loaded ${dbCreatures.length} creatures from database`);
            } catch (error) {
                console.error('Error loading creatures:', error);
            }
        }
        
        // Load all creature templates for reference
        const templates = await Creature.find({});
        console.log(`Loaded ${templates.length} creature templates for reference`);
        
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
        
        // Map of creature ID to complete data
        const allCreaturesById = {};
        
        // First process document creatures
        dbCreatures.forEach(creature => {
            const creatureId = creature._id.toString();
            
            // Store complete creature data
            allCreaturesById[creatureId] = {
                _id: creatureId,
                creature_id: creatureId,
                creature_type: creature.creature_type || creature.creature_Id,
                name: creature.name || 'Unknown Creature',
                type: creature.type || 'common',
                level: creature.level || 1,
                building_index: creature.building_index,
                count: creature.count || 1,
                base_attack: creature.base_attack || 10,
                base_health: creature.base_health || 50,
                attack: creature.attack || creature.base_attack || 10,
                health: creature.health || creature.base_health || 50,
                gold_coins: creature.gold_coins || 10,
                image: creature.image || 'default.png',
                description: creature.description || 'A mysterious creature'
            };
        });
        
        // Then process user creature objects (which might have more details)
        userCreatureObjects.forEach(creature => {
            const creatureId = (creature._id || creature.creature_id).toString();
            
            // Store complete creature data (might override database data)
            allCreaturesById[creatureId] = {
                _id: creatureId,
                creature_id: creatureId,
                creature_type: creature.creature_type,
                name: creature.name || 'Unknown Creature',
                type: creature.type || 'common',
                level: creature.level || 1,
                building_index: creature.building_index,
                count: creature.count || 1,
                base_attack: creature.base_attack || 10,
                base_health: creature.base_health || 50,
                attack: creature.attack || creature.base_attack || 10,
                health: creature.health || creature.base_health || 50,
                gold_coins: creature.gold_coins || 10,
                image: creature.image || 'default.png',
                description: creature.description || 'A mysterious creature'
            };
        });
        
        // For any remaining IDs, try to use templates
        creatureIds.forEach(creatureId => {
            // Skip if we already have data for this creature
            if (allCreaturesById[creatureId]) {
                return;
            }
            
            // Try to use template data
            const template = templatesById[creatureId];
            if (template) {
                allCreaturesById[creatureId] = {
                    _id: creatureId,
                    creature_id: creatureId,
                    creature_type: template.creature_Id,
                    name: template.name || 'Unknown Creature',
                    type: template.type || 'common',
                    level: 1,
                    building_index: null, // Unknown building
                    count: 1,
                    base_attack: template.base_attack || 10,
                    base_health: template.base_health || 50,
                    attack: template.base_attack || 10,
                    health: template.base_health || 50,
                    gold_coins: template.gold_coins || 10,
                    image: template.image || 'default.png',
                    description: template.description || 'A mysterious creature'
                };
            } else {
                // Fallback for completely unknown creatures
                allCreaturesById[creatureId] = {
                    _id: creatureId,
                    creature_id: creatureId,
                    creature_type: 'unknown',
                    name: 'Unknown Creature',
                    type: 'common',
                    level: 1,
                    building_index: null,
                    count: 1,
                    base_attack: 10,
                    base_health: 50,
                    attack: 10,
                    health: 50,
                    gold_coins: 10,
                    image: 'default.png',
                    description: 'A mysterious creature'
                };
            }
        });
        
        // Format buildings with creatures
        const formattedBuildings = buildings.map(building => {
            const buildingData = {
                _id: building._id,
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                gold_coins: building.gold_coins,
                last_collected: building.last_collected,
                size: building.size,
                index: building.index,
                is_creature_building: false,
                creature_ids: [],
                creatures: []
            };
            
            // Find creatures for this building
            const buildingCreatures = [];
            
            // Loop through all creatures and check if they belong to this building
            Object.values(allCreaturesById).forEach(creature => {
                if (creature.building_index === building.index) {
                    buildingCreatures.push(creature);
                    buildingData.is_creature_building = true;
                    buildingData.creature_ids.push({
                        creature_id: creature.creature_id,
                        creature_type: creature.creature_type,
                        level: creature.level,
                        count: creature.count
                    });
                }
            });
            
            // If no direct match found, look for creatures in the user's raw creatures array
            // This handles when creatures exist but the building_index is not set
            if (buildingCreatures.length === 0 && creatureIds.length > 0) {
                // Check each creature to see if it matches
                Object.values(allCreaturesById).forEach(creature => {
                    // If building_index is not set or doesn't match any building, 
                    // add it to the first building (guess)
                    if (!creature.building_index && building === buildings[0]) {
                        buildingCreatures.push({
                            ...creature,
                            building_index: building.index
                        });
                        buildingData.is_creature_building = true;
                        buildingData.creature_ids.push({
                            creature_id: creature.creature_id,
                            creature_type: creature.creature_type,
                            level: creature.level,
                            count: creature.count
                        });
                    }
                });
            }
            
            // Add creatures to building
            buildingData.creatures = buildingCreatures;
            
            return buildingData;
        });
        
        // Return formatted data
        res.json({
            success: true,
            message: `Retrieved ${formattedBuildings.length} buildings with full creature data`,
            data: formattedBuildings
        });
    } catch (error) {
        console.error('Error in buildings-with-full-creatures endpoint:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

// Update creature details endpoint
router.post('/:userId/update-creature-details', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Updating creature details for user: ${userId}`);
        
        // Get the User and Creature models
        const User = require('../models/user');
        const Creature = require('../models/creature');
        const mongoose = require('mongoose');
        
        // Find the user
        let user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Initialize creatures array if needed
        if (!user.creatures) {
            user.creatures = [];
        }
        
        // Make sure creatures is an array
        if (!Array.isArray(user.creatures)) {
            user.creatures = [];
        }
        
        // Load all creature templates for reference
        const templates = await Creature.find({});
        console.log(`Loaded ${templates.length} creature templates`);
        
        // Create lookup maps
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
        
        // Process each creature ID and convert to full object
        const updatedCreatures = [];
        
        for (let i = 0; i < user.creatures.length; i++) {
            const creatureId = user.creatures[i];
            let creatureData;
            
            if (typeof creatureId === 'string' || creatureId instanceof mongoose.Types.ObjectId) {
                // Try to find the creature in database
                try {
                    const dbCreature = await Creature.findById(creatureId);
                    if (dbCreature) {
                        creatureData = {
                            _id: creatureId.toString(),
                            creature_id: creatureId.toString(),
                            creature_type: dbCreature.creature_type || dbCreature.creature_Id,
                            name: dbCreature.name || 'Unknown Creature',
                            type: dbCreature.type || 'common',
                            level: dbCreature.level || 1,
                            base_attack: dbCreature.base_attack || 10,
                            base_health: dbCreature.base_health || 50,
                            attack: dbCreature.attack || dbCreature.base_attack || 10,
                            health: dbCreature.health || dbCreature.base_health || 50,
                            gold_coins: dbCreature.gold_coins || 10,
                            image: dbCreature.image || 'default.png',
                            description: dbCreature.description || 'A mysterious creature',
                            count: dbCreature.count || 1
                        };
                    } else {
                        // If not found in database, try to use template
                        const template = templatesById[creatureId.toString()];
                        if (template) {
                            creatureData = {
                                _id: creatureId.toString(),
                                creature_id: creatureId.toString(),
                                creature_type: template.creature_Id,
                                name: template.name || 'Unknown Creature',
                                type: template.type || 'common',
                                level: 1,
                                base_attack: template.base_attack || 10,
                                base_health: template.base_health || 50,
                                attack: template.base_attack || 10,
                                health: template.base_health || 50,
                                gold_coins: template.gold_coins || 10,
                                image: template.image || 'default.png',
                                description: template.description || 'A mysterious creature',
                                count: 1
                            };
                        }
                    }
                } catch (error) {
                    console.error(`Error processing creature ${creatureId}:`, error);
                }
            } else {
                // Already an object, just ensure it has all fields
                creatureData = {
                    ...user.creatures[i],
                    level: user.creatures[i].level || 1,
                    name: user.creatures[i].name || 'Unknown Creature',
                    count: user.creatures[i].count || 1
                };
            }
            
            if (creatureData) {
                updatedCreatures.push(creatureData);
            }
        }
        
        // Update user's creatures array with full objects
        user.creatures = updatedCreatures;
        
        // Save the updated user
        await user.save();
        
        res.json({
            success: true,
            message: `Updated ${updatedCreatures.length} creatures with full details`,
            data: {
                userId: user.userId,
                userName: user.user_name,
                creatures: updatedCreatures
            }
        });
        
    } catch (error) {
        console.error('Error updating creature details:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

// Get single building with full details
router.get('/:userId/buildings/:buildingIndex/details', async (req, res) => {
    try {
        const { userId, buildingIndex } = req.params;
        console.log(`Getting building details for user ${userId}, building index ${buildingIndex}`);

        // Get required models
        const User = require('../models/user');
        const Creature = require('../models/creature');

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find the building
        const building = user.buildings.find(b => b.index === parseInt(buildingIndex));
        if (!building) {
            return res.status(404).json({
                success: false,
                message: 'Building not found'
            });
        }

        // Get creatures for this building and fetch their complete info from creature table
        const buildingCreatures = [];
        
        // Filter creatures for this building
        const buildingCreaturesList = user.creatures.filter(creature => 
            typeof creature === 'object' && 
            creature !== null && 
            creature.building_index === parseInt(buildingIndex)
        );

        // Fetch complete info for each creature
        for (const userCreature of buildingCreaturesList) {
            console.log(`Processing creature: ${userCreature.name} level ${userCreature.level}`);
            
            // Find matching creature template
            const creatureTemplate = await Creature.findOne({
                name: { $regex: new RegExp(userCreature.name, 'i') } // Case insensitive search
            });

            if (creatureTemplate) {
                console.log(`Found template for ${userCreature.name}`);
                
                // Calculate stats based on level
                let attack = creatureTemplate.base_attack;
                let health = creatureTemplate.base_health;
                
                if (userCreature.level > 1) {
                    const multiplier = 1 + ((userCreature.level - 1) * 0.1);
                    attack = Math.round(attack * multiplier);
                    health = Math.round(health * multiplier);
                }

                // Use template data with calculated stats
                buildingCreatures.push({
                    _id: userCreature._id,
                    name: creatureTemplate.name,
                    type: creatureTemplate.type,
                    level: userCreature.level,
                    base_attack: creatureTemplate.base_attack,
                    base_health: creatureTemplate.base_health,
                    attack: attack,
                    health: health,
                    speed: creatureTemplate.speed,
                    armor: creatureTemplate.armor,
                    critical_damage_percentage: creatureTemplate.critical_damage_percentage,
                    critical_damage: creatureTemplate.critical_damage,
                    gold_coins: creatureTemplate.gold_coins,
                    image: creatureTemplate.image,
                    description: creatureTemplate.description,
                    building_index: userCreature.building_index
                });
            } else {
                console.log(`No template found for creature: ${userCreature.name}`);
                // Fallback to basic data if no template found
                buildingCreatures.push({
                    _id: userCreature._id,
                    name: userCreature.name,
                    level: userCreature.level,
                    building_index: userCreature.building_index
                });
            }
        }

        // Format building response
        const buildingData = {
            _id: building._id,
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            size: building.size,
            index: building.index,
            gold_coins: building.gold_coins,
            last_collected: building.last_collected,
            type: building.type || 'standard',
            status: building.status || 'active',
            creature_ids: buildingCreaturesList.map(creature => creature._id.toString()),
            creatures: buildingCreatures
        };

        res.status(200).json({
            success: true,
            message: 'Building details fetched successfully',
            data: buildingData
        });

    } catch (error) {
        console.error('Error fetching building details:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Update battle selected creatures
router.post('/:userId/battle-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        const { addCreatures, removeCreatures } = req.body;
        
        console.log('Updating battle creatures for user', userId);
        console.log('Request body:', req.body);
        
        // Validate the input - both are optional but at least one should be provided
        if ((!addCreatures || !addCreatures.length) && (!removeCreatures || !removeCreatures.length)) {
            return res.status(400).json({
                success: false,
                message: 'At least one of addCreatures or removeCreatures must be provided'
            });
        }
        
        // Find the user first to check current battle selection size
        const User = require('../models/user');
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Reset battle_selected_creatures if it has errors or isn't an array
        if (!Array.isArray(user.battle_selected_creatures)) {
            console.warn('User battle_selected_creatures is not an array or has errors, resetting it');
            user.battle_selected_creatures = [];
            await user.save();
        }
        
        // Call the service function to update battle selected creatures
        const result = await updateBattleSelectedCreatures(
            userId, 
            addCreatures || [], 
            removeCreatures || []
        );
        
        // Return appropriate status based on result
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error updating battle creatures:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating battle creatures',
            error: error.message
        });
    }
});

// Get battle selected creatures
router.get('/:userId/battle-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Find user
        const User = require('../models/user');
        let user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Initialize battle_selected_creatures if it doesn't exist
        if (!user.battle_selected_creatures) {
            user.battle_selected_creatures = [];
            await user.save();
        }
        
        // Format and return the battle creatures
        const battleCreatures = user.battle_selected_creatures.map(c => ({
            _id: c.creature_id,
            name: c.name,
            level: c.level,
            position: c.position,
            type: c.type,
            attack: c.attack,
            health: c.health
        }));
        
        res.status(200).json({
            success: true,
            message: 'Battle selected creatures fetched successfully',
            data: {
                battle_selected_creatures: battleCreatures,
                count: battleCreatures.length
            }
        });
    } catch (error) {
        console.error('Error fetching battle creatures:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching battle creatures',
            error: error.message
        });
    }
});

// Merge creatures to create higher level creature
router.post('/:userId/merge-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creatureIds } = req.body;
        
        console.log(`Merging creatures for user ${userId}`);
        console.log(`Creature IDs:`, creatureIds);
        
        // Validate the input
        if (!creatureIds || !Array.isArray(creatureIds) || creatureIds.length !== 2) {
            return res.status(400).json({
                success: false,
                message: 'Exactly two creature IDs must be provided for merging'
            });
        }
        
        // Call the service function to merge creatures
        const result = await mergeCreatures(userId, creatureIds);
        
        // Return appropriate status based on result
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error merging creatures:', error);
        res.status(500).json({
            success: false,
            message: 'Error merging creatures',
            error: error.message
        });
    }
});

// Add a new API route for getting a user's boosts
router.get('/:userId/boosts', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get the User model
        const User = require('../models/user');
        const Boost = require('../models/boost');
        
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get all boosts if user has any
        let userBoosts = [];
        if (user.boosts && user.boosts.length > 0) {
            // Get full boost details
            userBoosts = await Promise.all(user.boosts.map(async userBoost => {
                try {
                    const boostDetails = await Boost.findById(userBoost.boost_id);
                    
                    return {
                        boost_id: userBoost.boost_id,
                        boost_name: userBoost.boost_name,
                        count: userBoost.count,
                        description: boostDetails?.description || '',
                        path: boostDetails?.path || ''
                    };
                } catch (error) {
                    console.error(`Error getting boost details for ${userBoost.boost_id}:`, error);
                    return {
                        boost_id: userBoost.boost_id,
                        boost_name: userBoost.boost_name,
                        count: userBoost.count
                    };
                }
            }));
        }

        res.status(200).json({
            success: true,
            message: "User boosts fetched successfully",
            data: {
                boosts: userBoosts,
                count: userBoosts.length
            }
        });
    } catch (error) {
        console.error('Error fetching user boosts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user boosts',
            error: error.message
        });
    }
});

// Add a boost to a user
router.post('/:userId/boosts/:boostId', async (req, res) => {
    try {
        const { userId, boostId } = req.params;
        
        // Parse boostId to check if it includes a count parameter (e.g., "siphon=5")
        let actualBoostId = boostId;
        let count = 1;
        
        if (boostId.includes('=')) {
            const parts = boostId.split('=');
            actualBoostId = parts[0];
            count = parseInt(parts[1], 10);
            
            if (isNaN(count) || count <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid count parameter. Count must be a positive number.'
                });
            }
        }
        
        // Process the boost addition multiple times based on count
        const results = [];
        let finalResult = null;
        
        for (let i = 0; i < count; i++) {
            const result = await addBoostToUser(userId, actualBoostId);
            results.push(result);
            finalResult = result; // Keep the last result
        }
        
        // If we added multiple boosts, customize the response
        if (count > 1) {
            // Extract the final boost details from the last result
            const finalBoost = finalResult.data.boost;
            
            res.status(200).json({
                success: true,
                message: `Added ${count} ${actualBoostId} boosts to user`,
                data: {
                    boost: finalBoost,
                    operations_performed: count
                }
            });
        } else {
            // For single boost, return the standard response
            if (finalResult.success) {
                res.status(200).json(finalResult);
            } else {
                res.status(400).json(finalResult);
            }
        }
    } catch (error) {
        console.error('Error adding boost to user:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding boost to user',
            error: error.message
        });
    }
});

// Remove a boost from a user
router.delete('/:userId/boosts/:boostId', async (req, res) => {
    try {
        const { userId, boostId } = req.params;
        
        // Parse boostId to check if it includes a count parameter (e.g., "siphon=5")
        let actualBoostId = boostId;
        let count = 1;
        
        if (boostId.includes('=')) {
            const parts = boostId.split('=');
            actualBoostId = parts[0];
            count = parseInt(parts[1], 10);
            
            if (isNaN(count) || count <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid count parameter. Count must be a positive number.'
                });
            }
        }
        
        // Process the boost removal multiple times based on count
        const results = [];
        let finalResult = null;
        let removedCount = 0;
        
        for (let i = 0; i < count; i++) {
            const result = await removeBoostFromUser(userId, actualBoostId);
            
            // If one removal fails, stop the process
            if (!result.success) {
                finalResult = result;
                break;
            }
            
            results.push(result);
            finalResult = result; // Keep the last result
            removedCount++;
            
            // If the boost was completely removed (not just decremented), stop the process
            if (result.data.removed_boost) {
                break;
            }
        }
        
        // If we removed multiple boosts, customize the response
        if (count > 1 && removedCount > 0) {
            res.status(200).json({
                success: true,
                message: `Removed ${removedCount} ${actualBoostId} boosts from user`,
                data: {
                    operations_performed: removedCount,
                    final_state: finalResult.data
                }
            });
        } else {
            // For single boost or if we encountered an error, return the standard response
            if (finalResult.success) {
                res.status(200).json(finalResult);
            } else {
                res.status(400).json(finalResult);
            }
        }
    } catch (error) {
        console.error('Error removing boost from user:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing boost from user',
            error: error.message
        });
    }
});

// Add currency routes

// Get user's currency
router.get('/:userId/currency', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await currencyService.getUserCurrency(userId);
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error fetching user currency:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user currency',
            error: error.message
        });
    }
});

// Add or remove currency with array of operations - must be defined BEFORE the /:currencyType route
router.post('/:userId/currency', async (req, res) => {
    try {
        const { userId } = req.params;
        const { operations } = req.body;
        
        // Validate operations
        if (!operations) {
            return res.status(400).json({
                success: false,
                message: 'Currency operations are required'
            });
        }
        
        const result = await currencyService.processCurrencyOperations(userId, operations);
        
        if (result.success) {
            // Check if any operation failed
            const failedOps = result.data.operations_results.filter(op => !op.success);
            if (failedOps.length > 0) {
                // If any operation failed, return with details
                return res.status(400).json({
                    success: false,
                    message: "Some currency operations failed",
                    data: {
                        failed_operations: failedOps,
                        successful_operations: result.data.operations_results.filter(op => op.success),
                        current_currency: result.data.current_currency
                    }
                });
            }
            
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error processing currency operations:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing currency operations',
            error: error.message
        });
    }
});

// Add simple endpoint for adding single currency type
router.post('/:userId/currency/:currencyType', async (req, res) => {
    try {
        const { userId, currencyType } = req.params;
        const { amount } = req.body;
        
        // Validate amount
        if (amount === undefined || isNaN(parseInt(amount))) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }
        
        // Create operation array with single operation
        const operations = [
            {
                type: currencyType,
                amount: parseInt(amount)
            }
        ];
        
        const result = await currencyService.processCurrencyOperations(userId, operations);
        
        if (result.success) {
            // Extract the result for this specific currency for cleaner response
            const opResult = result.data.operations_results[0];
            
            // Check if the operation itself was successful
            if (!opResult.success) {
                // If the operation failed (e.g., insufficient funds), return appropriate error
                return res.status(400).json({
                    success: false,
                    message: opResult.message,
                    data: {
                        currency_type: opResult.type,
                        current_value: opResult.current_value
                    }
                });
            }
            
            res.status(200).json({
                success: true,
                message: opResult.message || `${currencyType} ${amount >= 0 ? 'added' : 'removed'} successfully`,
                data: {
                    currency_type: opResult.type,
                    previous_value: opResult.previous_value,
                    current_value: opResult.current_value,
                    change: opResult.change,
                    max_value: opResult.max_value
                }
            });
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error updating currency:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating currency',
            error: error.message
        });
    }
});

// Utility endpoint to sync gold values across all users
router.post('/sync-gold', async (req, res) => {
    try {
        const result = await currencyService.syncGoldValues();
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error syncing gold values:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing gold values',
            error: error.message
        });
    }
});

// Purchase gold or arcane energy with gems
router.post('/:userId/purchase', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type, gems } = req.body;
        
        // Validate inputs
        if (!type || !['gold', 'arcane_energy'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Purchase type must be 'gold' or 'arcane_energy'"
            });
        }
        
        if (!gems || isNaN(parseInt(gems)) || parseInt(gems) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid positive gem amount is required"
            });
        }
        
        // Process the purchase
        const result = await currencyService.purchaseWithGems(userId, type, parseInt(gems));
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error processing purchase:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing purchase',
            error: error.message
        });
    }
});

module.exports = router;