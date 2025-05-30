const express = require('express');
const router = express.Router();
const creatureService = require('../service/creatureService');
const Creature = require('../models/creature');
const User = require('../models/user');
const CreatureSlot = require('../models/creatureSlot');

// Add this helper function at the top of the file, right after the imports
/**
 * Ensures the user's merging_history array is initialized
 * @param {Object} user - The user document
 * @return {Array} - The merging_history array
 */
function ensureMergingHistory(user) {
    if (!user.merging_history) {
        user.merging_history = [];
        user.markModified('merging_history');
        console.log('Initialized missing merging_history array');
    }
    return user.merging_history;
}

// Get all creatures
router.get('/', async (req, res) => {
    try {
        const creatures = await creatureService.getAllCreatures();
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
        const creature = await creatureService.getCreatureById(req.params.creatureId);
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
        const result = await creatureService.getCreatureStats(req.params.creatureId);
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
        
        const result = await creatureService.updateCreatureLevel(req.params.creatureId, levelNumber);
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
        
        const creature = await creatureService.createCreature(req.body);
        
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
router.post('/user/:userId/speedup/:creatureId', async (req, res) => {
    try {
        const { userId, creatureId } = req.params;
        
        if (!userId || !creatureId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters: userId and creatureId'
            });
        }

        const result = await creatureService.speedUpUnlock(userId, creatureId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in speedup route:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Speed up creature upgrade process
router.post('/speed-up-upgrade/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id, useGems = true } = req.body;

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

        // Check if these creatures are partnered for upgrade
        const isPartnered = 
            (creature1.upgrade_partner_id && creature1.upgrade_partner_id.toString() === creature2._id.toString()) ||
            (creature2.upgrade_partner_id && creature2.upgrade_partner_id.toString() === creature1._id.toString());

        if (!isPartnered) {
            return res.status(400).json({
                success: false,
                message: 'These creatures are not partnered for upgrade'
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

        // Find creature template for determining rarity
        let creatureTemplate = null;
        if (creature1.creature_Id_reference) {
            creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_Id_reference });
        }
        if (!creatureTemplate && creature1.name) {
            creatureTemplate = await Creature.findOne({ name: creature1.name });
        }
        if (!creatureTemplate && creature1.creature_type) {
            creatureTemplate = await Creature.findOne({ creature_type: creature1.creature_type });
        }

        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: `Creature template not found for ${creature1.name || creature1.creature_type}`
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

        // Deduct gems
        user.currency.gems -= gemCost;

        // Update last click time to now to remove the wait time
        // Set the last click time to a time in the past that's beyond the required wait time
        const pastTime = new Date(now.getTime() - (requiredWaitTimeSeconds * 1000));
        user.creatures[creature1Index].last_upgrade_click_time = pastTime;
        user.creatures[creature2Index].last_upgrade_click_time = pastTime;
        
        // Set both creatures' progress to 100% to indicate they're ready for collection
        user.creatures[creature1Index].upgrade_progress = 100;
        user.creatures[creature2Index].upgrade_progress = 100;

        // Update the merging history record if it exists
        if (user.merging_history) {
            const existingMergeIndex = user.merging_history.findIndex(
                m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                     (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
            );
            
            if (existingMergeIndex !== -1) {
                user.merging_history[existingMergeIndex].progress = 100;
                user.merging_history[existingMergeIndex].last_update = now;
                user.merging_history[existingMergeIndex].gems_spent = (user.merging_history[existingMergeIndex].gems_spent || 0) + gemCost;
            }
            user.markModified('merging_history');
        }
        
        // Remove from active_merges since it's now ready for collection
        if (user.active_merges) {
            user.active_merges = user.active_merges.filter(
                m => !((m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                      (m.creature1_id === creature2Id && m.creature2_id === creature1Id))
            );
            user.markModified('active_merges');
        }

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
                wait_time_removed: true,
                progress: 100
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

        const result = await creatureService.mergeCreatures(userId, creature1Id, creature2Id);
        
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

        // Find creature template
        let creatureTemplate = null;
        
        // Try multiple ways to find the template
        if (creature1.creature_Id_reference) {
            creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_Id_reference });
        }
        if (!creatureTemplate && creature1.name) {
            creatureTemplate = await Creature.findOne({ name: creature1.name });
        }
        if (!creatureTemplate && creature1.creature_type) {
            creatureTemplate = await Creature.findOne({ creature_type: creature1.creature_type });
        }
        if (!creatureTemplate && creature1.creature_id) {
            creatureTemplate = await Creature.findOne({ _id: creature1.creature_id });
        }
        
        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: `Creature template not found for ${creature1.name || creature1.creature_type}`
            });
        }

        // Check if both creatures have an upgrade in progress
        if (creature1.upgrade_progress > 0 && creature2.upgrade_progress > 0 && 
            creature1.last_upgrade_click_time && creature2.last_upgrade_click_time) {
            
            // Get the earliest of the two click times
            const lastClickTime = new Date(Math.min(
                new Date(creature1.last_upgrade_click_time).getTime(),
                new Date(creature2.last_upgrade_click_time).getTime()
            ));
            
            const now = new Date();
            const timeSinceLastClick = (now - lastClickTime) / 1000; // in seconds
            
            // Calculate required wait time based on level and creature type
            let waitTimeMinutes;
            
            if (creatureTemplate.type === 'common') {
                waitTimeMinutes = targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60;
            } else if (creatureTemplate.type === 'rare') {
                waitTimeMinutes = targetLevel === 11 ? 30 : targetLevel === 21 ? 60 : 90;
            } else if (creatureTemplate.type === 'epic') {
                waitTimeMinutes = targetLevel === 11 ? 60 : targetLevel === 21 ? 120 : 240;
            } else {
                waitTimeMinutes = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
            }
            
            const requiredWaitTimeSeconds = waitTimeMinutes * 60;
            
            if (timeSinceLastClick < requiredWaitTimeSeconds) {
                // Not enough time has passed - immediately return error without processing further
                const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecondsFormatted = remainingSeconds % 60;
                
                // Calculate progress based on time elapsed
                let initialProgress;
                if (creatureTemplate.type === 'common') {
                    initialProgress = 50;
                } else if (creatureTemplate.type === 'rare') {
                    initialProgress = 25;
                } else if (creatureTemplate.type === 'epic') {
                    initialProgress = 15;
                } else {
                    initialProgress = 10;
                }
                
                const timeProgress = Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * (100 - initialProgress));
                const progressPercentage = initialProgress + timeProgress;
                
                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} before clicking again.`,
                    remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
                    progress: {
                        current: progressPercentage,
                        total: 100,
                        percentage: `${progressPercentage}%`
                    },
                    timing: {
                        start_time: lastClickTime.toISOString(),
                        estimated_finish_time: new Date(lastClickTime.getTime() + (requiredWaitTimeSeconds * 1000)).toISOString(),
                        wait_time_minutes: waitTimeMinutes
                    }
                });
            }
            
            // If we get here, enough time has passed
            console.log('Wait time completed - proceeding with upgrade');
            // Set progress to 100% to complete the merge
            user.creatures[creature1Index].upgrade_progress = 100;
            user.creatures[creature2Index].upgrade_progress = 100;
        }
        
        // Continue with existing code for upgrade process...
        // (Rest of your existing upgrade code follows)
        
        // Get stats for the target level
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
        const isAlreadyPartnered = (creature1PartnerId && creature1PartnerId.toString() === user.creatures[creature2Index]._id.toString()) ||
                                  (creature2PartnerId && creature2PartnerId.toString() === user.creatures[creature1Index]._id.toString());

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

        // Check if user has enough anima
        if (!user.currency || user.currency.anima < requiredAnima) {
            return res.status(400).json({
                success: false,
                message: `Not enough anima. Required: ${requiredAnima}`
            });
        }

        // Deduct anima
        user.currency.anima -= requiredAnima;

        // Update creature stats
        if (levelStats && typeof levelStats.health === 'number' && typeof levelStats.attack === 'number') {
            // Only update if we have valid number values
            user.creatures[creature1Index].health = Number(user.creatures[creature1Index].health || 0) + Number(levelStats.health || 0);
            user.creatures[creature1Index].attack = Number(user.creatures[creature1Index].attack || 0) + Number(levelStats.attack || 0);
            user.creatures[creature2Index].health = Number(user.creatures[creature2Index].health || 0) + Number(levelStats.health || 0);
            user.creatures[creature2Index].attack = Number(user.creatures[creature2Index].attack || 0) + Number(levelStats.attack || 0);
        }

        // Update upgrade progress
        user.creatures[creature1Index].upgrade_progress = isSecondClick ? 25 : isThirdClick ? 50 : isFourthClick ? 75 : 0;
        user.creatures[creature2Index].upgrade_progress = isSecondClick ? 25 : isThirdClick ? 50 : isFourthClick ? 75 : 0;

        // Mark as modified since we're updating nested arrays
        user.markModified('creatures');
        
        // Save user
        await user.save();

        // Track quest progress
        try {
            // Import quest service
            const questService = require('../service/questService');
            
            // Track creature upgrade for quest progress
            await questService.trackQuestProgress(userId, 'upgrade_creature', {
                creature_id: creature1Id,
                creature_type: creature1.creature_type,
                creature_rarity: creature1.rarity,
                target_level: targetLevel
            });
        } catch (questError) {
            console.error('Error tracking quest progress for creature upgrade:', questError);
            // Continue with response even if quest tracking fails
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
                
                // Calculate estimated finish time based on level
                const waitTimeMinutes = targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60;
                const estimatedFinishTime = new Date(now.getTime() + (waitTimeMinutes * 60 * 1000));
                
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;
                
                // IMPORTANT: Set progress to 50% for common creatures
                user.creatures[creature1Index].upgrade_progress = 50;
                user.creatures[creature2Index].upgrade_progress = 50;
                
                // IMPORTANT: Make sure each creature points to the other's ID, not its own
                user.creatures[creature1Index].upgrade_partner_id = user.creatures[creature2Index]._id;
                user.creatures[creature2Index].upgrade_partner_id = user.creatures[creature1Index]._id;
                
                // Store the estimated finish time
                user.creatures[creature1Index].estimated_finish_time = estimatedFinishTime;
                user.creatures[creature2Index].estimated_finish_time = estimatedFinishTime;
                
                // Create merge record for history
                const mergeRecord = {
                    creature1_id: creature1Id,
                    creature1_name: creature1.name,
                    creature1_level: creature1.level,
                    creature2_id: creature2Id,
                    creature2_name: creature2.name,
                    creature2_level: creature2.level,
                    start_time: now,
                    estimated_finish_time: estimatedFinishTime,
                    target_level: targetLevel,
                    progress: 50,  // 50% for common creatures
                    is_complete: false,
                    rarity: creatureTemplate.type,
                    wait_time_minutes: waitTimeMinutes,
                    anima_spent: requiredAnima,
                    current_step: 1,
                    required_steps: 2
                };

                // Initialize merging_history if it doesn't exist
                ensureMergingHistory(user);

                // Initialize active_merges array if it doesn't exist
                if (!user.active_merges) {
                    user.active_merges = [];
                }

                // Add to active merges
                user.active_merges.push({
                    creature1_id: creature1Id,
                    creature2_id: creature2Id,
                    start_time: now,
                    estimated_finish_time: estimatedFinishTime,
                    progress: 50,
                    last_update: now
                });

                // Check if there's already a record for this merge
                const existingMergeIndex = user.merging_history.findIndex(
                    m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                         (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
                );

                if (existingMergeIndex !== -1) {
                    // Update existing record
                    user.merging_history[existingMergeIndex] = {
                        ...user.merging_history[existingMergeIndex],
                        ...mergeRecord
                    };
                } else {
                    // Add new record
                    user.merging_history.push(mergeRecord);
                }

                // Make sure to mark the arrays as modified
                user.markModified('merging_history');
                user.markModified('active_merges');
                user.markModified('creatures');

                // Save the user
                await user.save();

                console.log('Merge record saved. User now has', user.merging_history.length, 'records in merging_history');

                return res.status(400).json({
                    success: false,
                    message: `Starting upgrade process. Please wait ${waitTimeMinutes} minutes before clicking again.`,
                    remaining_time: `${waitTimeMinutes}:00`,
                    progress: {
                        current: 50,
                        total: 100,
                        percentage: "50%"
                    },
                    timing: {
                        start_time: now,
                        estimated_finish_time: estimatedFinishTime,
                        wait_time_minutes: waitTimeMinutes
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
                user.creatures[creature1Index].upgrade_partner_id = user.creatures[creature2Index]._id;
                user.creatures[creature2Index].upgrade_partner_id = user.creatures[creature1Index]._id;
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
                user.creatures[creature1Index].upgrade_partner_id = user.creatures[creature2Index]._id;
                user.creatures[creature2Index].upgrade_partner_id = user.creatures[creature1Index]._id;
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
                user.creatures[creature1Index].upgrade_partner_id = user.creatures[creature2Index]._id;
                user.creatures[creature2Index].upgrade_partner_id = user.creatures[creature1Index]._id;
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

        // Update the merge history record with completion info
        if (user.merging_history) {
            const existingMergeIndex = user.merging_history.findIndex(
                m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                     (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
            );
            
            if (existingMergeIndex !== -1) {
                user.merging_history[existingMergeIndex].is_complete = true;
                user.merging_history[existingMergeIndex].progress = 100;
                user.merging_history[existingMergeIndex].completion_time = now;
                user.merging_history[existingMergeIndex].total_anima_spent = 
                    (user.merging_history[existingMergeIndex].anima_spent || 0) + animaCost;
                user.merging_history[existingMergeIndex].result_creature_id = mergedCreature._id;
            } else {
                // If no existing record, create a new one with complete status
                const newMergeRecord = {
                    creature1_id: creature1Id,
                    creature1_name: creature1.name,
                    creature1_level: creature1.level,
                    creature2_id: creature2Id,
                    creature2_name: creature2.name,
                    creature2_level: creature2.level,
                    start_time: new Date(now.getTime() - (requiredWaitTimeSeconds * 1000)), // Approximate start time
                    completion_time: now,
                    estimated_finish_time: now,
                    target_level: targetLevel,
                    progress: 100,
                    is_complete: true,
                    rarity: creatureTemplate.type,
                    wait_time_minutes: (targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60),
                    anima_spent: animaCost,
                    total_anima_spent: animaCost,
                    current_step: 2,
                    required_steps: 2,
                    result_creature_id: mergedCreature._id
                };
                user.merging_history.push(newMergeRecord);
            }
            
            user.markModified('merging_history');
        }

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
            creature_Id_reference: creature1.creature_Id_reference, // Preserve the reference ID
            base_attack: creature1.base_attack || 0,
            base_health: creature1.base_health || 0,
            attack: Number(levelStats.attack) || creature1.attack || 10,
            health: Number(levelStats.health) || creature1.health || 10,
            speed: Number(levelStats.speed) || creature1.speed || 1,
            armor: Number(levelStats.armor) || creature1.armor || 0,
            critical_damage_percentage: Number(levelStats.critical_damage_percentage) || creature1.critical_damage_percentage || 0,
            critical_damage: Number(levelStats.critical_damage) || creature1.critical_damage || 0,
            gold_coins: Number(levelStats.gold) || creature1.gold_coins || 0,
            arcane_energy: Number(levelStats.arcane_energy) || creature1.arcane_energy || 0,
            count: 1,
            image: creatureTemplate.image,
            description: creatureTemplate.description
        };

        let isComplete = false;
        let progressPercentage = 0;
        let totalProgress = previousProgress;

        // Generate new progress based on rarity and click count
        let newProgress;
        if (creatureTemplate.type === 'common') {
            // Common creatures: 50% first click, 50% second click
            newProgress = 50;
        } else if (creatureTemplate.type === 'rare') {
            if (clickCount === 1) {
                // First click: 25%
                newProgress = 25;
            } else if (clickCount === 2) {
                // Second click: 25%
                newProgress = 25;
            } else if (clickCount === 3) {
                // Third click: 25%
                newProgress = 25;
            } else {
                // Fourth click: remaining progress
                newProgress = 100 - totalProgress;
            }
        } else if (creatureTemplate.type === 'epic') {
            if (clickCount <= 7) {
                // First 7 clicks: 12-15% each
                newProgress = Math.floor(Math.random() * 4) + 12;
            } else {
                // Eighth click: remaining progress
                newProgress = 100 - totalProgress;
            }
        } else if (creatureTemplate.type === 'legendary' || creatureTemplate.type === 'elite') {
            if (clickCount <= 9) {
                // First 9 clicks: 10-12% each
                newProgress = Math.floor(Math.random() * 3) + 10;
            } else {
                // Tenth click: remaining progress
                newProgress = 100 - totalProgress;
            }
        }

        // Modify progress tracking to always be at least 15% per click
        if (newProgress < 15 && creatureTemplate.type !== 'common') {
            newProgress = 15;
        }

        progressPercentage = newProgress;
        totalProgress += newProgress;

        // If click would push us over 100%, cap at 100%
        if (totalProgress > 100) {
            progressPercentage = 100 - (totalProgress - newProgress);
            totalProgress = 100;
        }

        console.log('Progress calculation:', {
            previousProgress,
            newProgress,
            progressPercentage,
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
            
            // Update the merging history record with final details
            if (user.merging_history) {
                const existingMergeIndex = user.merging_history.findIndex(
                    m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                         (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
                );
                
                if (existingMergeIndex !== -1) {
                    // Set completion details
                    user.merging_history[existingMergeIndex].is_complete = true;
                    user.merging_history[existingMergeIndex].completion_time = new Date();
                    user.merging_history[existingMergeIndex].total_anima_spent = 
                        (user.merging_history[existingMergeIndex].anima_spent || 0) + animaCost;
                    user.merging_history[existingMergeIndex].result_creature_id = mergedCreature._id;
                    user.merging_history[existingMergeIndex].progress = 100;
                }
                
                user.markModified('merging_history');
            }
            
            // Remove from active_merges when complete
            if (!user.active_merges) {
                user.active_merges = [];
            }
            
            user.active_merges = user.active_merges.filter(
                m => !((m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                      (m.creature1_id === creature2Id && m.creature2_id === creature1Id))
            );
            user.markModified('active_merges');
            
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
            
            // Update the merging history record with progress
            if (user.merging_history) {
                const existingMergeIndex = user.merging_history.findIndex(
                    m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                         (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
                );
                
                if (existingMergeIndex !== -1) {
                    user.merging_history[existingMergeIndex].progress = totalProgress;
                    user.merging_history[existingMergeIndex].last_update = new Date();
                    user.merging_history[existingMergeIndex].anima_spent = 
                        (user.merging_history[existingMergeIndex].anima_spent || 0) + animaCost;
                }
                
                user.markModified('merging_history');
            }
        }

        // Track merging history
        ensureMergingHistory(user);

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

/**
 * @route GET /:userId/merging-history
 * @desc Get user's creature merging history
 * @access Public
 */
router.get('/:userId/merging-history', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Validate inputs
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
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
        
        // Return merging history or empty array if not present
        const mergingHistory = user.merging_history || [];
        
        res.status(200).json({
            success: true,
            message: 'Merging history fetched successfully',
            data: {
                merging_history: mergingHistory,
                in_progress: mergingHistory.filter(record => !record.is_complete),
                completed: mergingHistory.filter(record => record.is_complete)
            }
        });
    } catch (error) {
        console.error('Error fetching merging history:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /:userId/collect-upgrade
 * @desc Collect a completed creature upgrade without requiring anima
 * @access Public
 */
router.post('/:userId/collect-upgrade', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id } = req.body;

        if (!userId || !creature1Id || !creature2Id) {
            return res.status(400).json({
                success: false,
                message: 'User ID and both creature IDs are required'
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
        if (creature1.level !== creature2.level) {
            return res.status(400).json({
                success: false,
                message: 'Both creatures must be at the same level'
            });
        }

        // Validate that the level is a milestone level (10, 20, or 30)
        if (currentLevel !== 10 && currentLevel !== 20 && currentLevel !== 30) {
            return res.status(400).json({
                success: false,
                message: 'Creatures must be at level 10, 20, or 30 to upgrade'
            });
        }

        // Determine target level
        const targetLevel = currentLevel + 1;

        // Find the creature template for proper stats
        let creatureTemplate = null;
        
        // Try by creature_Id_reference first
        if (creature1.creature_Id_reference) {
            creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_Id_reference });
        }
        
        // If not found, try by name
        if (!creatureTemplate && creature1.name) {
            creatureTemplate = await Creature.findOne({ name: creature1.name });
        }
        
        // If still not found, try by creature_type
        if (!creatureTemplate && creature1.creature_type) {
            creatureTemplate = await Creature.findOne({ creature_type: creature1.creature_type });
        }
        
        // Last resort, try by creature_id
        if (!creatureTemplate && creature1.creature_id) {
            creatureTemplate = await Creature.findOne({ _id: creature1.creature_id });
        }
        
        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: `Creature template not found for ${creature1.name || creature1.creature_type}`
            });
        }

        // Get level stats for the target level
        const levelStats = creatureTemplate.level_stats.find(stat => stat.level === targetLevel);
        
        // If level stats not found, use calculated values
        let attack, health, goldCoins, arcaneEnergy;
        
        if (levelStats) {
            attack = Number(levelStats.attack) || 0;
            health = Number(levelStats.health) || 0;
            goldCoins = Number(levelStats.gold) || 0;
            arcaneEnergy = Number(levelStats.arcane_energy) || 0;
        } else {
            // Calculate based on creature type and level
            const baseAttack = creature1.base_attack || creatureTemplate.base_attack || 45;
            const baseHealth = creature1.base_health || creatureTemplate.base_health || 250;
            
            // Apply level multipliers based on type
            let attackGrowth = 0.03; // Default 3% growth
            let healthGrowth = 0.03; // Default 3% growth
            const creatureType = creature1.type || creatureTemplate.type || 'common';
            
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
            
            // Calculate stats for the new level with milestone bonus
            attack = baseAttack;
            health = baseHealth;
            
            for (let level = 1; level < targetLevel; level++) {
                attack += Math.round(attack * attackGrowth);
                health += Math.round(health * healthGrowth);
            }
            
            // Add milestone bonus (15%)
            attack = Math.round(attack * 1.15);
            health = Math.round(health * 1.15);
            
            // Calculate gold and arcane energy
            const baseGold = creature1.gold_coins || creatureTemplate.gold_coins || 50;
            const baseArcaneEnergy = creature1.arcane_energy || creatureTemplate.arcane_energy || 99;
            
            const levelMultiplier = Math.pow(2, targetLevel - 1);
            goldCoins = Math.round(baseGold * levelMultiplier);
            arcaneEnergy = Math.round(baseArcaneEnergy * levelMultiplier);
        }
        
        // Ensure all stats are valid numbers
        attack = Number(attack) || creature1.attack || 50;
        health = Number(health) || creature1.health || 300;
        goldCoins = Number(goldCoins) || creature1.gold_coins || 50;
        arcaneEnergy = Number(arcaneEnergy) || creature1.arcane_energy || 99;

        // Create the merged creature
        const mergedCreature = {
            creature_id: creature1.creature_id,
            name: creatureTemplate.name,
            level: targetLevel,
            building_index: creature1.building_index,
            creature_type: creature1.creature_type,
            creature_Id_reference: creature1.creature_Id_reference, // Preserve the reference ID
            base_attack: creature1.base_attack || creatureTemplate.base_attack || 45,
            base_health: creature1.base_health || creatureTemplate.base_health || 250,
            attack: attack,
            health: health,
            speed: Number(creature1.speed) || Number(creatureTemplate.speed) || 100,
            armor: Number(creature1.armor) || Number(creatureTemplate.armor) || 0,
            critical_damage_percentage: Number(creature1.critical_damage_percentage) || Number(creatureTemplate.critical_damage_percentage) || 25,
            critical_damage: Number(creature1.critical_damage) || Number(creatureTemplate.critical_damage) || 100,
            gold_coins: goldCoins,
            arcane_energy: arcaneEnergy,
            count: 1,
            image: creatureTemplate.image,
            description: creatureTemplate.description
        };

        // Remove both original creatures
        user.creatures.splice(Math.max(creature1Index, creature2Index), 1);
        user.creatures.splice(Math.min(creature1Index, creature2Index), 1);
        
        // Add the merged creature
        user.creatures.push(mergedCreature);

        // Track merging history
        ensureMergingHistory(user);

        // Check for existing merge record first
        const existingMergeIndex = user.merging_history.findIndex(
            m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                 (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
        );

        // Calculate time values for merging process
        const currentTime = new Date();

        // Calculate wait time based on creature level and rarity
        let waitTimeMinutes = 15; // Default for level 10 common
        const creatureType = creatureTemplate.type || 'common';

        if (currentLevel === 20) {
            waitTimeMinutes = 30; // Default for level 20 common
        } else if (currentLevel === 30) {
            waitTimeMinutes = 60; // Default for level 30 common
        }

        // Adjust based on rarity
        switch(creatureType.toLowerCase()) {
            case 'rare':
                waitTimeMinutes *= 2; // Double time for rare
                break;
            case 'epic':
                waitTimeMinutes *= 4; // 4x time for epic
                break;
            case 'legendary':
                waitTimeMinutes *= 8; // 8x time for legendary
                break;
            case 'elite':
                waitTimeMinutes *= 12; // 12x time for elite
                break;
        }

        // Calculate start time (appropriate time in the past based on rarity and level)
        const startTime = new Date(currentTime.getTime() - (waitTimeMinutes * 60 * 1000));

        // Create merge record
        const mergeRecord = {
            creature1_id: creature1Id,
            creature1_name: creature1.name,
            creature1_type: creature1.creature_type,
            creature1_level: creature1.level,
            creature2_id: creature2Id,
            creature2_name: creature2.name,
            creature2_type: creature2.creature_type, 
            creature2_level: creature2.level,
            target_level: targetLevel,
            rarity: creatureTemplate.type,
            progress: 100,
            current_step: 1,
            required_steps: 1,
            start_time: startTime,
            end_time: currentTime,
            completion_time: currentTime,
            last_update: currentTime,
            is_complete: true,
            result_creature_id: mergedCreature._id,
            wait_time_minutes: waitTimeMinutes
        };

        // Update or add record
        if (existingMergeIndex !== -1) {
            // Update existing record
            console.log('Updating existing merge record at index:', existingMergeIndex);
            user.merging_history[existingMergeIndex] = {
                ...user.merging_history[existingMergeIndex],
                ...mergeRecord
            };
        } else {
            // Add new record
            console.log('Adding new merge record');
            user.merging_history.push(mergeRecord);
        }

        // Make sure to mark the arrays as modified
        user.markModified('merging_history');
        user.markModified('creatures');

        console.log('Merge record saved. User now has', user.merging_history.length, 'records in merging_history');

        // IMPORTANT: Clear the active_merges array of this upgrade
        if (user.active_merges && user.active_merges.length > 0) {
            user.active_merges = user.active_merges.filter(
                m => !((m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                       (m.creature1_id === creature2Id && m.creature2_id === creature1Id))
            );
            user.markModified('active_merges');
            console.log('Removed upgrade from active_merges array');
        }

        // Clean up any existing upgrade partnership records
        user.creatures.forEach((c, index) => {
            if (c.upgrade_partner_id && 
                (c.upgrade_partner_id.toString() === creature1Id || 
                 c.upgrade_partner_id.toString() === creature2Id)) {
                user.creatures[index].upgrade_partner_id = null;
                user.creatures[index].upgrade_progress = 0;
                user.creatures[index].last_upgrade_click_time = null;
                user.creatures[index].estimated_finish_time = null;
            }
        });

        user.markModified('creatures');

        // Save the user
        await user.save();

        // Verify the save was successful
        const savedUser = await User.findOne({ userId });
        console.log('Merging history after save:', savedUser.merging_history ? savedUser.merging_history.length : 0, 'records');
        console.log('Active merges after save:', savedUser.active_merges ? savedUser.active_merges.length : 0, 'records');

        // Track quest progress
        try {
            // Import quest service
            const questService = require('../service/questService');
            
            // Track creature upgrade for quest progress
            await questService.trackQuestProgress(userId, 'upgrade_creature', {
                creature_id: creature1Id,
                creature_type: creature1.creature_type,
                creature_rarity: creature1.type,
                target_level: targetLevel
            });
        } catch (questError) {
            console.error('Error tracking quest progress for creature upgrade:', questError);
            // Continue with response even if quest tracking fails
        }
        
        res.status(200).json({
            success: true,
            message: `Successfully merged creatures from level ${currentLevel} to ${targetLevel}`,
            data: {
                merged_creature: mergedCreature,
                anima_cost: 0, // No anima cost for collection
                remaining_anima: user.currency?.anima || 0,
                is_complete: true,
                progress_percentage: 100,
                total_progress: 100,
                rarity: creatureTemplate.type,
                timing: {
                    start_time: startTime,
                    end_time: currentTime,
                    wait_time_minutes: waitTimeMinutes
                }
            }
        });
    } catch (error) {
        console.error('Error in collect-upgrade:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /:userId/reset-upgrade
 * @desc Reset the upgrade progress and partnership for creatures (for testing)
 * @access Public
 */
router.post('/:userId/reset-upgrade', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
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

        // Ensure merging_history exists
        ensureMergingHistory(user);

        // If creature IDs are provided, reset only those creatures
        if (creature1Id && creature2Id) {
            const creature1Index = user.creatures.findIndex(c => c._id.toString() === creature1Id);
            const creature2Index = user.creatures.findIndex(c => c._id.toString() === creature2Id);

            if (creature1Index === -1 || creature2Index === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'One or both creatures not found'
                });
            }

            // Reset both creatures
            user.creatures[creature1Index].upgrade_progress = 0;
            user.creatures[creature1Index].upgrade_partner_id = null;
            user.creatures[creature1Index].last_upgrade_click_time = null;
            user.creatures[creature1Index].estimated_finish_time = null;

            user.creatures[creature2Index].upgrade_progress = 0;
            user.creatures[creature2Index].upgrade_partner_id = null;
            user.creatures[creature2Index].last_upgrade_click_time = null;
            user.creatures[creature2Index].estimated_finish_time = null;

            // Also remove any merging history records for these creatures
            if (user.merging_history && user.merging_history.length > 0) {
                user.merging_history = user.merging_history.filter(
                    record => !(
                        (record.creature1_id === creature1Id && record.creature2_id === creature2Id) ||
                        (record.creature1_id === creature2Id && record.creature2_id === creature1Id)
                    )
                );
                user.markModified('merging_history');
            }
        } else {
            // Reset all creatures' upgrade info
            user.creatures.forEach((creature, index) => {
                user.creatures[index].upgrade_progress = 0;
                user.creatures[index].upgrade_partner_id = null;
                user.creatures[index].last_upgrade_click_time = null;
                user.creatures[index].estimated_finish_time = null;
            });

            // Clear merging history
            user.merging_history = [];
            user.markModified('merging_history');
        }

        user.markModified('creatures');
        await user.save();

        res.status(200).json({
            success: true,
            message: creature1Id && creature2Id ? 
                'Upgrade progress reset for the specified creatures' : 
                'Upgrade progress reset for all creatures',
            data: {
                creatures_reset: creature1Id && creature2Id ? 2 : user.creatures.length,
                merging_history_cleared: true
            }
        });
    } catch (error) {
        console.error('Error resetting upgrade progress:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Add this new endpoint at the end of the file, before module.exports
/**
 * @route POST /:userId/auto-collect-upgrade
 * @desc Automatically collect a completed creature upgrade without user clicking again (for testing)
 * @access Public
 */
router.post('/:userId/auto-collect-upgrade', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id } = req.body;

        if (!userId || !creature1Id || !creature2Id) {
            return res.status(400).json({
                success: false,
                message: 'User ID and both creature IDs are required'
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

        // Check if these creatures are partnered for upgrade
        const isPartnered = 
            (creature1.upgrade_partner_id && creature1.upgrade_partner_id.toString() === creature2._id.toString()) ||
            (creature2.upgrade_partner_id && creature2.upgrade_partner_id.toString() === creature1._id.toString());

        if (!isPartnered) {
            return res.status(400).json({
                success: false,
                message: 'These creatures are not partnered for upgrade'
            });
        }

        // Check if wait time has completed
        const lastClickTime = creature1.last_upgrade_click_time || creature2.last_upgrade_click_time;
        if (!lastClickTime) {
            return res.status(400).json({
                success: false,
                message: 'No upgrade in progress for these creatures'
            });
        }

        const currentLevel = creature1.level;
        const targetLevel = currentLevel + 1;
        const now = new Date();
        const timeSinceLastClick = (now - new Date(lastClickTime)) / 1000; // Convert to seconds
        const requiredWaitTimeSeconds = 
            (targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60) * 60; // Convert minutes to seconds

        if (timeSinceLastClick < requiredWaitTimeSeconds) {
            const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
            const remainingMinutes = Math.floor(remainingSeconds / 60);
            const remainingSecondsFormatted = remainingSeconds % 60;
            
            return res.status(400).json({
                success: false,
                message: `Wait time not complete. Please wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} before collecting.`,
                remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`
            });
        }

        // Find creature template for stats
        let creatureTemplate = null;
        if (creature1.creature_Id_reference) {
            creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_Id_reference });
        }
        if (!creatureTemplate && creature1.name) {
            creatureTemplate = await Creature.findOne({ name: creature1.name });
        }
        if (!creatureTemplate && creature1.creature_type) {
            creatureTemplate = await Creature.findOne({ creature_type: creature1.creature_type });
        }
        if (!creatureTemplate && creature1.creature_id) {
            creatureTemplate = await Creature.findOne({ _id: creature1.creature_id });
        }
        
        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: `Creature template not found for ${creature1.name || creature1.creature_type}`
            });
        }

        // Get level stats for the target level
        const levelStats = creatureTemplate.level_stats.find(stat => stat.level === targetLevel);
        
        // Create the merged creature
        const mergedCreature = {
            creature_id: creature1.creature_id,
            name: creatureTemplate.name,
            level: targetLevel,
            building_index: creature1.building_index,
            creature_type: creature1.creature_type,
            creature_Id_reference: creature1.creature_Id_reference,
            base_attack: creature1.base_attack || creatureTemplate.base_attack || 45,
            base_health: creature1.base_health || creatureTemplate.base_health || 250,
            attack: Number(levelStats?.attack) || creature1.attack || 50,
            health: Number(levelStats?.health) || creature1.health || 300,
            speed: Number(levelStats?.speed) || creature1.speed || 100,
            armor: Number(levelStats?.armor) || creature1.armor || 0,
            critical_damage_percentage: Number(levelStats?.critical_damage_percentage) || creature1.critical_damage_percentage || 25,
            critical_damage: Number(levelStats?.critical_damage) || creature1.critical_damage || 100,
            gold_coins: Number(levelStats?.gold) || creature1.gold_coins || 50,
            arcane_energy: Number(levelStats?.arcane_energy) || creature1.arcane_energy || 99,
            count: 1,
            image: creatureTemplate.image,
            description: creatureTemplate.description
        };

        // Remove both original creatures
        user.creatures.splice(Math.max(creature1Index, creature2Index), 1);
        user.creatures.splice(Math.min(creature1Index, creature2Index), 1);
        
        // Add the merged creature
        user.creatures.push(mergedCreature);

        // Update merge history
        const mergeHistory = ensureMergingHistory(user);
        const existingMergeIndex = mergeHistory.findIndex(
            m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                 (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
        );
        
        if (existingMergeIndex !== -1) {
            user.merging_history[existingMergeIndex].is_complete = true;
            user.merging_history[existingMergeIndex].progress = 100;
            user.merging_history[existingMergeIndex].completion_time = now;
            user.merging_history[existingMergeIndex].result_creature_id = mergedCreature._id;
        } else {
            // Create new merge record
            const waitTimeMinutes = targetLevel === 11 ? 15 : targetLevel === 21 ? 30 : 60;
            user.merging_history.push({
                creature1_id: creature1Id,
                creature1_name: creature1.name,
                creature1_level: creature1.level,
                creature2_id: creature2Id,
                creature2_name: creature2.name,
                creature2_level: creature2.level,
                start_time: new Date(lastClickTime),
                completion_time: now,
                estimated_finish_time: new Date(new Date(lastClickTime).getTime() + (waitTimeMinutes * 60 * 1000)),
                target_level: targetLevel,
                progress: 100,
                is_complete: true,
                rarity: creatureTemplate.type,
                wait_time_minutes: waitTimeMinutes,
                result_creature_id: mergedCreature._id
            });
        }

        // Remove from active_merges when complete
        if (!user.active_merges) {
            user.active_merges = [];
        }

        user.active_merges = user.active_merges.filter(
            m => !((m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                  (m.creature1_id === creature2Id && m.creature2_id === creature1Id))
        );

        user.markModified('merging_history');
        user.markModified('active_merges');
        user.markModified('creatures');
        await user.save();

        return res.status(200).json({
            success: true,
            message: `Successfully auto-collected merged creature from level ${currentLevel} to ${targetLevel}`,
            data: {
                merged_creature: mergedCreature,
                timing: {
                    start_time: new Date(lastClickTime),
                    completion_time: now,
                    wait_time_seconds: Math.floor(timeSinceLastClick)
                }
            }
        });
    } catch (error) {
        console.error('Error in auto-collect-upgrade:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Add a new route to get active merges for a user
/**
 * @route GET /:userId/active-merges
 * @desc Get all active creature merges for a user
 * @access Public
 */
router.get('/:userId/active-merges', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
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
        
        // If active_merges doesn't exist, initialize it
        if (!user.active_merges) {
            user.active_merges = [];
            user.markModified('active_merges');
            await user.save();
        }
        
        // Get current time to calculate progress
        const now = new Date();
        
        // Process each active merge to add real-time information
        const activeMergesWithDetails = await Promise.all(user.active_merges.map(async (merge) => {
            try {
                // Find the creatures
                const creature1 = user.creatures.find(c => c._id.toString() === merge.creature1_id);
                const creature2 = user.creatures.find(c => c._id.toString() === merge.creature2_id);
                
                if (!creature1 || !creature2) {
                    return {
                        ...merge,
                        status: 'error',
                        error: 'One or both creatures not found',
                        should_be_removed: true
                    };
                }
                
                // Find the creature template
                let creatureTemplate = null;
                if (creature1.creature_Id_reference) {
                    creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_Id_reference });
                }
                if (!creatureTemplate && creature1.name) {
                    creatureTemplate = await Creature.findOne({ name: creature1.name });
                }
                if (!creatureTemplate && creature1.creature_type) {
                    creatureTemplate = await Creature.findOne({ creature_type: creature1.creature_type });
                }
                
                const currentLevel = creature1.level;
                const targetLevel = currentLevel + 1;
                const rarity = creatureTemplate ? creatureTemplate.type : 'unknown';
                
                // Calculate time-based progress
                const startTime = new Date(merge.start_time);
                const timeSinceStart = (now - startTime) / 1000; // in seconds
                
                // Get wait time based on creature level and rarity
                let waitTimeMinutes = 15; // Default for common level 10
                
                if (currentLevel === 20) {
                    waitTimeMinutes = 30;
                } else if (currentLevel === 30) {
                    waitTimeMinutes = 60;
                }
                
                // Adjust based on rarity
                if (rarity === 'rare') {
                    waitTimeMinutes *= 2;
                } else if (rarity === 'epic') {
                    waitTimeMinutes *= 4;
                } else if (rarity === 'legendary' || rarity === 'elite') {
                    waitTimeMinutes *= 8;
                }
                
                const requiredWaitTimeSeconds = waitTimeMinutes * 60;
                
                // Calculate progress
                let progressPercentage = 50; // Start at 50% for first click
                if (timeSinceStart > 0) {
                    const timeProgress = Math.min(50, Math.floor((timeSinceStart / requiredWaitTimeSeconds) * 50));
                    progressPercentage = 50 + timeProgress;
                }
                
                // Calculate remaining time
                const remainingSeconds = Math.max(0, requiredWaitTimeSeconds - timeSinceStart);
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecondsFormatted = Math.floor(remainingSeconds % 60);
                
                // Check if merge is ready to collect
                const isReadyToCollect = timeSinceStart >= requiredWaitTimeSeconds;
                
                return {
                    ...merge,
                    creature1_name: creature1.name,
                    creature1_level: creature1.level,
                    creature2_name: creature2.name,
                    creature2_level: creature2.level,
                    rarity,
                    current_progress: progressPercentage,
                    target_level: targetLevel,
                    time_elapsed_seconds: Math.floor(timeSinceStart),
                    required_wait_time_seconds: requiredWaitTimeSeconds,
                    remaining_time: {
                        seconds: Math.floor(remainingSeconds),
                        formatted: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`
                    },
                    is_ready_to_collect: isReadyToCollect,
                    status: 'active'
                };
            } catch (error) {
                console.error('Error processing merge:', error);
                return {
                    ...merge,
                    status: 'error',
                    error: error.message
                };
            }
        }));
        
        // Filter out any merges that should be removed
        const validActiveMerges = activeMergesWithDetails.filter(merge => !merge.should_be_removed);
        
        // If we found merges that should be removed, update the user
        if (validActiveMerges.length !== activeMergesWithDetails.length) {
            user.active_merges = user.active_merges.filter(merge => 
                !activeMergesWithDetails.some(
                    m => m.should_be_removed && 
                    ((m.creature1_id === merge.creature1_id && m.creature2_id === merge.creature2_id) ||
                     (m.creature1_id === merge.creature2_id && m.creature2_id === merge.creature1_id))
                )
            );
            user.markModified('active_merges');
            await user.save();
        }
        
        // Return the active merges
        res.status(200).json({
            success: true,
            message: 'Active merges fetched successfully',
            data: {
                active_merges: validActiveMerges,
                count: validActiveMerges.length,
                ready_to_collect: validActiveMerges.filter(merge => merge.is_ready_to_collect).length
            }
        });
    } catch (error) {
        console.error('Error fetching active merges:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Check upgrade progress
router.get('/check-upgrade-progress/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { creature1Id, creature2Id } = req.query;

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

        // Check if these creatures are partnered for upgrade
        const isPartnered = 
            (creature1.upgrade_partner_id && creature1.upgrade_partner_id.toString() === creature2._id.toString()) ||
            (creature2.upgrade_partner_id && creature2.upgrade_partner_id.toString() === creature1._id.toString());

        if (!isPartnered) {
            return res.status(400).json({
                success: false,
                message: 'These creatures are not partnered for upgrade'
            });
        }

        // Check if wait time has completed
        const lastClickTime = creature1.last_upgrade_click_time || creature2.last_upgrade_click_time;
        if (!lastClickTime) {
            return res.status(400).json({
                success: false,
                message: 'No upgrade in progress for these creatures'
            });
        }

        // Find creature template for determining rarity
        let creatureTemplate = null;
        if (creature1.creature_Id_reference) {
            creatureTemplate = await Creature.findOne({ creature_Id: creature1.creature_Id_reference });
        }
        if (!creatureTemplate && creature1.name) {
            creatureTemplate = await Creature.findOne({ name: creature1.name });
        }
        if (!creatureTemplate && creature1.creature_type) {
            creatureTemplate = await Creature.findOne({ creature_type: creature1.creature_type });
        }

        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Creature template not found'
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

        // Check progress
        const now = new Date();
        const startTime = new Date(lastClickTime);
        const timeSinceLastClick = (now - startTime) / 1000; // Convert to seconds
        const requiredWaitTimeSeconds = requiredWaitTimeMinutes * 60;
        const estimatedFinishTime = new Date(startTime.getTime() + (requiredWaitTimeSeconds * 1000));

        // Calculate if upgrade is ready
        let isReady = timeSinceLastClick >= requiredWaitTimeSeconds;

        // Calculate remaining time
        const remainingSeconds = Math.max(0, Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick));
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        const remainingSecondsFormatted = remainingSeconds % 60;
        
        // Calculate progress percentage
        const progressPercentage = Math.min(100, Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100));

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
                gemCost = 500;
        }

        return res.status(200).json({
            success: isReady,
            message: isReady ? 
                'Upgrade is ready to complete.' : 
                `You must wait the full ${requiredWaitTimeMinutes} minutes before completing the merge. Please wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} more.`,
            remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
            progress: {
                current: progressPercentage,
                total: 100,
                percentage: `${progressPercentage}%`
            },
            timing: {
                start_time: startTime.toISOString(),
                current_time: now.toISOString(),
                estimated_finish_time: estimatedFinishTime.toISOString(),
                time_elapsed_seconds: Math.floor(timeSinceLastClick),
                time_remaining_seconds: remainingSeconds,
                required_wait_time_minutes: requiredWaitTimeMinutes
            },
            gems_required_to_speedup: gemCost,
            is_ready: isReady
        });
    } catch (error) {
        console.error('Error checking upgrade progress:', error);
        return res.status(500).json({
            success: false,
            message: `Server error: ${error.message}`
        });
    }
});

module.exports = router;
