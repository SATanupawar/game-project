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
    removeBoostFromUser,
    getCreatureInventory,
    speedUpCreatureUnlock
} = require('../service/userService');
const mongoose = require('mongoose');
const User = require('../models/user');
const UserLevel = require('../models/userLevel');
const Boost = require('../models/boost');

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
            trophies, gold_coins, buildingId, creatureName, fcmToken 
        } = req.body;
        
        console.log(`Creating new user with ID: ${userId}`);

        // Get required models
        const User = require('../models/user');
        const Building = require('../models/building');
        const Creature = require('../models/creature');
        // Get BattlePass model for rewards
        const BattlePass = require('../models/battlePass');

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
            // If user exists and FCM token is provided, update it
            if (fcmToken) {
                existingUser.fcmToken = fcmToken;
                await existingUser.save();
            }
            
            // Process the user data before sending it back
            const processedData = userService.processUserResponse ? 
                userService.processUserResponse(existingUser) : existingUser;
            
            // Get current active battlepass for rewards
            const currentBattlePass = await BattlePass.getCurrentActiveBattlePass();
            if (currentBattlePass) {
                // Add battlepass rewards to the response
                processedData.battlepass_rewards = {
                    free_rewards: currentBattlePass.free_rewards || [],
                    elite_rewards: currentBattlePass.elite_rewards || []
                };
            }
            
            return res.status(200).json({
                success: true,
                message: 'User already exists, returning existing data',
                data: processedData,
                existing: true
            });
        }

        // Create a new user
        const user = new User({
            userId: userId,
            user_name: user_name,
            fcmToken: fcmToken || null,
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
            },
            rumble_construction_area: user.rumble_construction_area || [],
            clear_rumble: user.clear_rumble || []
        };

        // Get current active battlepass for rewards
        const currentBattlePass = await BattlePass.getCurrentActiveBattlePass();
        if (currentBattlePass) {
            // Add battlepass rewards to the response
            userData.battlepass_rewards = {
                free_rewards: currentBattlePass.free_rewards || [],
                elite_rewards: currentBattlePass.elite_rewards || []
            };
        }

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

        // Get the User model
        const User = require('../models/user');
        // Get BattlePass model for rewards
        const BattlePass = require('../models/battlePass');
        
        // Find the user directly
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Process the user data before sending it
        const processedData = userService.processUserResponse(user);
        
        // Get current active battlepass for rewards
        const currentBattlePass = await BattlePass.getCurrentActiveBattlePass();
        if (currentBattlePass) {
            // Add battlepass rewards to the response
            processedData.battlepass_rewards = {
                free_rewards: currentBattlePass.free_rewards || [],
                elite_rewards: currentBattlePass.elite_rewards || []
            };
        }
        
        // Return the user data with simplified stats
        res.status(200).json({
            success: true,
            message: 'User details fetched successfully',
            data: processedData
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            success: false,
            message: error.message || 'Error fetching user details'
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
            },
            rumble_construction_area: user.rumble_construction_area || [],
            clear_rumble: user.clear_rumble || []
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
        
        // The result from updateBuildingCreatureLevel already has the success, message structure
        res.status(200).json(result);
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

// Get user buildings with creatures
router.get('/:userId/buildings', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching buildings for user: ${userId}`);
        
        // Use the enhanced getUserBuildings function
        const result = await userService.getUserBuildings(userId);
        
        // Return the response
        res.status(200).json({
            success: true,
            message: `User buildings (${result.buildings.length}) fetched successfully`,
            data: result
        });
    } catch (error) {
        console.error('Error fetching user buildings:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            success: false,
            message: error.message || 'Error fetching user buildings'
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

router.delete('/:userId/buildings/:buildingIndex/creatures/:creatureId', async (req, res) => {
    try {
        const { userId, buildingIndex, creatureId } = req.params;
        console.log(`Deleting creature ${creatureId} from building ${buildingIndex} for user ${userId}`);

        // Call the service function to delete the creature from the building
        const result = await deleteCreatureFromBuilding(userId, buildingIndex, creatureId);
        
        // Return the result
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error deleting creature from building:', error);
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
        
        // If successful, use the EXACT same data from added creatures for battle_selected_creatures
        if (result.success && result.data.added && result.data.added.length > 0) {
            // Simply use the same exact data from 'added' for 'battle_selected_creatures'
            result.data.battle_selected_creatures = result.data.added.map(creature => ({
                _id: creature._id,
                name: creature.name,
                level: creature.level,
                type: creature.type,
                attack: creature.attack,
                health: creature.health,
                speed: creature.speed,
                armor: creature.armor,
                critical_damage: creature.critical_damage,
                critical_damage_percentage: creature.critical_damage_percentage,
                creature_type: creature.creature_type,
                image: creature.image,
                description: creature.description
            }));
            
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
        let user = await User.findOne({ userId })
            .populate({
                path: 'battle_selected_creatures.creature_id',
                select: 'speed armor critical_damage critical_damage_percentage creature_Id_reference image description'
            });
        
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
        
        // Format and return the battle creatures with enhanced details
        const battleCreatures = user.battle_selected_creatures.map(creature => {
            // Get the populated creature document if available
            const creatureDetails = creature.creature_id && typeof creature.creature_id === 'object' ? 
                creature.creature_id : {};
            
            // Try to find the full creature in the user's creatures
            const fullCreature = user.creatures && user.creatures.length > 0 ?
                user.creatures.find(c => 
                    c._id && creature.creature_id && 
                    c._id.toString() === creature.creature_id.toString()
                ) : null;
            
            // If we found the full creature in user's collection, use its exact values
            if (fullCreature) {
                return {
                    _id: creature.creature_id?._id || creature.creature_id,
                    name: fullCreature.name || creature.name,
                    level: fullCreature.level || creature.level,
                    type: fullCreature.type || creature.type,
                    attack: fullCreature.attack || creature.attack,
                    health: fullCreature.health || creature.health,
                    speed: fullCreature.speed,
                    armor: fullCreature.armor,
                    critical_damage: fullCreature.critical_damage,
                    critical_damage_percentage: fullCreature.critical_damage_percentage,
                    creature_type: fullCreature.creature_type,
                    image: fullCreature.image,
                    description: fullCreature.description
                };
            }
            
            // Otherwise, use whatever data is available
            return {
                _id: creature.creature_id?._id || creature.creature_id,
                name: creature.name,
                level: creature.level,
                type: creature.type,
                attack: creature.attack,
                health: creature.health,
                speed: creature.speed || creatureDetails.speed || 120,
                armor: creature.armor || creatureDetails.armor || 10,
                critical_damage: creature.critical_damage || creatureDetails.critical_damage || 100,
                critical_damage_percentage: creature.critical_damage_percentage || creatureDetails.critical_damage_percentage || 5,
                creature_type: creature.creature_type || creatureDetails.creature_type || "Beast",
                image: creature.image || creatureDetails.image || null,
                description: creature.description || creatureDetails.description || null
            };
        });
        
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
            
            // Track quest progress if gold is being spent
            if (currencyType === 'gold' && amount < 0) {
                try {
                    // Import quest service
                    const questService = require('../service/questService');
                    
                    // Track gold spending for quest progress
                    await questService.trackQuestProgress(userId, 'spend_gold', {
                        amount: Math.abs(amount)
                    });
                    
                    console.log(`Tracked spend_gold quest progress for user ${userId}, amount: ${Math.abs(amount)}`);
                } catch (questError) {
                    console.error('Error updating quest progress for spend_gold:', questError);
                    // Continue with response even if quest tracking fails
                }
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
            // Track quest progress for spending gems
            try {
                // Import quest service
                const questService = require('../service/questService');
                
                // Update quest progress for spending gems
                await questService.trackQuestProgress(userId, 'spend_gems', {
                    amount: parseInt(gems),
                    purchase_type: type
                });
                
                console.log(`Tracked spend_gems quest progress for user ${userId}, amount: ${gems}`);
            } catch (questError) {
                console.error('Error updating quest progress for spend_gems:', questError);
                // Continue with response even if quest tracking fails
            }
            
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

// Update user creatures to match new dragon types
router.get('/:userId/update-creatures-to-dragons', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Updating creatures for user: ${userId} to new dragons`);
        
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
        
        // Get all available creature templates
        const dragonTemplates = await Creature.find({});
        console.log(`Found ${dragonTemplates.length} dragon templates`);
        
        if (dragonTemplates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No dragon templates found in database'
            });
        }
        
        // Initialize creatures array if needed
        if (!user.creatures) {
            user.creatures = [];
            console.log('Initialized empty creatures array');
        }
        
        // Track updated creatures
        const updatedCreatures = [];
        
        // For each user creature, update it to match a dragon type of similar rarity
        for (let i = 0; i < user.creatures.length; i++) {
            const userCreature = user.creatures[i];
            const oldType = userCreature.type || 'common';
            
            // Find a matching dragon by type (rarity)
            const matchingDragon = dragonTemplates.find(dragon => dragon.type === oldType);
            
            // If no matching type, use first available dragon
            const targetDragon = matchingDragon || dragonTemplates[0];
            
            // Keep the creature's building assignment and level
            const creatureLevel = userCreature.level || 1;
            const buildingIndex = userCreature.building_index;
            
            // Update creature with new dragon attributes but keep the level and building
            user.creatures[i] = {
                _id: userCreature._id,
                creature_id: targetDragon._id,
                creature_type: targetDragon.creature_Id,
                name: targetDragon.name,
                type: targetDragon.type,
                level: creatureLevel,
                building_index: buildingIndex,
                base_attack: targetDragon.base_attack,
                base_health: targetDragon.base_health,
                attack: targetDragon.level_stats.find(stat => stat.level === creatureLevel)?.attack || targetDragon.base_attack,
                health: targetDragon.level_stats.find(stat => stat.level === creatureLevel)?.health || targetDragon.base_health,
                gold_coins: targetDragon.gold_coins,
                arcane_energy: targetDragon.arcane_energy,
                image: targetDragon.image,
                description: targetDragon.description,
                count: userCreature.count || 1
            };
            
            updatedCreatures.push({
                old: {
                    id: userCreature._id,
                    type: oldType
                },
                new: {
                    id: user.creatures[i]._id,
                    name: user.creatures[i].name,
                    type: user.creatures[i].type,
                    level: user.creatures[i].level
                }
            });
        }
        
        // Save the user with updated creatures
        await user.save();
        
        res.status(200).json({
            success: true,
            message: `Updated ${updatedCreatures.length} creatures for user ${userId}`,
            updatedCreatures: updatedCreatures
        });
    } catch (error) {
        console.error('Error updating user creatures to dragons:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user creatures',
            error: error.message
        });
    }
});

// Add a new rumble construction area
router.post('/:userId/rumble-construction', async (req, res) => {
    try {
        const { userId } = req.params;
        let { x, y, timeInMinutes } = req.body;
        
        console.log(`Request body for rumble-construction:`, JSON.stringify(req.body));
        console.log(`Raw parameter types - x: ${typeof x}, y: ${typeof y}, timeInMinutes: ${typeof timeInMinutes}`);
        console.log(`Raw values - x: ${x}, y: ${y}, timeInMinutes: ${timeInMinutes}`);
        
        // Validate parameters
        if (x === undefined || y === undefined || timeInMinutes === undefined) {
            return res.status(400).json({
                success: false,
                message: 'x, y coordinates and timeInMinutes are required'
            });
        }
        
        // Convert to numbers more aggressively
        // Parse to ensure they are numbers, handling strings or numbers
        const parsedX = Number(x);
        const parsedY = Number(y);
        const parsedTime = Number(timeInMinutes);
        
        console.log(`Parsed parameter values - x: ${parsedX}, y: ${parsedY}, timeInMinutes: ${parsedTime}`);
        
        if (isNaN(parsedX) || isNaN(parsedY) || isNaN(parsedTime)) {
            return res.status(400).json({
                success: false,
                message: 'x, y coordinates and timeInMinutes must be valid numbers'
            });
        }
        
        if (parsedTime <= 0) {
            return res.status(400).json({
                success: false,
                message: 'timeInMinutes must be a positive number'
            });
        }
        
        // Call the service function with the EXACT parsed values
        console.log(`Calling addRumbleConstructionArea with exact time: ${parsedTime} minutes`);
        const result = await userService.addRumbleConstructionArea(userId, { x: parsedX, y: parsedY }, parsedTime);
        
        console.log(`Result from addRumbleConstructionArea:`, JSON.stringify(result));
        console.log(`Time in minutes from result: ${result.time_in_minutes}`);
        
        res.status(200).json({
            success: true,
            message: 'Rumble construction area added successfully',
            data: result
        });
    } catch (error) {
        console.error('Error adding rumble construction area:', error);
        
        // Determine appropriate status code
        let statusCode = 500;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('already') || 
                   error.message.includes('Valid coordinates') ||
                   error.message.includes('Valid timeInMinutes')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Check status of a rumble construction area
router.get('/:userId/rumble-construction', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get coordinates from either query parameters or request body
        let coordinates = {};
        
        console.log(`Request query parameters:`, JSON.stringify(req.query));
        console.log(`Request body:`, JSON.stringify(req.body));
        
        // Check if coordinates are in query parameters
        if (req.query.x !== undefined && req.query.y !== undefined) {
            coordinates = {
                x: Number(req.query.x),
                y: Number(req.query.y)
            };
        } 
        // Check if coordinates are in request body
        else if (req.body.x !== undefined && req.body.y !== undefined) {
            coordinates = {
                x: Number(req.body.x),
                y: Number(req.body.y)
            };
        } else {
            return res.status(400).json({
                success: false,
                message: 'x and y coordinates must be provided either in query parameters or request body'
            });
        }
        
        console.log(`Checking rumble construction area for user ${userId} at coordinates (${coordinates.x}, ${coordinates.y})`);
        console.log(`Parsed coordinates - x: ${coordinates.x}, y: ${coordinates.y}`);
        
        if (isNaN(coordinates.x) || isNaN(coordinates.y)) {
            return res.status(400).json({
                success: false,
                message: 'x and y coordinates must be valid numbers'
            });
        }
        
        // Call the service function
        const result = await userService.checkRumbleConstructionArea(userId, coordinates);
        
        res.status(200).json({
            success: true,
            message: `Rumble construction area status: ${result.status}`,
            data: result
        });
    } catch (error) {
        console.error('Error checking rumble construction area:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 500;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('Valid coordinates')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get all rumble construction and cleared areas
router.get('/:userId/rumble-areas', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Getting rumble areas for user: ${userId}`);
        
        const rumbleAreas = await userService.getUserRumbleAreas(userId);
        
        res.status(200).json({
            success: true,
            message: `Retrieved ${rumbleAreas.constructionAreas.length} construction areas and ${rumbleAreas.clearedAreas.length} cleared areas`,
            data: rumbleAreas
        });
    } catch (error) {
        console.error('Error getting rumble areas:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 500;
        if (error.message.includes('not found')) {
            statusCode = 404;
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Clear a completed rumble construction area
router.post('/:userId/rumble-areas/clear', async (req, res) => {
    try {
        const { userId } = req.params;
        let { x, y } = req.body;
        
        if (x === undefined || y === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Coordinates (x, y) are required'
            });
        }
        
        console.log(`Request body for rumble-areas/clear:`, JSON.stringify(req.body));
        console.log(`Raw parameter types - x: ${typeof x}, y: ${typeof y}`);
        console.log(`Clearing rumble construction area at (${x}, ${y}) for user: ${userId}`);
        
        // Parse x and y to ensure they are numbers
        const parsedX = Number(x);
        const parsedY = Number(y);
        
        console.log(`Parsed parameter values - x: ${parsedX}, y: ${parsedY}`);
        
        if (isNaN(parsedX) || isNaN(parsedY)) {
            return res.status(400).json({
                success: false,
                message: 'Coordinates must be valid numbers'
            });
        }
        
        const result = await userService.clearRumbleConstructionArea(userId, parsedX, parsedY);
        
        res.status(200).json({
            success: true,
            message: 'Rumble construction area cleared successfully',
            data: result
        });
    } catch (error) {
        console.error('Error clearing rumble construction area:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 500;
        if (error.message.includes('not found')) {
            statusCode = 404;
        } else if (error.message.includes('not yet complete') || 
                   error.message.includes('No construction area found')) {
            statusCode = 400;
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Check building construction status
router.get('/:userId/building-construction', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Checking building construction status for user: ${userId}`);
        
        const result = await userService.checkBuildingConstructionStatus(userId);
        
        // Clean up the response to remove Mongoose-specific properties
        const cleanResponse = {
            success: true,
            message: result.message || 'Building construction status checked',
            data: {
                buildings_under_construction: result.data?.buildings_under_construction?.map(building => ({
                    buildingId: building.buildingId,
                    name: building.name,
                    gold_coins: building.gold_coins,
                    position: building.position,
                    size: building.size,
                    index: building.index,
                    started_time: building.started_time,
                    finished_time: building.finished_time,
                    remaining_minutes: building.remaining_minutes,
                    construction_completed: building.construction_completed
                })) || [],
                completed_buildings: result.data?.completed_buildings?.map(building => ({
                    buildingId: building.buildingId,
                    name: building.name,
                    gold_coins: building.gold_coins,
                    position: building.position,
                    size: building.size,
                    index: building.index,
                    reserveCoins: building.reserveCoins,
                    last_collected: building.last_collected,
                    construction_completed: building.construction_completed
                })) || []
            }
        };
        
        res.status(200).json(cleanResponse);
    } catch (error) {
        console.error('Error checking building construction status:', error);
        
        // Determine appropriate status code based on error message
        let statusCode = 500;
        if (error.message.includes('not found')) {
            statusCode = 404;
        }
        
        res.status(statusCode).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Cleanup building construction data
router.post('/:userId/building-construction/cleanup', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Cleaning up building construction data for user: ${userId}`);
        
        const User = require('../models/user');
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Save original count
        const originalCount = user.building_construction ? user.building_construction.length : 0;
        
        // Filter out incomplete building construction entries
        user.building_construction = user.building_construction.filter(building => 
            building.buildingId && 
            building.name && 
            building.position && 
            building.position.x && 
            building.position.y && 
            building.size && 
            building.size.x && 
            building.size.y && 
            building.index && 
            building.started_time && 
            building.finished_time
        );
        
        // Save the updated user
        await user.save();
        
        const newCount = user.building_construction.length;
        
        res.status(200).json({
            success: true,
            message: `Cleaned up building construction data. Removed ${originalCount - newCount} invalid entries.`,
            data: {
                previousCount: originalCount,
                currentCount: newCount,
                buildings: user.building_construction.map(b => ({
                    buildingId: b.buildingId,
                    name: b.name,
                    position: b.position,
                    index: b.index
                }))
            }
        });
    } catch (error) {
        console.error('Error cleaning up building construction data:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Add specific buildings from construction array to user buildings
router.post('/:userId/building-construction', async (req, res) => {
    try {
        const { userId } = req.params;
        const { buildingIndexes } = req.body;
        
        console.log(`Processing specific buildings from construction for user: ${userId}`, buildingIndexes);
        
        // Validate input
        if (!buildingIndexes || !Array.isArray(buildingIndexes)) {
            return res.status(400).json({
                success: false,
                message: 'Building indexes must be provided as an array'
            });
        }
        
        const User = require('../models/user');
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        if (!user.building_construction || user.building_construction.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No buildings under construction'
            });
        }
        
        const currentTime = new Date();
        const completedBuildings = [];
        const remainingConstructions = [];
        const notFoundIndexes = [];
        const notCompletedIndexes = [];
        
        // Process each building in construction array
        user.building_construction.forEach(building => {
            // Check if this building's index is in the requested indexes
            if (buildingIndexes.includes(building.index)) {
                // Check if construction is complete
                if (building.finished_time <= currentTime) {
                    // Add to completed buildings for user
                    const completedBuilding = {
                        ...building.toObject(),
                        reserveCoins: 0,
                        last_collected: new Date()
                    };
                    
                    // Remove construction-specific fields
                    delete completedBuilding.started_time;
                    delete completedBuilding.finished_time;
                    
                    // Add to user's buildings array
                    user.buildings.push(completedBuilding);
                    completedBuildings.push(completedBuilding);
                } else {
                    // Building is in the list but not completed yet
                    remainingConstructions.push(building);
                    notCompletedIndexes.push(building.index);
                }
            } else {
                // Not in requested list, keep in construction array
                remainingConstructions.push(building);
            }
        });
        
        // Find indexes that weren't found in the construction array
        buildingIndexes.forEach(index => {
            const found = user.building_construction.some(b => b.index === index);
            if (!found) {
                notFoundIndexes.push(index);
            }
        });
        
        // Update the user's building_construction array
        user.building_construction = remainingConstructions;
        
        // Save the updated user
        await user.save();
        
        res.status(200).json({
            success: true,
            message: `Processed ${completedBuildings.length} buildings from construction`,
            data: {
                completedBuildings,
                notCompletedIndexes,
                notFoundIndexes,
                remainingConstructions: remainingConstructions.length
            }
        });
    } catch (error) {
        console.error('Error processing buildings from construction:', error);
        
        res.status(500).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Get all user creatures
router.get('/:userId/creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Find the user
        const User = require('../models/user');
        const user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'User creatures fetched successfully',
            data: {
                creatures: user.creatures || [],
                count: user.creatures ? user.creatures.length : 0
            }
        });
    } catch (error) {
        console.error('Error fetching user creatures:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user creatures',
            error: error.message
        });
    }
});

// Add this route after other user routes
router.post('/users/:userId/migrate-locked-creatures', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find the user
    const user = await User.findOne({ userId: userId });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log(`Found user ${user.user_name} with ${user.locked_creatures ? user.locked_creatures.length : 0} locked creatures`);
    
    // If there are no locked creatures, return early
    if (!user.locked_creatures || user.locked_creatures.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No locked creatures to migrate',
        migrated: 0 
      });
    }
    
    const migrationCount = user.locked_creatures.length;
    
    // Make sure the creatures array exists
    if (!user.creatures) {
      user.creatures = [];
    }
    
    // Migrate each locked creature
    for (const lockedCreature of user.locked_creatures) {
      const creatureId = new mongoose.Types.ObjectId();
      const newCreature = {
        _id: creatureId,
        creature_id: creatureId,
        name: lockedCreature.name,
        creature_type: lockedCreature.creature_type || lockedCreature.name.toLowerCase().replace(/\s+/g, '_'),
        level: lockedCreature.level || 1,
        building_index: 0, // Default building index
        base_attack: 50,
        base_health: 300,
        attack: 50,
        health: 300,
        gold_coins: 0,
        count: 1
      };
      
      // Add to the main creatures array
      user.creatures.push(newCreature);
    }
    
    // Clear the locked_creatures array
    user.locked_creatures = [];
    
    // Mark modified fields
    user.markModified('creatures');
    user.markModified('locked_creatures');
    
    // Save the user
    await user.save();
    
    // Return success
    return res.json({
      success: true,
      message: `Successfully migrated ${migrationCount} locked creatures`,
      migrated: migrationCount
    });
    
  } catch (error) {
    console.error('Error migrating locked creatures:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * @route POST /api/users/:userId/migrate-locked-creatures
 * @description Migrate a user's locked_creatures to their main creatures array
 * @access Public
 */
router.post('/:userId/migrate-locked-creatures', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find the user by userId or _id
    let user;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }
    
    if (!user) {
      user = await User.findOne({ userId: userId });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    console.log(`Found user ${user.user_name} with ${user.locked_creatures ? user.locked_creatures.length : 0} locked creatures`);
    
    // If there are no locked creatures, return early
    if (!user.locked_creatures || user.locked_creatures.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No locked creatures to migrate',
        migrated: 0 
      });
    }
    
    const migrationCount = user.locked_creatures.length;
    
    // Make sure the creatures array exists
    if (!user.creatures) {
      user.creatures = [];
    }
    
    // Migrate each locked creature
    for (const lockedCreature of user.locked_creatures) {
      const creatureId = new mongoose.Types.ObjectId();
      const newCreature = {
        _id: creatureId,
        creature_id: creatureId,
        name: lockedCreature.name,
        creature_type: lockedCreature.creature_type || lockedCreature.name.toLowerCase().replace(/\s+/g, '_'),
        level: lockedCreature.level || 1,
        building_index: 0, // Default building index
        base_attack: 50,
        base_health: 300,
        attack: 50,
        health: 300,
        gold_coins: 0,
        count: 1
      };
      
      // Add to the main creatures array
      user.creatures.push(newCreature);
    }
    
    // Clear the locked_creatures array
    user.locked_creatures = [];
    
    // Mark modified fields
    user.markModified('creatures');
    user.markModified('locked_creatures');
    
    // Save the user
    await user.save();
    
    // Return success
    return res.json({
      success: true,
      message: `Successfully migrated ${migrationCount} locked creatures`,
      migrated: migrationCount,
      total_creatures: user.creatures.length
    });
    
  } catch (error) {
    console.error('Error migrating locked creatures:', error);
    return res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Add XP to user with carryover logic
router.post('/:userId/add-xp', async (req, res) => {
    try {
        const { userId } = req.params;
        const { xp_amount } = req.body;

        if (!xp_amount || xp_amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid XP amount. Must be greater than 0.'
            });
        }

        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Calculate total XP after addition
        const totalXP = user.xp + xp_amount;

        // Get current level data
        const currentLevelData = await UserLevel.findOne({ level: user.level });
        if (!currentLevelData) {
            return res.status(500).json({
                success: false,
                message: 'Error: Current level data not found'
            });
        }

        // Get next level data
        const nextLevelData = await UserLevel.findOne({ level: user.level + 1 });
        
        // Check if we have enough XP for next level
        let newLevel = user.level;
        let remainingXP = totalXP;
        let levelsGained = 0;

        if (nextLevelData && totalXP >= nextLevelData.required_xp) {
            // We have enough XP for next level
            newLevel = nextLevelData.level;
            remainingXP = totalXP - nextLevelData.required_xp;
            levelsGained = 1;
        }

        // Update user's level and XP
        user.level = newLevel;
        user.xp = remainingXP;

        // Calculate progress to next level
        let levelCompletionPercentage = 0;
        let xpNeededForNextLevel = 0;
        
        if (nextLevelData) {
            const xpRange = nextLevelData.required_xp - currentLevelData.required_xp;
            levelCompletionPercentage = Math.floor((remainingXP / xpRange) * 100);
            xpNeededForNextLevel = nextLevelData.required_xp - (currentLevelData.required_xp + remainingXP);
        }

        // AUTOMATICALLY ADD SAME XP TO BATTLE PASS
        // Import the battle pass service
        const directBattlePassService = require('../service/directBattlePassService');
        
        // Add XP to battle pass (synchronously to include in response)
        let battlePassResult = null;
        try {
            battlePassResult = await directBattlePassService.addUserBattlePassXP(userId, xp_amount, 'user_xp_sync');
            if (!battlePassResult.success) {
                console.error('Failed to sync XP to battle pass:', battlePassResult.message);
            }
        } catch (error) {
            console.error('Error syncing XP to battle pass:', error);
        }

        // Save the updated user
        await user.save();

        // Prepare response
        const response = {
            success: true,
            message: levelsGained > 0 ? 
                `Level up! Reached level ${user.level}` : 
                `XP added successfully`,
            data: {
                user_id: userId,
                previous_level: user.level - levelsGained,
                current_level: user.level,
                levels_gained: levelsGained,
                xp_added: xp_amount,
                total_xp: totalXP,
                remaining_xp: remainingXP
            }
        };

        // Add battle pass progress to response if available
        if (battlePassResult && battlePassResult.success) {
            try {
                // Handle claimed rewards formatting
                let claimedRewardsData = {
                    free: [],
                    elite: []
                };
                
                if (battlePassResult.data.claimed_rewards) {
                    if (battlePassResult.data.claimed_rewards.free && 
                        Array.isArray(battlePassResult.data.claimed_rewards.free) && 
                        battlePassResult.data.claimed_rewards.elite && 
                        Array.isArray(battlePassResult.data.claimed_rewards.elite)) {
                        // It's already in the proper format with free/elite arrays
                        claimedRewardsData = {
                            free: battlePassResult.data.claimed_rewards.free,
                            elite: battlePassResult.data.claimed_rewards.elite
                        };
                    } else if (Array.isArray(battlePassResult.data.claimed_rewards)) {
                        // Convert from array to object with free/elite arrays
                        const claimedRewards = battlePassResult.data.claimed_rewards || [];
                        claimedRewardsData.free = claimedRewards.filter(reward => !reward.is_elite);
                        claimedRewardsData.elite = claimedRewards.filter(reward => reward.is_elite);
                    }
                }
                
                // Add battle pass progress to response
                response.data.battle_pass = {
                    current_level: battlePassResult.data.current_level || battlePassResult.data.battle_pass?.current_level,
                    xp_added: xp_amount,
                    leveled_up: battlePassResult.data.leveled_up || battlePassResult.data.battle_pass?.leveled_up || false,
                    current_level_progress: battlePassResult.data.current_level_progress || battlePassResult.data.battle_pass?.current_level_progress || {
                        xp_required: 0,
                        xp_earned: 0,
                        xp_remaining: 0,
                        progress_percentage: 0
                    }
                };
                
                // Only add claimed_rewards if there are any
                if (claimedRewardsData.free.length > 0 || claimedRewardsData.elite.length > 0) {
                    response.data.battle_pass.claimed_rewards = claimedRewardsData;
                }
                
                // Add reward info if present
                if (battlePassResult.data.reward) {
                    response.data.battle_pass.reward = battlePassResult.data.reward;
                }
                
                // Add level up info if present
                if (battlePassResult.data.level_up) {
                    response.data.battle_pass.level_up = battlePassResult.data.level_up;
                }
            } catch (error) {
                console.error('Error formatting battle pass response:', error);
            }
        }

        res.status(200).json(response);

    } catch (error) {
        console.error('Error in add-xp route:', error);
        res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Get user level information
router.get('/:userId/level-info', async (req, res) => {
    try {
        const { userId } = req.params;

        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get current level data
        const currentLevelData = await UserLevel.findOne({ level: user.level });
        if (!currentLevelData) {
            return res.status(500).json({
                success: false,
                message: 'Error: Current level data not found'
            });
        }

        // Get next level data
        const nextLevelData = await UserLevel.findOne({ level: user.level + 1 });

        // Calculate progress to next level
        let xpNeededForNextLevel = 0;
        if (nextLevelData) {
            const xpForCurrentLevel = newLevelData.required_xp;
            const xpForNextLevel = nextLevelData.required_xp;
            xpNeededForNextLevel = xpForNextLevel - (xpForCurrentLevel + user.xp);
        }

        res.status(200).json({
            success: true,
            data: {
                user_id: userId,
                current_level: user.level,
                current_xp: user.xp,
                total_xp: currentLevelData.required_xp + user.xp,
                next_level_xp: nextLevelData ? nextLevelData.required_xp : null,
                xp_to_next_level: nextLevelData ? 
                    nextLevelData.required_xp - (currentLevelData.required_xp + user.xp) : 0,
                progress: {
                    current_xp: user.xp,
                    next_level_xp: nextLevelData ? nextLevelData.required_xp : null,
                    xp_needed_for_next_level: xpNeededForNextLevel
                }
            }
        });

    } catch (error) {
        console.error('Error in level-info route:', error);
        res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Add this route after the other building-creature related routes

// Fix building-creature relationships
router.post('/:userId/fix-building-creatures', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fixing building-creature relationships for user ${userId}`);
        
        const result = await fixBuildingCreatureRelationships(userId);
        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error fixing building-creature relationships:', error);
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
});

// Get user's battlepass information
router.get('/:userId/battlepass', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`Fetching battlepass details for user: ${userId}`);

        // Get required models
        const User = require('../models/user');
        const BattlePass = require('../models/battlePass');
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get current active battlepass
        const currentBattlePass = await BattlePass.getCurrentActiveBattlePass();
        if (!currentBattlePass) {
            return res.status(404).json({
                success: false,
                message: 'No active battle pass found'
            });
        }
        
        // Get user's battlepass data
        const userBattlePass = user.battlePassSummary || {};
        
        // Separate claimed rewards into free and elite categories
        const claimedRewards = userBattlePass.claimed_rewards || [];
        const claimedFreeRewards = claimedRewards.filter(reward => !reward.is_elite);
        const claimedEliteRewards = claimedRewards.filter(reward => reward.is_elite);
        
        // Format response
        const battlePassData = {
            name: currentBattlePass.name,
            description: currentBattlePass.description,
            start_date: currentBattlePass.start_date,
            end_date: currentBattlePass.end_date,
            max_level: currentBattlePass.max_level,
            user_level: userBattlePass.current_level || 1,
            current_xp: userBattlePass.current_xp || 0,
            is_elite: userBattlePass.is_elite || false,
            leveled_up: false, // Default to false
            completed_levels: {
                count: userBattlePass.current_level > 1 ? userBattlePass.current_level - 1 : 0,
                levels: Array.from({length: Math.max(0, userBattlePass.current_level - 1)}, (_, i) => i + 1),
                total_xp_earned: userBattlePass.current_level > 1 ? 
                    currentBattlePass.level_thresholds.slice(0, userBattlePass.current_level - 1).reduce((sum, xp) => sum + xp, 0) : 0
            },
            current_level_progress: {
                xp_required: currentBattlePass.level_thresholds[userBattlePass.current_level - 1] || 500,
                xp_earned: userBattlePass.current_xp || 0,
                xp_remaining: Math.max(0, (currentBattlePass.level_thresholds[userBattlePass.current_level - 1] || 500) - (userBattlePass.current_xp || 0)),
                progress_percentage: Math.min(100, Math.floor(((userBattlePass.current_xp || 0) / (currentBattlePass.level_thresholds[userBattlePass.current_level - 1] || 500)) * 100))
            },
            uncollected_rewards: currentBattlePass.free_rewards
                .filter(reward => reward.level <= userBattlePass.current_level)
                .filter(reward => !claimedFreeRewards.some(claimed => claimed.level === reward.level))
                .map(reward => reward.level)
                .concat(
                    userBattlePass.is_elite ? 
                    currentBattlePass.elite_rewards
                        .filter(reward => reward.level <= userBattlePass.current_level)
                        .filter(reward => !claimedEliteRewards.some(claimed => claimed.level === reward.level))
                        .map(reward => reward.level) : []
                ),
            free_rewards: currentBattlePass.free_rewards || [],
            elite_rewards: currentBattlePass.elite_rewards || [],
            claimed_rewards: userBattlePass.claimed_rewards_formatted || {
                free: claimedFreeRewards,
                elite: claimedEliteRewards
            }
        };
        
        // Only add claimed_rewards if there are any
        if (claimedFreeRewards.length > 0 || claimedEliteRewards.length > 0) {
            battlePassData.claimed_rewards = {
                free: claimedFreeRewards,
                elite: claimedEliteRewards
            };
        }
        
        res.status(200).json({
            success: true,
            message: 'Battle pass details fetched successfully',
            data: battlePassData
        });
    } catch (error) {
        console.error('Error fetching battle pass details:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching battle pass details'
        });
    }
});

// Speed up creature unlock with gems
router.post('/:userId/creature/:creatureId/speedup', async (req, res) => {
    try {
        const { userId, creatureId } = req.params;
        console.log(`Request to speed up creature unlock for user ${userId}, creature ${creatureId}`);
        
        // Call the new service function
        const result = await speedUpCreatureUnlock(userId, creatureId);
        
        // Return the result
        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in creature speedup route:', error);
        res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Fix building-creature relationships

// At the end of the file, ensure only this line exists:
module.exports = router;

// Get all boosts in the database
router.get('/boosts/all', async (req, res) => {
    try {
        const boosts = await Boost.find({});
        res.status(200).json({
            success: true,
            boosts
        });
    } catch (err) {
        console.error('Error fetching boosts:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
});