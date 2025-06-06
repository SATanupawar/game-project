const express = require('express');
const router = express.Router();
const User = require('../models/user');
const ChestCard = require('../models/chestCard');
const mongoose = require('mongoose');

// Get all chests for current user
router.get('/mychests', async (req, res) => {
    try {
        // Get userId - either from query param or from URL path directly
        let userId = req.query.userId;
        
        // If no userId parameter was found, check if there's a query parameter without a value
        if (!userId) {
            // Get the first query parameter key if it exists
            const queryKeys = Object.keys(req.query);
            if (queryKeys.length > 0) {
                userId = queryKeys[0];
            }
        }
        
        if (!userId) {
            return res.status(400).json({ msg: 'User ID is required' });
        }
        
        // Find user by string userId field
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        res.json(user.chests);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get all available chest types
router.get('/types', async (req, res) => {
    try {
        const chestTypes = await ChestCard.find().select('-rewards');
        res.json(chestTypes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get all chests for a specific user by direct ID in URL
router.get('/mychests/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Find user by string userId field
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        res.json(user.chests);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Award a random chest to user
router.post('/award', async (req, res) => {
    try {
        const userId = req.body.userId;
        
        if (!userId) {
            return res.status(400).json({ msg: 'User ID is required' });
        }
        
        // Get all chest types
        const chestTypes = await ChestCard.find();
        
        if (chestTypes.length === 0) {
            return res.status(404).json({ msg: 'No chest types found' });
        }
        
        // Create weighted array based on drop chances
        const weightedChests = [];
        chestTypes.forEach(chest => {
            // Add chest to array dropChance number of times
            for (let i = 0; i < chest.drop_chance; i++) {
                weightedChests.push(chest);
            }
        });
        
        // Randomly select a chest from the weighted array
        const randomChest = weightedChests[Math.floor(Math.random() * weightedChests.length)];
        
        // Find user by string userId field instead of _id
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Add chest to user's inventory
        user.chests.push({
            chest_id: randomChest._id,
            name: randomChest.name,
            rarity: randomChest.rarity,
            unlock_time: new Date(Date.now() + randomChest.unlock_time_minutes * 60000),
            is_unlocked: false,
            is_claimed: false,
            obtained_at: new Date()
        });
        
        await user.save();
        
        res.json(user.chests[user.chests.length - 1]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Start unlocking a chest
router.put('/unlock/:chest_id', async (req, res) => {
    try {
        const userId = req.body.userId;
        
        if (!userId) {
            return res.status(400).json({ msg: 'User ID is required' });
        }
        
        // Find user by string userId field instead of _id
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Find the chest in user's inventory
        const chestIndex = user.chests.findIndex(chest => 
            chest._id.toString() === req.params.chest_id
        );
        
        if (chestIndex === -1) {
            return res.status(404).json({ msg: 'Chest not found in inventory' });
        }
        
        // Get the chest type
        const chestType = await ChestCard.findById(user.chests[chestIndex].chest_id);
        
        if (!chestType) {
            return res.status(404).json({ msg: 'Chest type not found' });
        }
        
        // Set unlock time
        user.chests[chestIndex].unlock_time = new Date(Date.now() + chestType.unlock_time_minutes * 60000);
        
        await user.save();
        
        res.json(user.chests[chestIndex]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Claim chest rewards
router.put('/claim/:chest_id', async (req, res) => {
    try {
        const userId = req.body.userId;
        
        if (!userId) {
            return res.status(400).json({ msg: 'User ID is required' });
        }
        
        // Find user by string userId field instead of _id
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Find the chest in user's inventory
        const chestIndex = user.chests.findIndex(chest => 
            chest._id.toString() === req.params.chest_id
        );
        
        if (chestIndex === -1) {
            return res.status(404).json({ msg: 'Chest not found in inventory' });
        }
        
        // Check if chest is unlocked
        const now = new Date();
        if (now < user.chests[chestIndex].unlock_time) {
            return res.status(400).json({ 
                msg: 'Chest is not yet unlocked',
                unlock_time: user.chests[chestIndex].unlock_time,
                now: now
            });
        }
        
        // Get the chest type
        const chestType = await ChestCard.findById(user.chests[chestIndex].chest_id);
        
        if (!chestType) {
            return res.status(404).json({ msg: 'Chest type not found' });
        }
        
        // Generate rewards
        const rewards = {
            coins: Math.floor(Math.random() * 
                (chestType.rewards.coins.max - chestType.rewards.coins.min + 1)) + 
                chestType.rewards.coins.min,
            gems: Math.floor(Math.random() * 
                (chestType.rewards.gems.max - chestType.rewards.gems.min + 1)) + 
                chestType.rewards.gems.min,
            cards: []
        };
        
        // Process cards rewards if any
        if (chestType.rewards.cards && chestType.rewards.cards.length > 0) {
            // For each card chance, determine if player gets the card
            chestType.rewards.cards.forEach(cardChance => {
                if (Math.random() * 100 < cardChance.chance) {
                    rewards.cards.push({
                        rarity: cardChance.rarity,
                        count: cardChance.count
                    });
                }
            });
        }
        
        // Update user resources
        user.gold_coins += rewards.coins;
        
        // Check if user has gems property
        if (user.gems !== undefined) {
            user.gems += rewards.gems;
        } else if (user.currency && user.currency.gems !== undefined) {
            user.currency.gems += rewards.gems;
        }
        
        // Mark chest as claimed
        user.chests[chestIndex].is_unlocked = true;
        user.chests[chestIndex].is_claimed = true;
        
        await user.save();
        
        res.json({
            chest: user.chests[chestIndex],
            rewards: rewards
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Get random chest card out of three options
router.post('/random-chest', async (req, res) => {
    try {
        const userId = req.body.userId;
        
        if (!userId) {
            return res.status(400).json({ msg: 'User ID is required' });
        }
        
        // Find user by string userId field
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Check if user already has maximum number of chests (4)
        const MAX_CHESTS = 4;
        if (user.chests && user.chests.length >= MAX_CHESTS) {
            return res.status(400).json({ 
                msg: "Maximum chest limit reached",
                current: user.chests.length,
                max: MAX_CHESTS
            });
        }
        
        // Get all chest types
        const chestTypes = await ChestCard.find();
        
        if (chestTypes.length < 1) {
            return res.status(404).json({ msg: 'No chest types found' });
        }
        
        // Find chests by type
        let commonChest = chestTypes.find(chest => chest.type === 'common');
        let rareChest = chestTypes.find(chest => chest.type === 'rare');
        let epicChest = chestTypes.find(chest => chest.type === 'epic');
        
        // Use direct probability approach - 75% common, 20% rare, 5% epic
        const randomValue = Math.random() * 100; // 0-100
        let selectedChest = null;
        
        // Select chest based on the specified probabilities
        if (randomValue < 5 && epicChest) {
            // 5% chance for Epic (0-4.99)
            selectedChest = epicChest;
            console.log(`Selected EPIC chest (${randomValue} < 5)`);
        } else if (randomValue < 25 && rareChest) {
            // 20% chance for Rare (5-24.99)
            selectedChest = rareChest;
            console.log(`Selected RARE chest (5 <= ${randomValue} < 25)`);
        } else if (commonChest) {
            // 75% chance for Common (25-99.99)
            selectedChest = commonChest;
            console.log(`Selected COMMON chest (${randomValue} >= 25)`);
        } else {
            // Emergency fallback if specific chest types not found
            selectedChest = chestTypes[0];
        }
        
        if (!selectedChest) {
            return res.status(500).json({ msg: 'Failed to select a chest' });
        }
        
        // Create a unique MongoDB ObjectId for this chest
        const objectId = new mongoose.Types.ObjectId();
        
        // Add the selected chest to the user's chest array
        const newUserChest = {
            _id: objectId,
            object_id: objectId.toString(),
            chest_id: selectedChest._id,
            name: selectedChest.name,
            type: selectedChest.type,
            rarity: selectedChest.rarity,
            unlock_time: null,  // Set to null initially
            unlock_time_minutes: selectedChest.unlock_time_minutes,
            is_unlocked: false,
            is_claimed: false,
            obtained_at: new Date()
        };
        
        user.chests.push(newUserChest);
        
        await user.save();
        
        // Return the chest details
        return res.json({
            chest_id: selectedChest._id,
            object_id: objectId.toString(),
            name: selectedChest.name,
            type: selectedChest.type,
            rarity: selectedChest.rarity,
            unlock_time: null,
            unlock_time_minutes: selectedChest.unlock_time_minutes,
            is_unlocked: false,
            is_claimed: false,
            obtained_at: newUserChest.obtained_at,
            chests_count: user.chests.length,
            max_chests: MAX_CHESTS
        });
    } catch (err) {
        console.error('Error in random-chest POST:', err.message);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// Get random chest card out of three options with userId in URL (GET version)
router.get('/random-chest/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Find user by string userId field
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Check if user already has maximum number of chests (4)
        const MAX_CHESTS = 4;
        if (user.chests && user.chests.length >= MAX_CHESTS) {
            // Still run the chest selection simulation, but don't add to inventory
            // Get all chest types
            const chestTypes = await ChestCard.find();
            
            if (chestTypes.length < 1) {
                return res.status(404).json({ msg: 'No chest types found' });
            }
            
            // Find chests by type instead of ID
            let commonChest = chestTypes.find(chest => chest.type === 'common');
            let rareChest = chestTypes.find(chest => chest.type === 'rare');
            let epicChest = chestTypes.find(chest => chest.type === 'epic');
            
            // Generate selection but don't save
            const randomValue = Math.random() * 100;
            let selectedChest = null;
            
            if (randomValue < 5 && epicChest) {
                selectedChest = epicChest;
            } else if (randomValue < 25 && rareChest) {
                selectedChest = rareChest;
            } else if (commonChest) {
                selectedChest = commonChest;
            } else if (chestTypes.length > 0) {
                selectedChest = chestTypes[0];
            }
            
            // Return a more informative response with what the chest would have been
            return res.status(400).json({ 
                msg: "Maximum chest limit reached",
                current: user.chests.length,
                max: MAX_CHESTS,
                would_have_received: selectedChest ? {
                    chest_id: selectedChest._id,
                    name: selectedChest.name,
                    type: selectedChest.type,
                    rarity: selectedChest.rarity
                } : null
            });
        }
        
        // Get all chest types
        const chestTypes = await ChestCard.find();
        
        if (chestTypes.length < 1) {
            return res.status(404).json({ msg: 'No chest types found' });
        }
        
        // Log all chest types for debugging
        console.log('All available chest types for preview:');
        chestTypes.forEach(chest => {
            console.log(`ID: ${chest._id}, Type: ${chest.type}, Chest ID: ${chest.chest_id}, Unlock time: ${chest.unlock_time_minutes} minutes`);
        });
        
        // Find chests by type instead of using hardcoded IDs
        let commonChest = chestTypes.find(chest => chest.type === 'common');
        let rareChest = chestTypes.find(chest => chest.type === 'rare');
        let epicChest = chestTypes.find(chest => chest.type === 'epic');
        
        console.log('Found chests by type:');
        console.log('Common chest:', commonChest ? commonChest._id : 'Not found');
        console.log('Rare chest:', rareChest ? rareChest._id : 'Not found');
        console.log('Epic chest:', epicChest ? epicChest._id : 'Not found');
        
        // Use direct probability approach - 75% common, 20% rare, 5% epic
        const randomValue = Math.random() * 100; // 0-100
        let selectedChest = null;
        
        // Select chest based on the specified probabilities
        if (randomValue < 5 && epicChest) {
            // 5% chance for Epic (0-4.99)
            selectedChest = epicChest;
            console.log(`Selected EPIC chest (${randomValue} < 5)`);
        } else if (randomValue < 25 && rareChest) {
            // 20% chance for Rare (5-24.99)
            selectedChest = rareChest;
            console.log(`Selected RARE chest (5 <= ${randomValue} < 25)`);
        } else if (commonChest) {
            // 75% chance for Common (25-99.99)
            selectedChest = commonChest;
            console.log(`Selected COMMON chest (${randomValue} >= 25)`);
        } else {
            // Emergency fallback if specific chest types not found
            console.log('WARNING: Could not find expected chest types, using fallback selection');
            selectedChest = chestTypes[0];
            console.log(`Fallback selection: ${selectedChest._id} (${selectedChest.type || selectedChest.chest_id})`);
        }
        
        if (!selectedChest) {
            return res.status(500).json({ msg: 'Failed to select a chest' });
        }
        
        // Create a unique MongoDB ObjectId for this chest
        const objectId = new mongoose.Types.ObjectId();
        
        // Add the selected chest to the user's chest array with the predefined ObjectId
        const newUserChest = {
            _id: objectId,  // Set the _id explicitly
            object_id: objectId.toString(),  // Also store as string for clearer retrieval
            chest_id: selectedChest._id,
            name: selectedChest.name,
            type: selectedChest.type,
            rarity: selectedChest.rarity,
            unlock_time: null,  // Set to null initially - timer will start when process-chest is called
            unlock_time_minutes: selectedChest.unlock_time_minutes,  // Store for later use
            is_unlocked: false,
            is_claimed: false,
            obtained_at: new Date()
        };
        
        user.chests.push(newUserChest);
        
        // Save user to get the _id of the new chest
        await user.save();
        
        console.log('Added chest with ObjectId:', objectId.toString());
        console.log(`FINAL SELECTION: ID=${selectedChest._id}, type=${selectedChest.type}, chest_id=${selectedChest.chest_id}`);
        console.log(`User now has ${user.chests.length} chests out of maximum ${MAX_CHESTS}`);
        
        // Return the chest details with both chest_id and object_id
        return res.json({
            chest_id: selectedChest._id,
            object_id: objectId.toString(),
            name: selectedChest.name,
            type: selectedChest.type,
            rarity: selectedChest.rarity,
            unlock_time: null,  // No unlock time yet
            unlock_time_minutes: selectedChest.unlock_time_minutes,
            is_unlocked: false,
            is_claimed: false,
            obtained_at: newUserChest.obtained_at,
            chests_count: user.chests.length,
            max_chests: MAX_CHESTS
        });
    } catch (err) {
        console.error('Error in random-chest:', err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// Debug endpoint to check chest card data directly
router.get('/debug-chest/:chestId', async (req, res) => {
    try {
        const chestId = req.params.chestId;
        
        // Try direct MongoDB lookup
        const chest = await ChestCard.findById(chestId);
        if (!chest) {
            return res.status(404).json({ msg: 'Chest not found by ID' });
        }
        
        // Create a detailed response with all chest data
        return res.json(chest);
    } catch (err) {
        console.error('Error debugging chest:', err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// New debug endpoint to simulate reward generation without affecting actual data
router.get('/debug-rewards/:chestId', async (req, res) => {
    try {
        const chestId = req.params.chestId;
        
        // Try direct MongoDB lookup
        const chestDetails = await ChestCard.findById(chestId);
        if (!chestDetails) {
            return res.status(404).json({ msg: 'Chest not found by ID' });
        }
        
        // Initialize rewards object for simulation
        const resources = {
            coins: 0,
            gems: 0,
            anima: 0,
            arcane_energy: 0
        };
        
        // ===== GENERATE CARD REWARDS FOR SIMULATION =====
        const cardRewards = [];
        const debugInfo = {
            chest_id: chestId,
            raw_data: chestDetails,
            has_cards: chestDetails.cards && Array.isArray(chestDetails.cards),
            cards_count: chestDetails.cards ? chestDetails.cards.length : 0,
            cards_type: chestDetails.cards ? typeof chestDetails.cards : 'undefined',
            cards_is_array: Array.isArray(chestDetails.cards),
            has_rewards: !!chestDetails.rewards,
            processing_steps: []
        };
        
        // Force refresh chest details to ensure we get all data correctly
        let refreshedChestDetails = null;
        try {
            refreshedChestDetails = await ChestCard.findById(chestDetails._id).lean();
            if (refreshedChestDetails && refreshedChestDetails.cards && Array.isArray(refreshedChestDetails.cards)) {
                console.log(`Refreshed chest details, found ${refreshedChestDetails.cards.length} cards`);
                chestDetails = refreshedChestDetails;
            }
        } catch (err) {
            console.log("Error refreshing chest details:", err.message);
        }
        
        // Check if the chest has valid cards structure
        if (chestDetails.cards && Array.isArray(chestDetails.cards) && chestDetails.cards.length > 0) {
            debugInfo.processing_steps.push(`Found ${chestDetails.cards.length} cards in chest`);
            
            // Process each card in the chest
            chestDetails.cards.forEach((card, index) => {
                if (!card) {
                    debugInfo.processing_steps.push(`Card ${index} is null or undefined, skipping`);
                    return;
                }
                
                debugInfo.processing_steps.push(`Checking card ${index+1}: ${JSON.stringify(card)}`);
                
                // Special case handling for cards with no rewards array but direct properties
                if (!card.rewards && card.card_number) {
                    debugInfo.processing_steps.push(`Card ${card.card_number} has no rewards array, checking for direct rewards`);
                    
                    // Try to use card object directly as reward if it has reward properties
                    if (card.resource_type || card.amount || card.reward_type) {
                        const directReward = {
                            card_number: card.card_number || index + 1,
                            resource_type: card.resource_type || "gold",
                            amount: card.amount || 100,
                            reward_type: card.reward_type || "resource",
                        };
                        
                        debugInfo.processing_steps.push(`Using direct card properties as reward: ${JSON.stringify(directReward)}`);
                        
                        // Add direct reward to card rewards
                        cardRewards.push(directReward);
                        
                        // Update resources
                        if (directReward.resource_type === 'gold') {
                            resources.coins += directReward.amount;
                        } else if (directReward.resource_type === 'gems') {
                            resources.gems += directReward.amount;
                        } else if (directReward.resource_type === 'anima') {
                            resources.anima += directReward.amount;
                        } else if (directReward.resource_type === 'arcane_energy') {
                            resources.arcane_energy += directReward.amount;
                        }
                        
                        return;
                    }
                }
                
                if (!card.rewards || !Array.isArray(card.rewards)) {
                    debugInfo.processing_steps.push(`Card ${index} has no valid rewards array, skipping`);
                    return;
                }
                
                debugInfo.processing_steps.push(`Processing card ${index+1} with ${card.rewards.length} rewards`);
                
                // Generate a random number between 0-100 for this card
                const randomNumber = Math.random() * 100;
                debugInfo.processing_steps.push(`Card ${index+1}: Generated random number: ${randomNumber.toFixed(2)}`);
                
                // Initialize a selected reward
                let selectedReward = null;
                
                // First try selecting rewards by probability range if available
                for (const reward of card.rewards) {
                    if (reward && reward.probability_range && 
                        reward.probability_range.min !== undefined && 
                        reward.probability_range.max !== undefined &&
                        randomNumber >= reward.probability_range.min && 
                        randomNumber <= reward.probability_range.max) {
                        
                        selectedReward = reward;
                        debugInfo.processing_steps.push(`Selected reward by probability range: ${randomNumber.toFixed(2)} is in ${reward.probability_range.min}-${reward.probability_range.max}`);
                        break;
                    }
                }
                
                // If no reward was selected by probability range, try by chance
                if (!selectedReward) {
                    let cumulativeChance = 0;
                    
                    for (const reward of card.rewards) {
                        if (reward && reward.chance) {
                            cumulativeChance += reward.chance;
                            debugInfo.processing_steps.push(`Checking reward: ${reward.resource_type}, amount: ${reward.amount}, chance: ${reward.chance}, cumulative: ${cumulativeChance}`);
                            
                            if (randomNumber <= cumulativeChance) {
                                selectedReward = reward;
                                debugInfo.processing_steps.push(`Selected reward by chance: ${randomNumber.toFixed(2)} <= ${cumulativeChance}`);
                                break;
                            }
                        }
                    }
                }
                
                // If still no reward was selected, pick the first one as fallback
                if (!selectedReward && card.rewards.length > 0) {
                    selectedReward = card.rewards[0];
                    debugInfo.processing_steps.push(`Selected first reward as fallback`);
                }
                
                if (selectedReward) {
                    const cardReward = {
                        card_number: card.card_number || index + 1,
                        resource_type: selectedReward.resource_type || "gold",
                        amount: selectedReward.amount || 100,
                        reward_type: selectedReward.reward_type || "resource"
                    };
                    
                    console.log(`Final reward for card ${index+1}:`, JSON.stringify(cardReward, null, 2));
                    
                    // Add the reward amount to the total resources
                    if (cardReward.resource_type === 'gold') {
                        resources.coins += cardReward.amount;
                    } else if (cardReward.resource_type === 'gems') {
                        resources.gems += cardReward.amount;
                    } else if (cardReward.resource_type === 'anima') {
                        resources.anima += cardReward.amount;
                    } else if (cardReward.resource_type === 'arcane_energy') {
                        resources.arcane_energy += cardReward.amount;
                    }
                    
                    // Add the reward to the list
                    cardRewards.push(cardReward);
                }
            });
        } else {
            debugInfo.processing_steps.push('No valid cards found in chest');
            
            // If using alternative rewards structure
            if (chestDetails.rewards) {
                debugInfo.processing_steps.push('Using alternative rewards structure');
                
                // Generate coins reward
                if (chestDetails.rewards.coins && chestDetails.rewards.coins.min !== undefined && chestDetails.rewards.coins.max !== undefined) {
                    const coinsAmount = Math.floor(Math.random() * 
                        (chestDetails.rewards.coins.max - chestDetails.rewards.coins.min + 1)) + 
                        chestDetails.rewards.coins.min;
                    
                    resources.coins += coinsAmount;
                    debugInfo.processing_steps.push(`Generated ${coinsAmount} coins from min-max range`);
                    
                    // Add coins reward to card rewards
                    cardRewards.push({
                        card_number: 1,
                        resource_type: 'gold',
                        amount: coinsAmount,
                        reward_type: 'resource'
                    });
                }
                
                // Generate gems reward
                if (chestDetails.rewards.gems && chestDetails.rewards.gems.min !== undefined && chestDetails.rewards.gems.max !== undefined) {
                    const gemsAmount = Math.floor(Math.random() * 
                        (chestDetails.rewards.gems.max - chestDetails.rewards.gems.min + 1)) + 
                        chestDetails.rewards.gems.min;
                    
                    resources.gems += gemsAmount;
                    debugInfo.processing_steps.push(`Generated ${gemsAmount} gems from min-max range`);
                    
                    // Add gems reward to card rewards
                    if (gemsAmount > 0) {
                        cardRewards.push({
                            card_number: cardRewards.length + 1,
                            resource_type: 'gems',
                            amount: gemsAmount,
                            reward_type: 'resource'
                        });
                    }
                }
            } else {
                debugInfo.processing_steps.push('No rewards structure found either');
            }
        }
        
        // If no rewards were generated, provide a default reward based on chest rarity
        if (cardRewards.length === 0) {
            let defaultAmount = 1000;
            
            // Adjust default reward based on chest rarity
            if (chestDetails.rarity === "epic") {
                defaultAmount = 10000;
            } else if (chestDetails.rarity === "rare") {
                defaultAmount = 5000;
            } else if (chestDetails.rarity === "legendary") {
                defaultAmount = 20000;
            }
            
            debugInfo.processing_steps.push(`No rewards generated, using default ${defaultAmount} gold based on ${chestDetails.rarity || 'common'} rarity`);
            
            // Add default reward
            cardRewards.push({
                card_number: 1,
                resource_type: "gold",
                amount: defaultAmount,
                reward_type: "resource",
                default: true
            });
            
            resources.coins += defaultAmount;
        }
        
        // Return the simulation results
        return res.json({
            debug_info: debugInfo,
            status: 'simulation',
            chest_info: {
                chest_id: chestId,
                type: chestDetails.type,
                rarity: chestDetails.rarity
            },
            cards: cardRewards,
            resources: resources
        });
    } catch (err) {
        console.error('Error simulating rewards:', err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// Process chest - start unlocking, check status, or claim rewards
router.post('/process-chest/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { objectId } = req.body;  // Now we primarily use objectId
        
        if (!objectId) {
            return res.status(400).json({ msg: 'Object ID is required' });
        }
        
        // Find user by string userId field
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Find the chest in user's inventory by object_id
        const chestIndex = user.chests.findIndex(chest => {
            // Try matching with the object_id field first
            if (chest && chest.object_id) {
                return chest.object_id === objectId;
            }
            // Fall back to _id if needed
            if (chest && chest._id) {
                return chest._id.toString() === objectId;
            }
            return false;
        });
        
        if (chestIndex === -1) {
            return res.status(404).json({ msg: 'Chest not found in inventory' });
        }
        
        const userChest = user.chests[chestIndex];
        
        // Get the chest type using the chest_id from the found chest
        let chestDetails;
        try {
            console.log("Looking up chest with ID:", userChest.chest_id);
            // Use lean() to get a plain JavaScript object without Mongoose methods
            chestDetails = await ChestCard.findById(userChest.chest_id).lean();
            console.log("Found chest details:", chestDetails ? chestDetails._id : "None");
        } catch (err) {
            console.log("Error finding chest by ID:", err.message);
            // Try finding by chest_id if it's not an ObjectId
            chestDetails = await ChestCard.findOne({ chest_id: userChest.chest_id }).lean();
            console.log("Found chest by chest_id:", chestDetails ? chestDetails._id : "None");
        }
        
        if (!chestDetails) {
            return res.status(404).json({ msg: 'Chest details not found' });
        }
        
        // Print the full chest details for debugging
        console.log('CHEST DETAILS:', JSON.stringify(chestDetails, null, 2));
        console.log('USER CHEST:', JSON.stringify(userChest, null, 2));
        
        // Check if chest is already claimed
        if (userChest.is_claimed) {
            return res.status(400).json({ msg: 'Chest has already been claimed' });
        }
        
        // If unlock_time is null or not set, this is the first time processing - start the timer now
        if (!userChest.unlock_time) {
            // Get unlock time from either stored value or chest details
            const unlockTimeMinutes = userChest.unlock_time_minutes || chestDetails.unlock_time_minutes;
            
            // Set the unlock time to now + unlock duration
            userChest.unlock_time = new Date(Date.now() + unlockTimeMinutes * 60000);
            
            // Set the start_time to now if not already set
            if (!userChest.start_time) {
                userChest.start_time = new Date();
            }
            
            await user.save();
            
            return res.json({
                status: 'unlocking_started',
                start_time: userChest.start_time,
                unlock_time: userChest.unlock_time,
                remaining_time_seconds: unlockTimeMinutes * 60
            });
        }
        
        // Check if chest is still unlocking
        const now = new Date();
        const remainingTimeMs = userChest.unlock_time - now;
        
        if (remainingTimeMs > 0) {
            // Chest is still unlocking
            return res.json({
                status: 'unlocking',
                start_time: userChest.start_time,
                unlock_time: userChest.unlock_time,
                remaining_time_seconds: Math.ceil(remainingTimeMs / 1000)
            });
        }
        
        // Check if chest is ready to be claimed
        if (!userChest.is_unlocked) {
            userChest.is_unlocked = true;
        }
        
        // Initialize rewards object
        const resources = {
            coins: 0,
            gems: 0,
            anima: 0,
            arcane_energy: 0
        };
        
        // ===== GENERATE CARD REWARDS =====
        const cardRewards = [];
        
        // Force refresh chest details to ensure we get all data correctly
        let refreshedChestDetails = null;
        try {
            refreshedChestDetails = await ChestCard.findById(chestDetails._id).lean();
            if (refreshedChestDetails && refreshedChestDetails.cards && Array.isArray(refreshedChestDetails.cards)) {
                console.log(`Refreshed chest details, found ${refreshedChestDetails.cards.length} cards`);
                chestDetails = refreshedChestDetails;
            }
        } catch (err) {
            console.log("Error refreshing chest details:", err.message);
        }
        
        // Check if the chest has valid cards structure
        if (chestDetails.cards && Array.isArray(chestDetails.cards) && chestDetails.cards.length > 0) {
            console.log('Chest cards structure found with ' + chestDetails.cards.length + ' cards');
            
            // Process each card in the chest
            chestDetails.cards.forEach((card, index) => {
                console.log(`Checking card ${index+1}:`, JSON.stringify(card, null, 2));
                
                if (!card) {
                    console.log(`Card ${index} is null or undefined, skipping`);
                    return;
                }
                
                // Special case handling for cards with no rewards array but direct properties
                if (!card.rewards && card.card_number) {
                    console.log(`Card ${card.card_number} has no rewards array, checking for direct rewards`);
                    
                    // Try to use card object directly as reward if it has reward properties
                    if (card.resource_type || card.amount || card.reward_type) {
                        const directReward = {
                            card_number: card.card_number || index + 1,
                            resource_type: card.resource_type || "gold",
                            amount: card.amount || 100,
                            reward_type: card.reward_type || "resource",
                        };
                        
                        console.log(`Using direct card properties as reward:`, JSON.stringify(directReward, null, 2));
                        
                        // Add direct reward to card rewards
                        cardRewards.push(directReward);
                        
                        // Update resources
                        if (directReward.resource_type === 'gold') {
                            resources.coins += directReward.amount;
                        } else if (directReward.resource_type === 'gems') {
                            resources.gems += directReward.amount;
                        } else if (directReward.resource_type === 'anima') {
                            resources.anima += directReward.amount;
                        } else if (directReward.resource_type === 'arcane_energy') {
                            resources.arcane_energy += directReward.amount;
                        }
                        
                        return;
                    }
                }
                
                if (!card.rewards || !Array.isArray(card.rewards)) {
                    console.log(`Card ${index} has no valid rewards array, skipping`);
                    return;
                }
                
                console.log(`Processing card ${index+1} with ${card.rewards.length} rewards`);
                
                // Generate a random number between 0-100 for this card
                const randomNumber = Math.random() * 100;
                console.log(`Card ${index+1}: Generated random number: ${randomNumber.toFixed(2)}`);
                
                // Initialize a selected reward
                let selectedReward = null;
                
                // First try selecting rewards by probability range if available
                for (const reward of card.rewards) {
                    if (reward && reward.probability_range && 
                        reward.probability_range.min !== undefined && 
                        reward.probability_range.max !== undefined &&
                        randomNumber >= reward.probability_range.min && 
                        randomNumber <= reward.probability_range.max) {
                        
                        selectedReward = reward;
                        console.log(`Selected reward by probability range: ${randomNumber.toFixed(2)} is in ${reward.probability_range.min}-${reward.probability_range.max}`);
                        break;
                    }
                }
                
                // If no reward was selected by probability range, try by chance
                if (!selectedReward) {
                    let cumulativeChance = 0;
                    
                    for (const reward of card.rewards) {
                        if (reward && reward.chance) {
                            cumulativeChance += reward.chance;
                            console.log(`Checking reward: ${reward.resource_type}, amount: ${reward.amount}, chance: ${reward.chance}, cumulative: ${cumulativeChance}`);
                            
                            if (randomNumber <= cumulativeChance) {
                                selectedReward = reward;
                                console.log(`Selected reward by chance: ${randomNumber.toFixed(2)} <= ${cumulativeChance}`);
                                break;
                            }
                        }
                    }
                }
                
                // If still no reward was selected, pick the first one as fallback
                if (!selectedReward && card.rewards.length > 0) {
                    selectedReward = card.rewards[0];
                    console.log(`Selected first reward as fallback`);
                }
                
                if (selectedReward) {
                    const cardReward = {
                        card_number: card.card_number || index + 1,
                        resource_type: selectedReward.resource_type || "gold",
                        amount: selectedReward.amount || 100,
                        reward_type: selectedReward.reward_type || "resource"
                    };
                    
                    console.log(`Final reward for card ${index+1}:`, JSON.stringify(cardReward, null, 2));
                    
                    // Add the reward amount to the total resources
                    if (cardReward.resource_type === 'gold') {
                        resources.coins += cardReward.amount;
                    } else if (cardReward.resource_type === 'gems') {
                        resources.gems += cardReward.amount;
                    } else if (cardReward.resource_type === 'anima') {
                        resources.anima += cardReward.amount;
                    } else if (cardReward.resource_type === 'arcane_energy') {
                        resources.arcane_energy += cardReward.amount;
                    }
                    
                    // Add the reward to the list
                    cardRewards.push(cardReward);
                }
            });
        } else if (chestDetails.rewards) {
            // Handle the alternative format with top-level rewards property
            console.log('Using alternative rewards structure:', JSON.stringify(chestDetails.rewards, null, 2));
            
            // Generate coins reward
            if (chestDetails.rewards.coins && chestDetails.rewards.coins.min !== undefined && chestDetails.rewards.coins.max !== undefined) {
                const coinsAmount = Math.floor(Math.random() * 
                    (chestDetails.rewards.coins.max - chestDetails.rewards.coins.min + 1)) + 
                    chestDetails.rewards.coins.min;
                
                resources.coins += coinsAmount;
                
                // Add coins reward to card rewards
                cardRewards.push({
                    card_number: 1,
                    resource_type: 'gold',
                    amount: coinsAmount,
                    reward_type: 'resource'
                });
            }
            
            // Generate gems reward
            if (chestDetails.rewards.gems && chestDetails.rewards.gems.min !== undefined && chestDetails.rewards.gems.max !== undefined) {
                const gemsAmount = Math.floor(Math.random() * 
                    (chestDetails.rewards.gems.max - chestDetails.rewards.gems.min + 1)) + 
                    chestDetails.rewards.gems.min;
                
                resources.gems += gemsAmount;
                
                // Add gems reward to card rewards if greater than 0
                if (gemsAmount > 0) {
                    cardRewards.push({
                        card_number: cardRewards.length + 1,
                        resource_type: 'gems',
                        amount: gemsAmount,
                        reward_type: 'resource'
                    });
                }
            }
        }
        
        // If no rewards were generated, provide a default reward based on chest rarity
        if (cardRewards.length === 0) {
            let defaultAmount = 1000;
            
            // Adjust default reward based on chest rarity
            if (chestDetails.rarity === "epic") {
                defaultAmount = 10000;
            } else if (chestDetails.rarity === "rare") {
                defaultAmount = 5000;
            } else if (chestDetails.rarity === "legendary") {
                defaultAmount = 20000;
            }
            
            // Add default reward
            cardRewards.push({
                card_number: 1,
                resource_type: "gold",
                amount: defaultAmount,
                reward_type: "resource",
                default: true
            });
            
            resources.coins += defaultAmount;
        }
        
        // Update user resources
        user.gold_coins = (user.gold_coins || 0) + resources.coins;
        
        // Update various resources based on what's available
        if (user.gems !== undefined) {
            user.gems += resources.gems;
        } else if (user.currency && user.currency.gems !== undefined) {
            user.currency.gems += resources.gems;
        }
        
        if (user.anima !== undefined) {
            user.anima += resources.anima;
        } else if (user.currency && user.currency.anima !== undefined) {
            user.currency.anima += resources.anima;
        }
        
        if (user.arcane_energy !== undefined) {
            user.arcane_energy += resources.arcane_energy;
        } else if (user.currency && user.currency.arcane_energy !== undefined) {
            user.currency.arcane_energy += resources.arcane_energy;
        }
        
        // Remove the chest from user's inventory after claiming
        user.chests.splice(chestIndex, 1);
        
        await user.save();
        
        // Return the card rewards separately from the resource totals
        return res.json({
            status: 'claimed',
            chest_info: {
                chest_id: userChest.chest_id,
                name: userChest.name || chestDetails.chest_id || chestDetails.name,
                type: userChest.type || chestDetails.type,
                rarity: userChest.rarity || chestDetails.rarity
            },
            cards: cardRewards,
            resources: resources
        });
        
    } catch (err) {
        console.error('Error processing chest:', err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// Preview a random chest without adding it to inventory (useful when chest limit reached)
router.get('/preview-chest/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Find user by string userId field
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Get all chest types
        const chestTypes = await ChestCard.find();
        
        if (chestTypes.length < 1) {
            return res.status(404).json({ msg: 'No chest types found' });
        }
        
        // Log all chest types for debugging
        console.log('All available chest types for preview:');
        chestTypes.forEach(chest => {
            console.log(`ID: ${chest._id}, Type: ${chest.type}, Chest ID: ${chest.chest_id}, Unlock time: ${chest.unlock_time_minutes} minutes`);
        });
        
        // Find chests by type instead of using hardcoded IDs
        let commonChest = chestTypes.find(chest => chest.type === 'common');
        let rareChest = chestTypes.find(chest => chest.type === 'rare');
        let epicChest = chestTypes.find(chest => chest.type === 'epic');
        
        // Use direct probability approach - 75% common, 20% rare, 5% epic
        const randomValue = Math.random() * 100; // 0-100
        let selectedChest = null;
        
        // Select chest based on the specified probabilities
        if (randomValue < 5 && epicChest) {
            // 5% chance for Epic (0-4.99)
            selectedChest = epicChest;
            console.log(`Preview EPIC chest (${randomValue} < 5)`);
        } else if (randomValue < 25 && rareChest) {
            // 20% chance for Rare (5-24.99)
            selectedChest = rareChest;
            console.log(`Preview RARE chest (5 <= ${randomValue} < 25)`);
        } else if (commonChest) {
            // 75% chance for Common (25-99.99)
            selectedChest = commonChest;
            console.log(`Preview COMMON chest (${randomValue} >= 25)`);
        } else {
            // Emergency fallback if specific chest types not found
            console.log('WARNING: Could not find expected chest types, using fallback selection for preview');
            selectedChest = chestTypes[0];
        }
        
        if (!selectedChest) {
            return res.status(500).json({ msg: 'Failed to select a chest for preview' });
        }
        
        // Create a temporary ObjectId just for display (will not be saved)
        const tempObjectId = new mongoose.Types.ObjectId();
        
        console.log(`PREVIEW SELECTION: ID=${selectedChest._id}, type=${selectedChest.type}, chest_id=${selectedChest.chest_id}`);
        
        // Return the chest details - BUT DON'T ADD TO USER'S INVENTORY
        return res.json({
            preview: true,
            chest_id: selectedChest._id,
            object_id: tempObjectId.toString(),
            name: selectedChest.name,
            type: selectedChest.type,
            rarity: selectedChest.rarity,
            unlock_time: null,  // No unlock time until user initiates unlocking
            unlock_time_minutes: selectedChest.unlock_time_minutes,  // Store unlock duration for later use
            is_unlocked: false,
            is_claimed: false,
            obtained_at: new Date(),
            chests_count: user.chests.length,
            max_chests: 4,
            can_add: user.chests.length < 4
        });
    } catch (err) {
        console.error('Error in preview-chest:', err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

// Process chest directly by objectId in URL
router.post('/process-object/:userId/:objectId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const objectId = req.params.objectId;
        
        if (!objectId) {
            return res.status(400).json({ msg: 'Object ID is required' });
        }
        
        // Find user by string userId field
        const user = await User.findOne({ userId: userId });
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // Find the chest in user's inventory by object_id field
        const chestIndex = user.chests.findIndex(chest => {
            // Try matching with the object_id field first
            if (chest && chest.object_id) {
                return chest.object_id === objectId;
            }
            // Fall back to _id if object_id isn't found
            if (chest && chest._id) {
                return chest._id.toString() === objectId;
            }
            return false;
        });
        
        if (chestIndex === -1) {
            return res.status(404).json({ msg: 'Chest not found in inventory' });
        }
        
        const userChest = user.chests[chestIndex];
        
        // Get the chest type - safely handle the chest_id
        let chestDetails;
        try {
            console.log("Looking up chest with ID:", userChest.chest_id);
            chestDetails = await ChestCard.findById(userChest.chest_id).lean();
            console.log("Found chest details:", chestDetails ? chestDetails._id : "None");
        } catch (err) {
            console.log("Error finding chest by ID:", err.message);
            // Try finding by chest_id if it's not an ObjectId
            chestDetails = await ChestCard.findOne({ chest_id: userChest.chest_id }).lean();
            console.log("Found chest by chest_id:", chestDetails ? chestDetails._id : "None");
        }
        
        if (!chestDetails) {
            return res.status(404).json({ msg: 'Chest details not found' });
        }
        
        // Print the full chest details for debugging
        console.log('CHEST DETAILS:', JSON.stringify(chestDetails, null, 2));
        console.log('USER CHEST:', JSON.stringify(userChest, null, 2));
        
        // Check if chest is already claimed
        if (userChest.is_claimed) {
            return res.status(400).json({ msg: 'Chest has already been claimed' });
        }
        
        // If unlock_time is null or not set, this is the first time processing - start the timer now
        if (!userChest.unlock_time) {
            // Get unlock time from either stored value or chest details
            const unlockTimeMinutes = userChest.unlock_time_minutes || chestDetails.unlock_time_minutes;
            
            // Set the unlock time to now + unlock duration
            userChest.unlock_time = new Date(Date.now() + unlockTimeMinutes * 60000);
            
            // Set the start_time to now if not already set
            if (!userChest.start_time) {
                userChest.start_time = new Date();
            }
            
            await user.save();
            
            return res.json({
                status: 'unlocking_started',
                start_time: userChest.start_time,
                unlock_time: userChest.unlock_time,
                remaining_time_seconds: unlockTimeMinutes * 60
            });
        }
        
        // Check if chest is still unlocking
        const now = new Date();
        const remainingTimeMs = userChest.unlock_time - now;
        
        if (remainingTimeMs > 0) {
            // Chest is still unlocking
            return res.json({
                status: 'unlocking',
                start_time: userChest.start_time,
                unlock_time: userChest.unlock_time,
                remaining_time_seconds: Math.ceil(remainingTimeMs / 1000)
            });
        }
        
        // Check if chest is ready to be claimed
        if (!userChest.is_unlocked) {
            userChest.is_unlocked = true;
        }
        
        // Initialize rewards object
        const resources = {
            coins: 0,
            gems: 0,
            anima: 0,
            arcane_energy: 0
        };
        
        // ===== GENERATE CARD REWARDS =====
        const cardRewards = [];
        
        // Force refresh chest details to ensure we get all data correctly
        let refreshedChestDetails = null;
        try {
            refreshedChestDetails = await ChestCard.findById(chestDetails._id).lean();
            if (refreshedChestDetails && refreshedChestDetails.cards && Array.isArray(refreshedChestDetails.cards)) {
                console.log(`Refreshed chest details, found ${refreshedChestDetails.cards.length} cards`);
                chestDetails = refreshedChestDetails;
            }
        } catch (err) {
            console.log("Error refreshing chest details:", err.message);
        }
        
        // Check if the chest has valid cards structure
        if (chestDetails.cards && Array.isArray(chestDetails.cards) && chestDetails.cards.length > 0) {
            console.log('Chest cards structure found with ' + chestDetails.cards.length + ' cards');
            
            // Process each card in the chest
            chestDetails.cards.forEach((card, index) => {
                console.log(`Checking card ${index+1}:`, JSON.stringify(card, null, 2));
                
                if (!card) {
                    console.log(`Card ${index} is null or undefined, skipping`);
                    return;
                }
                
                // Special case handling for cards with no rewards array but direct properties
                if (!card.rewards && card.card_number) {
                    console.log(`Card ${card.card_number} has no rewards array, checking for direct rewards`);
                    
                    // Try to use card object directly as reward if it has reward properties
                    if (card.resource_type || card.amount || card.reward_type) {
                        const directReward = {
                            card_number: card.card_number || index + 1,
                            resource_type: card.resource_type || "gold",
                            amount: card.amount || 100,
                            reward_type: card.reward_type || "resource",
                        };
                        
                        console.log(`Using direct card properties as reward:`, JSON.stringify(directReward, null, 2));
                        
                        // Add direct reward to card rewards
                        cardRewards.push(directReward);
                        
                        // Update resources
                        if (directReward.resource_type === 'gold') {
                            resources.coins += directReward.amount;
                        } else if (directReward.resource_type === 'gems') {
                            resources.gems += directReward.amount;
                        } else if (directReward.resource_type === 'anima') {
                            resources.anima += directReward.amount;
                        } else if (directReward.resource_type === 'arcane_energy') {
                            resources.arcane_energy += directReward.amount;
                        }
                        
                        return;
                    }
                }
                
                if (!card.rewards || !Array.isArray(card.rewards)) {
                    console.log(`Card ${index} has no valid rewards array, skipping`);
                    return;
                }
                
                console.log(`Processing card ${index+1} with ${card.rewards.length} rewards`);
                
                // Generate a random number between 0-100 for this card
                const randomNumber = Math.random() * 100;
                console.log(`Card ${index+1}: Generated random number: ${randomNumber.toFixed(2)}`);
                
                // Initialize a selected reward
                let selectedReward = null;
                
                // First try selecting rewards by probability range if available
                for (const reward of card.rewards) {
                    if (reward && reward.probability_range && 
                        reward.probability_range.min !== undefined && 
                        reward.probability_range.max !== undefined &&
                        randomNumber >= reward.probability_range.min && 
                        randomNumber <= reward.probability_range.max) {
                        
                        selectedReward = reward;
                        console.log(`Selected reward by probability range: ${randomNumber.toFixed(2)} is in ${reward.probability_range.min}-${reward.probability_range.max}`);
                        break;
                    }
                }
                
                // If no reward was selected by probability range, try by chance
                if (!selectedReward) {
                    let cumulativeChance = 0;
                    
                    for (const reward of card.rewards) {
                        if (reward && reward.chance) {
                            cumulativeChance += reward.chance;
                            console.log(`Checking reward: ${reward.resource_type}, amount: ${reward.amount}, chance: ${reward.chance}, cumulative: ${cumulativeChance}`);
                            
                            if (randomNumber <= cumulativeChance) {
                                selectedReward = reward;
                                console.log(`Selected reward by chance: ${randomNumber.toFixed(2)} <= ${cumulativeChance}`);
                                break;
                            }
                        }
                    }
                }
                
                // If still no reward was selected, pick the first one as fallback
                if (!selectedReward && card.rewards.length > 0) {
                    selectedReward = card.rewards[0];
                    console.log(`Selected first reward as fallback`);
                }
                
                if (selectedReward) {
                    const cardReward = {
                        card_number: card.card_number || index + 1,
                        resource_type: selectedReward.resource_type || "gold",
                        amount: selectedReward.amount || 100,
                        reward_type: selectedReward.reward_type || "resource"
                    };
                    
                    console.log(`Final reward for card ${index+1}:`, JSON.stringify(cardReward, null, 2));
                    
                    // Add the reward amount to the total resources
                    if (cardReward.resource_type === 'gold') {
                        resources.coins += cardReward.amount;
                    } else if (cardReward.resource_type === 'gems') {
                        resources.gems += cardReward.amount;
                    } else if (cardReward.resource_type === 'anima') {
                        resources.anima += cardReward.amount;
                    } else if (cardReward.resource_type === 'arcane_energy') {
                        resources.arcane_energy += cardReward.amount;
                    }
                    
                    // Add the reward to the list
                    cardRewards.push(cardReward);
                }
            });
        } else if (chestDetails.rewards) {
            // Handle the alternative format with top-level rewards property
            console.log('Using alternative rewards structure:', JSON.stringify(chestDetails.rewards, null, 2));
            
            // Generate coins reward
            if (chestDetails.rewards.coins && chestDetails.rewards.coins.min !== undefined && chestDetails.rewards.coins.max !== undefined) {
                const coinsAmount = Math.floor(Math.random() * 
                    (chestDetails.rewards.coins.max - chestDetails.rewards.coins.min + 1)) + 
                    chestDetails.rewards.coins.min;
                
                resources.coins += coinsAmount;
                
                // Add coins reward to card rewards
                cardRewards.push({
                    card_number: 1,
                    resource_type: 'gold',
                    amount: coinsAmount,
                    reward_type: 'resource'
                });
            }
            
            // Generate gems reward
            if (chestDetails.rewards.gems && chestDetails.rewards.gems.min !== undefined && chestDetails.rewards.gems.max !== undefined) {
                const gemsAmount = Math.floor(Math.random() * 
                    (chestDetails.rewards.gems.max - chestDetails.rewards.gems.min + 1)) + 
                    chestDetails.rewards.gems.min;
                
                resources.gems += gemsAmount;
                
                // Add gems reward to card rewards if greater than 0
                if (gemsAmount > 0) {
                    cardRewards.push({
                        card_number: cardRewards.length + 1,
                        resource_type: 'gems',
                        amount: gemsAmount,
                        reward_type: 'resource'
                    });
                }
            }
        }
        
        // If no rewards were generated, provide a default reward based on chest rarity
        if (cardRewards.length === 0) {
            let defaultAmount = 1000;
            
            // Adjust default reward based on chest rarity
            if (chestDetails.rarity === "epic") {
                defaultAmount = 10000;
            } else if (chestDetails.rarity === "rare") {
                defaultAmount = 5000;
            } else if (chestDetails.rarity === "legendary") {
                defaultAmount = 20000;
            }
            
            // Add default reward
            cardRewards.push({
                card_number: 1,
                resource_type: "gold",
                amount: defaultAmount,
                reward_type: "resource",
                default: true
            });
            
            resources.coins += defaultAmount;
        }
        
        // Update user resources
        user.gold_coins = (user.gold_coins || 0) + resources.coins;
        
        // Update various resources based on what's available
        if (user.gems !== undefined) {
            user.gems += resources.gems;
        } else if (user.currency && user.currency.gems !== undefined) {
            user.currency.gems += resources.gems;
        }
        
        if (user.anima !== undefined) {
            user.anima += resources.anima;
        } else if (user.currency && user.currency.anima !== undefined) {
            user.currency.anima += resources.anima;
        }
        
        if (user.arcane_energy !== undefined) {
            user.arcane_energy += resources.arcane_energy;
        } else if (user.currency && user.currency.arcane_energy !== undefined) {
            user.currency.arcane_energy += resources.arcane_energy;
        }
        
        // Remove the chest from user's inventory after claiming
        user.chests.splice(chestIndex, 1);
        
        await user.save();
        
        // Return the card rewards separately from the resource totals
        return res.json({
            status: 'claimed',
            chest_info: {
                chest_id: userChest.chest_id,
                name: userChest.name || chestDetails.chest_id || chestDetails.name,
                type: userChest.type || chestDetails.type,
                rarity: userChest.rarity || chestDetails.rarity
            },
            cards: cardRewards,
            resources: resources
        });
        
    } catch (err) {
        console.error('Error processing chest by object ID:', err);
        res.status(500).send('Server Error: ' + err.message);
    }
});

module.exports = router; 