const express = require('express');
const router = express.Router();
const { 
    getAllCreatures,
    getCreatureById,
    getCreatureStats,
    updateCreatureLevel,
    createCreature,
    speedUpUnlock,
    mergeCreatures
} = require('../service/creatureService');
const Creature = require('../models/creature');
const User = require('../models/user');
const CreatureSlot = require('../models/creatureSlot');

// Get all creatures
router.get('/', async (req, res) => {
    try {
        const creatures = await getAllCreatures();
        res.status(200).json({
            success: true,
            message: 'Creatures fetched successfully',
            data: creatures
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get all creature slots
router.get('/slots', async (req, res) => {
    try {
        const slots = await CreatureSlot.find().sort({ slot_number: 1 });
        res.status(200).json({
            success: true,
            message: 'Creature slots fetched successfully',
            data: slots
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get user's available creature slots
router.get('/user/:userId/slots', async (req, res) => {
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
        
        // Get all slots
        const allSlots = await CreatureSlot.find().sort({ slot_number: 1 });
        
        // Check if user has creature_slots field, initialize if not
        if (!user.creature_slots || !Array.isArray(user.creature_slots)) {
            user.creature_slots = [
                { slot_number: 1, is_unlocked: true, unlocked_at: new Date() }
            ];
            await user.save();
        }
        
        // Map user unlocked slots
        const userUnlockedSlots = user.creature_slots.reduce((map, slot) => {
            map[slot.slot_number] = slot.is_unlocked;
            return map;
        }, {});
        
        // Check if user is an elite user
        const isEliteUser = user.elite_pass && user.elite_pass.active;
        
        // Format slots with availability information
        const slotsWithAvailability = allSlots.map(slot => {
            const isUnlocked = userUnlockedSlots[slot.slot_number] || false;
            const isAvailable = slot.is_elite ? (isEliteUser && !isUnlocked) : !isUnlocked;
            
            // Get creatures currently in this slot
            const creaturesInSlot = [
                ...user.creatures.filter(c => c.slot_number === slot.slot_number),
                ...user.creating_creatures.filter(c => c.slot_number === slot.slot_number)
            ];
            
            return {
                slot_number: slot.slot_number,
                is_elite: slot.is_elite,
                gold_cost: slot.gold_cost,
                description: slot.description,
                is_unlocked: isUnlocked,
                is_available: isAvailable,
                creatures_count: creaturesInSlot.length
            };
        });
        
        res.status(200).json({
            success: true,
            message: 'User slots fetched successfully',
            data: {
                slots: slotsWithAvailability,
                is_elite_user: isEliteUser
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Unlock a slot for user
router.post('/user/:userId/slots/:slotNumber/unlock', async (req, res) => {
    try {
        const { userId, slotNumber } = req.params;
        const slotNum = parseInt(slotNumber);
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Find the slot
        const slot = await CreatureSlot.findOne({ slot_number: slotNum });
        if (!slot) {
            return res.status(404).json({
                success: false,
                message: `Slot ${slotNum} not found`
            });
        }
        
        // Check if the slot is already unlocked
        if (!user.creature_slots) {
            user.creature_slots = [
                { slot_number: 1, is_unlocked: true, unlocked_at: new Date() }
            ];
        }
        
        const existingSlot = user.creature_slots.find(s => s.slot_number === slotNum);
        if (existingSlot && existingSlot.is_unlocked) {
            return res.status(400).json({
                success: false,
                message: `Slot ${slotNum} is already unlocked`
            });
        }
        
        // Check if it's an elite slot
        if (slot.is_elite) {
            // Check if user is an elite user
            const isEliteUser = user.elite_pass && user.elite_pass.active;
            if (!isEliteUser) {
                return res.status(400).json({
                    success: false,
                    message: 'This slot is only available for elite users'
                });
            }
        } else {
            // For non-elite slots, check gold cost
            if (user.gold_coins < slot.gold_cost) {
                return res.status(400).json({
                    success: false,
                    message: `Not enough gold. Required: ${slot.gold_cost}, Available: ${user.gold_coins}`
                });
            }
            
            // Deduct gold
            user.gold_coins -= slot.gold_cost;
        }
        
        // Unlock the slot
        if (existingSlot) {
            existingSlot.is_unlocked = true;
            existingSlot.unlocked_at = new Date();
        } else {
            user.creature_slots.push({
                slot_number: slotNum,
                is_unlocked: true,
                unlocked_at: new Date()
            });
        }
        
        user.markModified('creature_slots');
        await user.save();
        
        res.status(200).json({
            success: true,
            message: `Slot ${slotNum} unlocked successfully`,
            data: {
                slot_number: slotNum,
                gold_remaining: user.gold_coins
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Assign slot to a creature in creation
router.put('/user/:userId/creature/:creatureId/assign-slot/:slotNumber', async (req, res) => {
    try {
        const { userId, creatureId, slotNumber } = req.params;
        const slotNum = parseInt(slotNumber);
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if the slot is unlocked
        const unlockedSlot = user.creature_slots?.find(s => s.slot_number === slotNum && s.is_unlocked);
        if (!unlockedSlot) {
            return res.status(400).json({
                success: false,
                message: `Slot ${slotNum} is not unlocked`
            });
        }
        
        // Find the creature
        const creatureIndex = user.creating_creatures.findIndex(c => c._id.toString() === creatureId);
        if (creatureIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Creature not found in creation queue'
            });
        }
        
        // Update the slot
        user.creating_creatures[creatureIndex].slot_number = slotNum;
        user.markModified('creating_creatures');
        await user.save();
        
        res.status(200).json({
            success: true,
            message: `Creature assigned to slot ${slotNum} successfully`,
            data: {
                creature_id: creatureId,
                slot_number: slotNum
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get creature by ID
router.get('/:creatureId', async (req, res) => {
    try {
        const creature = await getCreatureById(req.params.creatureId);
        res.status(200).json({
            success: true,
            message: 'Creature fetched successfully',
            data: creature
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

// Get creature stats for all levels
router.get('/:creatureId/stats', async (req, res) => {
    try {
        const result = await getCreatureStats(req.params.creatureId);
        res.status(200).json({
            success: true,
            message: 'Creature stats fetched successfully',
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

// Update creature level
router.put('/:creatureId/level/:levelNumber', async (req, res) => {
    try {
        const levelNumber = parseInt(req.params.levelNumber);
        
        if (isNaN(levelNumber)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Level number must be a valid number' 
            });
        }

        // Check if trying to update to a milestone level (11, 21, 31)
        if (levelNumber === 11 || levelNumber === 21 || levelNumber === 31) {
            return res.status(400).json({
                success: false,
                message: 'Cannot update to level ' + levelNumber + '. This level can only be achieved by merging two creatures of the previous milestone level.'
            });
        }
        
        const result = await updateCreatureLevel(req.params.creatureId, levelNumber);
        res.status(200).json({
            success: true,
            message: `Creature level updated to ${levelNumber}`,
            data: result
        });
    } catch (error) {
        if (error.message.includes('not found') || 
            error.message.includes('must be between')) {
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

// Create a new creature
router.post('/', async (req, res) => {
    try {
        // Validate required fields
        const requiredFields = ['creature_Id', 'name', 'type', 'rarity', 'base_attack', 'base_health', 'gold_coins', 'description', 'image'];
        
        for (const field of requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({
                    success: false,
                    message: `Missing required field: ${field}`
                });
            }
        }
        
        // Validate rarity
        const validRarities = ['common', 'rare', 'epic', 'legendary'];
        if (!validRarities.includes(req.body.rarity)) {
            return res.status(400).json({
                success: false,
                message: `Invalid rarity. Must be one of: ${validRarities.join(', ')}`
            });
        }
        
        const creature = await createCreature(req.body);
        
        // Track quest progress if userId is provided
        if (req.body.userId) {
            try {
                // Import quest service
                const questService = require('../service/questService');
                
                // Track creature creation for quests
                await questService.trackQuestProgress(req.body.userId, 'create_creature', { 
                    creature_id: creature.creature_Id,
                    creature_type: creature.type,
                    creature_rarity: creature.rarity
                });
            } catch (questError) {
                console.error('Error updating quest progress for creature creation:', questError);
                // Continue with response even if quest update fails
            }
        }
        
        res.status(201).json({
            success: true,
            message: 'Creature created successfully',
            data: creature
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Speed up creature unlocking
router.post('/user/:userId/speed-up/:creatureId', async (req, res) => {
    try {
        const { userId, creatureId } = req.params;
        
        if (!userId || !creatureId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: userId and creatureId'
            });
        }

        const result = await speedUpUnlock(userId, creatureId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in speed up creature unlock route:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Speed up creature upgrade process
router.post('/speed-up-upgrade/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id } = req.body;

        if (!userId || !creature1Id || !creature2Id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: userId, creature1Id, and creature2Id'
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

        // Find both creatures in user's creatures array
        const creature1Index = user.creatures.findIndex(c => c._id.toString() === creature1Id);
        const creature2Index = user.creatures.findIndex(c => c._id.toString() === creature2Id);

        if (creature1Index === -1 || creature2Index === -1) {
            return res.status(404).json({
                success: false,
                message: 'One or both creatures not found in user\'s creatures'
            });
        }

        const creature1 = user.creatures[creature1Index];
        const creature2 = user.creatures[creature2Index];

        // Find the creature template to get rarity
        const creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_type });
        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: `Creature template not found for type: ${creature1.creature_type}`
            });
        }

        // Determine gem cost based on rarity
        let gemCost;
        switch (creatureTemplate.type) {
            case 'common':
                gemCost = 100;
                break;
            case 'rare':
                gemCost = 200;
                break;
            case 'epic':
                gemCost = 300;
                break;
            case 'legendary':
            case 'elite':
                gemCost = 500;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: `Invalid creature rarity: ${creatureTemplate.type}`
                });
        }

        // Check if user has enough gems
        if (!user.currency || user.currency.gems < gemCost) {
            return res.status(400).json({
                success: false,
                message: `Not enough gems. Required: ${gemCost}`
            });
        }

        // Check if there's an active upgrade process
        const lastClickTime = creature1.last_upgrade_click_time || creature2.last_upgrade_click_time;
        if (!lastClickTime) {
            return res.status(400).json({
                success: false,
                message: 'No active upgrade process found for these creatures'
            });
        }

        // Determine target level based on current level
        const currentLevel = creature1.level;
        let targetLevel;
        if (currentLevel === 10) {
            targetLevel = 11;
        } else if (currentLevel === 20) {
            targetLevel = 21;
        } else if (currentLevel === 30) {
            targetLevel = 31;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Creatures must be at level 10, 20, or 30 to upgrade'
            });
        }

        // Calculate required wait time based on rarity and target level
        let requiredWaitTimeMinutes;
        if (creatureTemplate.type === 'common') {
            requiredWaitTimeMinutes = targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60;
        } else if (creatureTemplate.type === 'rare') {
            requiredWaitTimeMinutes = targetLevel === 11 ? 30 : targetLevel === 21 ? 60 : 90;
        } else if (creatureTemplate.type === 'epic') {
            requiredWaitTimeMinutes = targetLevel === 11 ? 60 : targetLevel === 21 ? 120 : 240;
        } else if (creatureTemplate.type === 'legendary' || creatureTemplate.type === 'elite') {
            requiredWaitTimeMinutes = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
        }

        // Check if there's remaining time to speed up
        const now = new Date();
        const timeSinceLastClick = (now - new Date(lastClickTime)) / 1000; // Convert to seconds
        const requiredWaitTimeSeconds = requiredWaitTimeMinutes * 60;

        if (timeSinceLastClick >= requiredWaitTimeSeconds) {
            return res.status(400).json({
                success: false,
                message: 'No remaining time to speed up'
            });
        }

        // Deduct gems
        user.currency.gems -= gemCost;

        // Update last click time to now to remove the wait time
        // Set the last click time to a time in the past that's beyond the required wait time
        const pastTime = new Date(now.getTime() - (requiredWaitTimeSeconds * 1000));
        user.creatures[creature1Index].last_upgrade_click_time = pastTime;
        user.creatures[creature2Index].last_upgrade_click_time = pastTime;

        // Save the user
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Upgrade process speed up successful. You can now proceed with the upgrade.',
            data: {
                gems_deducted: gemCost,
                remaining_gems: user.currency.gems,
                creature1_id: creature1Id,
                creature2_id: creature2Id,
                rarity: creatureTemplate.type,
                target_level: targetLevel,
                wait_time_removed: true
            }
        });
    } catch (error) {
        console.error('Error in speed up upgrade route:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Merge two creatures
router.post('/user/:userId/merge', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id } = req.body;
        
        if (!userId || !creature1Id || !creature2Id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: userId, creature1Id, and creature2Id'
            });
        }

        const result = await mergeCreatures(userId, creature1Id, creature2Id);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in merge creatures route:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

// Upgrade creature to next milestone level by merging two creatures
router.put('/:userId/upgrade-milestone', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id } = req.body;

        if (!creature1Id || !creature2Id) {
            return res.status(400).json({
                success: false,
                message: 'Both creature IDs are required'
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

        // Find both creatures in user's creatures array
        const creature1Index = user.creatures.findIndex(c => c._id.toString() === creature1Id);
        const creature2Index = user.creatures.findIndex(c => c._id.toString() === creature2Id);

        if (creature1Index === -1 || creature2Index === -1) {
            return res.status(404).json({
                success: false,
                message: 'One or both creatures not found in user\'s creatures'
            });
        }

        const creature1 = user.creatures[creature1Index];
        const creature2 = user.creatures[creature2Index];

        // Check if both creatures are at the same milestone level
        const currentLevel = creature1.level;
        if (creature1.level !== creature2.level || creature2.level !== currentLevel) {
            return res.status(400).json({
                success: false,
                message: 'Both creatures must be at the same milestone level (10, 20, or 30)'
            });
        }

        // Determine target level based on current level
        let targetLevel;
        if (currentLevel === 10) {
            targetLevel = 11;
        } else if (currentLevel === 20) {
            targetLevel = 21;
        } else if (currentLevel === 30) {
            targetLevel = 31;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Creatures must be at level 10, 20, or 30 to upgrade'
            });
        }

        // Find the creature template to get rarity
        console.log('Looking up creature template for:', {
            creature_type: creature1.creature_type,
            creature_id: creature1.creature_id
        });
        
        const creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_type });
        console.log('Found creature template:', creatureTemplate);
        
        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: `Creature template not found for type: ${creature1.creature_type}`
            });
        }

        // Validate creature rarity (using 'type' field instead of 'rarity')
        const validRarities = ['common', 'rare', 'epic', 'legendary', 'elite'];
        if (!creatureTemplate.type || !validRarities.includes(creatureTemplate.type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid creature rarity: ${creatureTemplate.type || 'undefined'}. Must be one of: ${validRarities.join(', ')}`
            });
        }

        // Get stats for the target level (in template, stats for level N are stored with level N+1)
        const levelStats = creatureTemplate.level_stats.find(stat => stat.level === targetLevel);
        if (!levelStats) {
            return res.status(400).json({
                success: false,
                message: `Stats not found for level ${targetLevel}`
            });
        }

        // Determine anima costs based on rarity and level
        let requiredAnima, secondClickAnima;
        switch (creatureTemplate.type) {
            case 'common':
                if (currentLevel === 10) {
                    requiredAnima = 100;
                    secondClickAnima = 30;
                } else if (currentLevel === 20) {
                    requiredAnima = 200;
                    secondClickAnima = 60;
                } else if (currentLevel === 30) {
                    requiredAnima = 300;
                    secondClickAnima = 90;
                }
                break;
            case 'rare':
                if (currentLevel === 10) {
                    requiredAnima = 200;
                    secondClickAnima = 60;
                } else if (currentLevel === 20) {
                    requiredAnima = 400;
                    secondClickAnima = 120;
                } else if (currentLevel === 30) {
                    requiredAnima = 600;
                    secondClickAnima = 180;
                }
                break;
            case 'epic':
                if (currentLevel === 10) {
                    requiredAnima = 600;
                    secondClickAnima = 90;
                } else if (currentLevel === 20) {
                    requiredAnima = 1200;
                    secondClickAnima = 180;
                } else if (currentLevel === 30) {
                    requiredAnima = 1800;
                    secondClickAnima = 270;
                }
                break;
            case 'legendary':
                if (currentLevel === 10) {
                    requiredAnima = 1200;
                    secondClickAnima = 120;
                } else if (currentLevel === 20) {
                    requiredAnima = 2400;
                    secondClickAnima = 240;
                } else if (currentLevel === 30) {
                    requiredAnima = 4800;
                    secondClickAnima = 360;
                }
                break;
            case 'elite':
                if (currentLevel === 10) {
                    requiredAnima = 1400;
                    secondClickAnima = 150;
                } else if (currentLevel === 20) {
                    requiredAnima = 2800;
                    secondClickAnima = 300;
                } else if (currentLevel === 30) {
                    requiredAnima = 4600;
                    secondClickAnima = 450;
                }
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: `Unsupported creature rarity: ${creatureTemplate.type}`
                });
        }

        // Check if this is the first or second click for this upgrade
        const creature1Progress = parseInt(user.creatures[creature1Index].upgrade_progress) || 0;
        const creature2Progress = parseInt(user.creatures[creature2Index].upgrade_progress) || 0;
        const previousProgress = Math.max(creature1Progress, creature2Progress);
        const isSecondClick = previousProgress > 0;

        // For rare creatures, determine if this is a third or fourth click
        const clickCount = Math.floor(previousProgress / 25) + 1; // Each click adds at least 25%
        const isThirdClick = clickCount === 3;
        const isFourthClick = clickCount === 4;

        // Check if these creatures are already partnered for upgrade
        const creature1PartnerId = user.creatures[creature1Index].upgrade_partner_id;
        const creature2PartnerId = user.creatures[creature2Index].upgrade_partner_id;
        const isAlreadyPartnered = (creature1PartnerId && creature1PartnerId.toString() === creature2.creature_id.toString()) ||
                                  (creature2PartnerId && creature2PartnerId.toString() === creature1.creature_id.toString());

        // If this is not the first click, validate that these are the correct partner creatures
        if (isSecondClick && !isAlreadyPartnered) {
            return res.status(400).json({
                success: false,
                message: 'These creatures are not partnered for upgrade. Please select the correct partner creature.'
            });
        }

        // If this is a first click, validate that neither creature is already partnered
        if (!isSecondClick && (creature1PartnerId || creature2PartnerId)) {
            // Reset any existing partnerships
            user.creatures[creature1Index].upgrade_partner_id = null;
            user.creatures[creature2Index].upgrade_partner_id = null;
            user.creatures[creature1Index].upgrade_progress = 0;
            user.creatures[creature2Index].upgrade_progress = 0;
            await user.save();
        }

        // For Common type creatures, check time requirements between clicks
        if (creatureTemplate.type === 'common') {
            console.log('Common creature upgrade check:', {
                creature1Progress: user.creatures[creature1Index].upgrade_progress,
                creature2Progress: user.creatures[creature2Index].upgrade_progress,
                previousProgress,
                isSecondClick,
                lastClickTime1: user.creatures[creature1Index].last_upgrade_click_time,
                lastClickTime2: user.creatures[creature2Index].last_upgrade_click_time
            });

            const lastClickTime = user.creatures[creature1Index].last_upgrade_click_time || 
                                user.creatures[creature2Index].last_upgrade_click_time;
            
            // If this is the first click (no progress yet)
            if (previousProgress === 0) {
                console.log('First click - starting upgrade process');
                // Set initial progress and timestamps
                const now = new Date();
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_progress = 50; // Set initial progress
                user.creatures[creature2Index].upgrade_progress = 50; // Set initial progress
                user.creatures[creature1Index].upgrade_partner_id = creature2.creature_id;
                user.creatures[creature2Index].upgrade_partner_id = creature1.creature_id;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${waitTime} minutes before clicking again.`,
                    remaining_time: `${waitTime}:00`,
                    progress: {
                        current: 50,
                        total: 100,
                        percentage: "50%"
                    }
                });
            }
            
            // For second click, check if we have a last click time
            if (!lastClickTime) {
                console.log('No last click time found - resetting progress');
                // If no last click time but we have progress, reset and start over
                const now = new Date();
                user.creatures[creature1Index].upgrade_progress = 0;
                user.creatures[creature2Index].upgrade_progress = 0;
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_partner_id = null;
                user.creatures[creature2Index].upgrade_partner_id = null;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${waitTime} minutes before clicking again.`,
                    remaining_time: `${waitTime}:00`,
                    progress: {
                        current: 0,
                        total: 100,
                        percentage: "0%"
                    }
                });
            }

            const now = new Date();
            const timeSinceLastClick = (now - new Date(lastClickTime)) / 1000; // Convert to seconds
            const requiredWaitTimeSeconds = (targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60) * 60; // Convert minutes to seconds

            console.log('Time check:', {
                timeSinceLastClick,
                requiredWaitTimeSeconds,
                lastClickTime,
                now
            });

            if (timeSinceLastClick < requiredWaitTimeSeconds) {
                const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecondsFormatted = remainingSeconds % 60;
                
                return res.status(400).json({
                    success: false,
                    message: `Please wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} before clicking again.`,
                    remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
                    progress: {
                        current: Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100),
                        total: 100,
                        percentage: `${Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100)}%`
                    }
                });
            }
        }
        // For Rare type creatures, check time requirements between clicks
        else if (creatureTemplate.type === 'rare') {
            console.log('Rare creature upgrade check:', {
                creature1Progress: user.creatures[creature1Index].upgrade_progress,
                creature2Progress: user.creatures[creature2Index].upgrade_progress,
                previousProgress,
                clickCount,
                lastClickTime1: user.creatures[creature1Index].last_upgrade_click_time,
                lastClickTime2: user.creatures[creature2Index].last_upgrade_click_time
            });

            const lastClickTime = user.creatures[creature1Index].last_upgrade_click_time || 
                                user.creatures[creature2Index].last_upgrade_click_time;
            
            // If this is the first click (no progress yet)
            if (previousProgress === 0) {
                console.log('First click - starting upgrade process');
                // Set initial progress and timestamps
                const now = new Date();
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_progress = 25; // Set initial progress
                user.creatures[creature2Index].upgrade_progress = 25; // Set initial progress
                user.creatures[creature1Index].upgrade_partner_id = creature2.creature_id;
                user.creatures[creature2Index].upgrade_partner_id = creature1.creature_id;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 30 : targetLevel === 21 ? 60 : 90;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${waitTime} minutes before clicking again.`,
                    remaining_time: `${waitTime}:00`,
                    progress: {
                        current: 25,
                        total: 100,
                        percentage: "25%"
                    }
                });
            }
            
            // For subsequent clicks, check if we have a last click time
            if (!lastClickTime) {
                console.log('No last click time found - resetting progress');
                // If no last click time but we have progress, reset and start over
                const now = new Date();
                user.creatures[creature1Index].upgrade_progress = 0;
                user.creatures[creature2Index].upgrade_progress = 0;
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_partner_id = null;
                user.creatures[creature2Index].upgrade_partner_id = null;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 30 : targetLevel === 21 ? 60 : 90;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${waitTime} minutes before clicking again.`,
                    remaining_time: `${waitTime}:00`,
                    progress: {
                        current: 0,
                        total: 100,
                        percentage: "0%"
                    }
                });
            }

            const now = new Date();
            const timeSinceLastClick = (now - new Date(lastClickTime)) / 1000; // Convert to seconds
            const requiredWaitTimeSeconds = (targetLevel === 11 ? 30 : targetLevel === 21 ? 60 : 90) * 60; // Convert minutes to seconds

            console.log('Time check:', {
                timeSinceLastClick,
                requiredWaitTimeSeconds,
                lastClickTime,
                now
            });

            if (timeSinceLastClick < requiredWaitTimeSeconds) {
                const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecondsFormatted = remainingSeconds % 60;
                
                return res.status(400).json({
                    success: false,
                    message: `Please wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} before clicking again.`,
                    remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
                    progress: {
                        current: Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100),
                        total: 100,
                        percentage: `${Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100)}%`
                    }
                });
            }
        }
        // For Epic type creatures, check time requirements between clicks
        else if (creatureTemplate.type === 'epic') {
            console.log('Epic creature upgrade check:', {
                creature1Progress: user.creatures[creature1Index].upgrade_progress,
                creature2Progress: user.creatures[creature2Index].upgrade_progress,
                previousProgress,
                clickCount,
                lastClickTime1: user.creatures[creature1Index].last_upgrade_click_time,
                lastClickTime2: user.creatures[creature2Index].last_upgrade_click_time
            });

            const lastClickTime = user.creatures[creature1Index].last_upgrade_click_time || 
                                user.creatures[creature2Index].last_upgrade_click_time;
            
            // If this is the first click (no progress yet)
            if (previousProgress === 0) {
                console.log('First click - starting upgrade process');
                // Set initial progress and timestamps
                const now = new Date();
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_progress = 15; // Set initial progress
                user.creatures[creature2Index].upgrade_progress = 15; // Set initial progress
                user.creatures[creature1Index].upgrade_partner_id = creature2.creature_id;
                user.creatures[creature2Index].upgrade_partner_id = creature1.creature_id;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 60 : targetLevel === 21 ? 120 : 240;
                const hours = Math.floor(waitTime / 60);
                const minutes = waitTime % 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${hours} hours and ${minutes} minutes before clicking again.`,
                    remaining_time: `${hours}:${minutes.toString().padStart(2, '0')}`,
                    progress: {
                        current: 15,
                        total: 100,
                        percentage: "15%"
                    }
                });
            }
            
            // For subsequent clicks, check if we have a last click time
            if (!lastClickTime) {
                console.log('No last click time found - resetting progress');
                // If no last click time but we have progress, reset and start over
                const now = new Date();
                user.creatures[creature1Index].upgrade_progress = 0;
                user.creatures[creature2Index].upgrade_progress = 0;
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_partner_id = null;
                user.creatures[creature2Index].upgrade_partner_id = null;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 60 : targetLevel === 21 ? 120 : 240;
                const hours = Math.floor(waitTime / 60);
                const minutes = waitTime % 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${hours} hours and ${minutes} minutes before clicking again.`,
                    remaining_time: `${hours}:${minutes.toString().padStart(2, '0')}`,
                    progress: {
                        current: 0,
                        total: 100,
                        percentage: "0%"
                    }
                });
            }

            const now = new Date();
            const timeSinceLastClick = (now - new Date(lastClickTime)) / 1000; // Convert to seconds
            const requiredWaitTimeSeconds = (targetLevel === 11 ? 60 : targetLevel === 21 ? 120 : 240) * 60; // Convert minutes to seconds

            console.log('Time check:', {
                timeSinceLastClick,
                requiredWaitTimeSeconds,
                lastClickTime,
                now
            });

            if (timeSinceLastClick < requiredWaitTimeSeconds) {
                const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecondsFormatted = remainingSeconds % 60;
                
                return res.status(400).json({
                    success: false,
                    message: `Please wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} before clicking again.`,
                    remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
                    progress: {
                        current: Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100),
                        total: 100,
                        percentage: `${Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100)}%`
                    }
                });
            }
        }
        // For Legendary type creatures, check time requirements between clicks
        else if (creatureTemplate.type === 'legendary') {
            console.log('Legendary creature upgrade check:', {
                creature1Progress: user.creatures[creature1Index].upgrade_progress,
                creature2Progress: user.creatures[creature2Index].upgrade_progress,
                previousProgress,
                clickCount,
                lastClickTime1: user.creatures[creature1Index].last_upgrade_click_time,
                lastClickTime2: user.creatures[creature2Index].last_upgrade_click_time
            });

            const lastClickTime = user.creatures[creature1Index].last_upgrade_click_time || 
                                user.creatures[creature2Index].last_upgrade_click_time;
            
            // If this is the first click (no progress yet)
            if (previousProgress === 0) {
                console.log('First click - starting upgrade process');
                // Set initial progress and timestamps
                const now = new Date();
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_progress = 10; // Set initial progress
                user.creatures[creature2Index].upgrade_progress = 10; // Set initial progress
                user.creatures[creature1Index].upgrade_partner_id = creature2.creature_id;
                user.creatures[creature2Index].upgrade_partner_id = creature1.creature_id;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
                const hours = Math.floor(waitTime / 60);
                const minutes = waitTime % 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${hours} hours and ${minutes} minutes before clicking again.`,
                    remaining_time: `${hours}:${minutes.toString().padStart(2, '0')}`,
                    progress: {
                        current: 10,
                        total: 100,
                        percentage: "10%"
                    }
                });
            }
            
            // For subsequent clicks, check if we have a last click time
            if (!lastClickTime) {
                console.log('No last click time found - resetting progress');
                // If no last click time but we have progress, reset and start over
                const now = new Date();
                user.creatures[creature1Index].upgrade_progress = 0;
                user.creatures[creature2Index].upgrade_progress = 0;
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_partner_id = null;
                user.creatures[creature2Index].upgrade_partner_id = null;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
                const hours = Math.floor(waitTime / 60);
                const minutes = waitTime % 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${hours} hours and ${minutes} minutes before clicking again.`,
                    remaining_time: `${hours}:${minutes.toString().padStart(2, '0')}`,
                    progress: {
                        current: 0,
                        total: 100,
                        percentage: "0%"
                    }
                });
            }

            const now = new Date();
            const timeSinceLastClick = (now - new Date(lastClickTime)) / 1000; // Convert to seconds
            const requiredWaitTimeSeconds = (targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440) * 60; // Convert minutes to seconds

            console.log('Time check:', {
                timeSinceLastClick,
                requiredWaitTimeSeconds,
                lastClickTime,
                now
            });

            if (timeSinceLastClick < requiredWaitTimeSeconds) {
                const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
                const remainingHours = Math.floor(remainingSeconds / 3600);
                const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
                const remainingSecondsFormatted = remainingSeconds % 60;
                
                return res.status(400).json({
                    success: false,
                    message: `Please wait ${remainingHours} hours, ${remainingMinutes} minutes, and ${remainingSecondsFormatted} seconds before clicking again.`,
                    remaining_time: `${remainingHours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
                    progress: {
                        current: Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100),
                        total: 100,
                        percentage: `${Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100)}%`
                    }
                });
            }
        }
        // For Elite type creatures, check time requirements between clicks
        else if (creatureTemplate.type === 'elite') {
            console.log('Elite creature upgrade check:', {
                creature1Progress: user.creatures[creature1Index].upgrade_progress,
                creature2Progress: user.creatures[creature2Index].upgrade_progress,
                previousProgress,
                clickCount,
                lastClickTime1: user.creatures[creature1Index].last_upgrade_click_time,
                lastClickTime2: user.creatures[creature2Index].last_upgrade_click_time
            });

            const lastClickTime = user.creatures[creature1Index].last_upgrade_click_time || 
                                user.creatures[creature2Index].last_upgrade_click_time;
            
            // If this is the first click (no progress yet)
            if (previousProgress === 0) {
                console.log('First click - starting upgrade process');
                // Set initial progress and timestamps
                const now = new Date();
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_progress = 10; // Set initial progress
                user.creatures[creature2Index].upgrade_progress = 10; // Set initial progress
                user.creatures[creature1Index].upgrade_partner_id = creature2.creature_id;
                user.creatures[creature2Index].upgrade_partner_id = creature1.creature_id;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
                const hours = Math.floor(waitTime / 60);
                const minutes = waitTime % 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${hours} hours and ${minutes} minutes before clicking again.`,
                    remaining_time: `${hours}:${minutes.toString().padStart(2, '0')}`,
                    progress: {
                        current: 10,
                        total: 100,
                        percentage: "10%"
                    }
                });
            }
            
            // For subsequent clicks, check if we have a last click time
            if (!lastClickTime) {
                console.log('No last click time found - resetting progress');
                // If no last click time but we have progress, reset and start over
                const now = new Date();
                user.creatures[creature1Index].upgrade_progress = 0;
                user.creatures[creature2Index].upgrade_progress = 0;
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                user.creatures[creature1Index].upgrade_partner_id = null;
                user.creatures[creature2Index].upgrade_partner_id = null;
                await user.save();
                
                const waitTime = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
                const hours = Math.floor(waitTime / 60);
                const minutes = waitTime % 60;
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${hours} hours and ${minutes} minutes before clicking again.`,
                    remaining_time: `${hours}:${minutes.toString().padStart(2, '0')}`,
                    progress: {
                        current: 0,
                        total: 100,
                        percentage: "0%"
                    }
                });
            }

            const now = new Date();
            const timeSinceLastClick = (now - new Date(lastClickTime)) / 1000; // Convert to seconds
            const requiredWaitTimeSeconds = (targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440) * 60; // Convert minutes to seconds

            console.log('Time check:', {
                timeSinceLastClick,
                requiredWaitTimeSeconds,
                lastClickTime,
                now
            });

            if (timeSinceLastClick < requiredWaitTimeSeconds) {
                const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
                const remainingHours = Math.floor(remainingSeconds / 3600);
                const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);
                const remainingSecondsFormatted = remainingSeconds % 60;
                
                return res.status(400).json({
                    success: false,
                    message: `Please wait ${remainingHours} hours, ${remainingMinutes} minutes, and ${remainingSecondsFormatted} seconds before clicking again.`,
                    remaining_time: `${remainingHours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
                    progress: {
                        current: Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100),
                        total: 100,
                        percentage: `${Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100)}%`
                    }
                });
            }
        }

        // If we get here, enough time has passed, so update the last click time
        console.log('Enough time has passed - proceeding with upgrade');
        const now = new Date();
        user.creatures[creature1Index].last_upgrade_click_time = now;
        user.creatures[creature2Index].last_upgrade_click_time = now;
        
        // Update progress for both creatures
        user.creatures[creature1Index].upgrade_progress = 100;
        user.creatures[creature2Index].upgrade_progress = 100;
        await user.save();

        // Calculate required anima based on click
        let animaCost;
        if (creatureTemplate.type === 'rare') {
            if (isSecondClick) animaCost = secondClickAnima;
            else if (isThirdClick) animaCost = secondClickAnima;
            else if (isFourthClick) animaCost = secondClickAnima;
            else animaCost = requiredAnima;
        } else {
            animaCost = isSecondClick ? secondClickAnima : requiredAnima;
        }

        // Check if user has enough anima
        if (!user.currency || user.currency.anima < animaCost) {
            return res.status(400).json({
                success: false,
                message: `Not enough anima. Required: ${animaCost}`
            });
        }

        // Deduct anima cost
        user.currency.anima -= animaCost;

        // Create the merged creature
        const mergedCreature = {
            creature_id: creature1.creature_id,
            name: creatureTemplate.name,
            level: targetLevel,
            building_index: creature1.building_index,
            creature_type: creature1.creature_type,
            base_attack: creature1.base_attack,
            base_health: creature1.base_health,
            attack: levelStats.attack,
            health: levelStats.health,
            speed: levelStats.speed,
            armor: levelStats.armor,
            critical_damage_percentage: levelStats.critical_damage_percentage,
            critical_damage: levelStats.critical_damage,
            gold_coins: levelStats.gold,
            arcane_energy: levelStats.arcane_energy,
            count: 1,
            image: creatureTemplate.image,
            description: creatureTemplate.description
        };

        let isComplete = false;
        let progressPercentage = 0;
        let totalProgress = previousProgress;

        // Generate new progress based on rarity and click count
        let newProgress;
        if (creatureTemplate.type === 'rare') {
            if (clickCount === 1) {
                // First click: 25-40%
                newProgress = Math.floor(Math.random() * 16) + 25;
            } else if (clickCount === 2) {
                // Second click: 25-40%
                newProgress = Math.floor(Math.random() * 16) + 25;
            } else if (clickCount === 3) {
                // Third click: 25-40%
                newProgress = Math.floor(Math.random() * 16) + 25;
            } else {
                // Fourth click: remaining progress to reach 100%
                newProgress = 100 - totalProgress;
            }
        } else if (creatureTemplate.type === 'epic') {
            if (clickCount === 1) {
                // First click: 15-25%
                newProgress = Math.floor(Math.random() * 11) + 15;
            } else if (clickCount === 2) {
                // Second click: 15-25%
                newProgress = Math.floor(Math.random() * 11) + 15;
            } else if (clickCount === 3) {
                // Third click: 15-25%
                newProgress = Math.floor(Math.random() * 11) + 15;
            } else if (clickCount === 4) {
                // Fourth click: 15-25%
                newProgress = Math.floor(Math.random() * 11) + 15;
            } else if (clickCount === 5) {
                // Fifth click: 15-25%
                newProgress = Math.floor(Math.random() * 11) + 15;
            } else if (clickCount === 6) {
                // Sixth click: 15-25%
                newProgress = Math.floor(Math.random() * 11) + 15;
            } else if (clickCount === 7) {
                // Seventh click: 15-25%
                newProgress = Math.floor(Math.random() * 11) + 15;
            } else {
                // Eighth click: remaining progress to reach 100%
                newProgress = 100 - totalProgress;
            }
        } else if (creatureTemplate.type === 'legendary') {
            if (clickCount === 1) {
                // First click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 2) {
                // Second click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 3) {
                // Third click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 4) {
                // Fourth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 5) {
                // Fifth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 6) {
                // Sixth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 7) {
                // Seventh click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 8) {
                // Eighth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 9) {
                // Ninth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else {
                // Tenth click: remaining progress to reach 100%
                newProgress = 100 - totalProgress;
            }
        } else if (creatureTemplate.type === 'elite') {
            if (clickCount === 1) {
                // First click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 2) {
                // Second click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 3) {
                // Third click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 4) {
                // Fourth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 5) {
                // Fifth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 6) {
                // Sixth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 7) {
                // Seventh click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 8) {
                // Eighth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else if (clickCount === 9) {
                // Ninth click: 10-15%
                newProgress = Math.floor(Math.random() * 6) + 10;
            } else {
                // Tenth click: remaining progress to reach 100%
                newProgress = 100 - totalProgress;
            }
        } else {
            // Common creatures: 50-100% per click
            newProgress = Math.floor(Math.random() * 51) + 50;
        }

        progressPercentage = newProgress;
        totalProgress += newProgress;

        console.log('Progress calculation:', {
            previousProgress,
            newProgress,
            totalProgress,
            isSecondClick,
            isThirdClick,
            isFourthClick,
            clickCount,
            rarity: creatureTemplate.type
        });

        // Check if upgrade should complete
        if (totalProgress >= 100) {
            isComplete = true;
            // Remove both original creatures
            user.creatures.splice(Math.max(creature1Index, creature2Index), 1);
            user.creatures.splice(Math.min(creature1Index, creature2Index), 1);
            // Add the merged creature
            user.creatures.push(mergedCreature);
        } else {
            // Update progress and partner IDs in both original creatures
            user.creatures[creature1Index].upgrade_progress = totalProgress;
            user.creatures[creature1Index].upgrade_partner_id = creature2.creature_id;
            user.creatures[creature1Index].last_upgrade_click_time = new Date();
            
            user.creatures[creature2Index].upgrade_progress = totalProgress;
            user.creatures[creature2Index].upgrade_partner_id = creature1.creature_id;
            user.creatures[creature2Index].last_upgrade_click_time = new Date();
        }

        // Save the user
        await user.save();

        // If upgrade is complete, clean up any other creatures that might have been partnered with these
        if (isComplete) {
            user.creatures.forEach(creature => {
                if (creature.upgrade_partner_id && 
                    (creature.upgrade_partner_id.toString() === creature1.creature_id.toString() ||
                     creature.upgrade_partner_id.toString() === creature2.creature_id.toString())) {
                    creature.upgrade_partner_id = null;
                    creature.upgrade_progress = 0;
                }
            });
            await user.save();
        }

        res.status(200).json({
            success: true,
            message: isComplete ? 
                `Successfully merged creatures from level ${currentLevel} to ${targetLevel}` :
                `Upgrade in progress. Current progress: ${progressPercentage}%. Total progress: ${totalProgress}%. Click again to complete the upgrade.`,
            data: {
                merged_creature: isComplete ? mergedCreature : null,
                anima_cost: animaCost,
                remaining_anima: user.currency.anima,
                is_complete: isComplete,
                progress_percentage: progressPercentage,
                total_progress: Math.min(totalProgress, 100),
                is_second_click: isSecondClick,
                is_third_click: isThirdClick,
                is_fourth_click: isFourthClick,
                click_count: clickCount,
                is_already_partnered: isAlreadyPartnered,
                rarity: creatureTemplate.type
            }
        });
    } catch (error) {
        console.error('Error in upgrade-milestone:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /:userId/creatures/:creatureId/feed
 * @desc Feed a creature to increase its stats
 * @access Public
 */
router.post('/:userId/creatures/:creatureId/feed', async (req, res) => {
    try {
        const { userId, creatureId } = req.params;
        const { foodAmount = 1, foodType = 'regular' } = req.body;
        
        // Validate inputs
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        if (!creatureId) {
            return res.status(400).json({
                success: false,
                message: 'Creature ID is required'
            });
        }
        
        // Find the user
        const User = require('../models/user');
        const user = await User.findOne({ userId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Find the creature
        const creatureIndex = user.creatures.findIndex(c => 
            c._id.toString() === creatureId || c.creature_id?.toString() === creatureId
        );
        
        if (creatureIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Creature not found'
            });
        }
        
        const creature = user.creatures[creatureIndex];
        
        // Calculate stats increase based on food type and amount
        const statsIncreasePercentage = foodType === 'premium' ? 0.05 : 0.02;
        const healthIncrease = Math.round(creature.health * statsIncreasePercentage * foodAmount);
        const attackIncrease = Math.round(creature.attack * statsIncreasePercentage * foodAmount);
        
        // Update creature stats
        user.creatures[creatureIndex].health += healthIncrease;
        user.creatures[creatureIndex].attack += attackIncrease;
        
        // Track feeding in creature's history if it doesn't exist yet
        if (!user.creatures[creatureIndex].feeding_history) {
            user.creatures[creatureIndex].feeding_history = [];
        }
        
        // Add feeding record
        user.creatures[creatureIndex].feeding_history.push({
            date: new Date(),
            food_type: foodType,
            food_amount: foodAmount,
            health_increase: healthIncrease,
            attack_increase: attackIncrease
        });
        
        // Mark as modified since we're updating nested arrays
        user.markModified('creatures');
        
        // Save user
        await user.save();
        
        // Track quest progress
        try {
            // Import quest service
            const questService = require('../service/questService');
            
            // Track creature feeding for quest progress
            await questService.trackQuestProgress(userId, 'feed_creature', {
                creature_id: creatureId,
                food_type: foodType,
                food_amount: foodAmount
            });
        } catch (questError) {
            console.error('Error tracking quest progress for feeding creature:', questError);
            // Continue with response even if quest tracking fails
        }
        
        res.status(200).json({
            success: true,
            message: `Creature fed successfully with ${foodAmount} ${foodType} food`,
            data: {
                creature_id: creatureId,
                previous_stats: {
                    health: creature.health,
                    attack: creature.attack
                },
                new_stats: {
                    health: user.creatures[creatureIndex].health,
                    attack: user.creatures[creatureIndex].attack
                },
                increases: {
                    health: healthIncrease,
                    attack: attackIncrease
                }
            }
        });
    } catch (error) {
        console.error('Error feeding creature:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
