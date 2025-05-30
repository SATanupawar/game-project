const express = require('express');
const router = express.Router();
const creatureService = require('../service/creatureService');
const Creature = require('../models/creature');
const User = require('../models/user');
const CreatureSlot = require('../models/creatureSlot');
const mongoose = require('mongoose');

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
            requiredWaitTimeMinutes = targetLevel === 11 ? 2 : targetLevel === 21 ? 5 : 10; // Changed from 5/10/20 to 2/5/10
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

        // Find creatures
        const creature1Index = user.creatures.findIndex(c => c._id.toString() === creature1Id);
        const creature2Index = user.creatures.findIndex(c => c._id.toString() === creature2Id);

        if (creature1Index === -1 || creature2Index === -1) {
            return res.status(404).json({
                success: false,
                message: 'One or both creatures not found'
            });
        }

        const creature1 = user.creatures[creature1Index];
        const creature2 = user.creatures[creature2Index];

        // Check if both creatures are at the same level
        if (creature1.level !== creature2.level) {
            return res.status(400).json({
                success: false,
                message: 'Both creatures must be at the same milestone level (10, 20, or 30)'
            });
        }

        // Determine target level
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
        
        if (!creatureTemplate) {
            return res.status(404).json({
                success: false,
                message: `Creature template not found for ${creature1.name || creature1.creature_type}`
            });
        }

        // Calculate anima cost
        let animaCost;
        if (creature1.upgrade_progress && creature1.upgrade_progress > 0) {
            // Subsequent click
        switch (creatureTemplate.type) {
            case 'common':
                    animaCost = currentLevel === 10 ? 30 : currentLevel === 20 ? 60 : 90;
                break;
            case 'rare':
                    animaCost = currentLevel === 10 ? 60 : currentLevel === 20 ? 120 : 180;
                break;
            case 'epic':
                    animaCost = currentLevel === 10 ? 90 : currentLevel === 20 ? 180 : 270;
                break;
            case 'legendary':
                    animaCost = currentLevel === 10 ? 120 : currentLevel === 20 ? 240 : 360;
                break;
            case 'elite':
                    animaCost = currentLevel === 10 ? 150 : currentLevel === 20 ? 300 : 450;
                    break;
                default:
                    animaCost = 100;
            }
        } else {
            // First click
            switch (creatureTemplate.type) {
                case 'common':
                    animaCost = currentLevel === 10 ? 100 : currentLevel === 20 ? 200 : 300;
                    break;
                case 'rare':
                    animaCost = currentLevel === 10 ? 200 : currentLevel === 20 ? 400 : 600;
                    break;
                case 'epic':
                    animaCost = currentLevel === 10 ? 600 : currentLevel === 20 ? 1200 : 1800;
                    break;
                case 'legendary':
                    animaCost = currentLevel === 10 ? 1200 : currentLevel === 20 ? 2400 : 4800;
                    break;
                case 'elite':
                    animaCost = currentLevel === 10 ? 1400 : currentLevel === 20 ? 2800 : 4600;
                break;
            default:
                    animaCost = 100;
            }
        }

        // Check if user has enough anima
        if (!user.currency || user.currency.anima < animaCost) {
            return res.status(400).json({
                success: false,
                message: `Not enough anima. Required: ${animaCost}, Available: ${user.currency?.anima || 0}`
            });
        }

        // Deduct anima
        user.currency.anima -= animaCost;

        // Calculate wait time based on creature type and level
        let waitTimeMinutes;
        if (creatureTemplate.type === 'common') {
            waitTimeMinutes = targetLevel === 11 ? 2 : targetLevel === 21 ? 5 : 10;
        } else if (creatureTemplate.type === 'rare') {
            waitTimeMinutes = targetLevel === 11 ? 30 : targetLevel === 21 ? 60 : 90;
        } else if (creatureTemplate.type === 'epic') {
            waitTimeMinutes = targetLevel === 11 ? 60 : targetLevel === 21 ? 120 : 240;
                } else {
            waitTimeMinutes = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
        }

        // IMPORTANT: Just start the timer, don't complete the merge
                const now = new Date();
        
        // Set partner IDs if first time
        if (!creature1.upgrade_partner_id || !creature2.upgrade_partner_id) {
            user.creatures[creature1Index].upgrade_partner_id = creature2._id;
            user.creatures[creature2Index].upgrade_partner_id = creature1._id;
        }
        
        // Set minimal progress if none exists
        if (!creature1.upgrade_progress) {
            user.creatures[creature1Index].upgrade_progress = 1;
            user.creatures[creature2Index].upgrade_progress = 1;
        }
        
        // Always update the timer
                user.creatures[creature1Index].last_upgrade_click_time = now;
                user.creatures[creature2Index].last_upgrade_click_time = now;

        // Update active_merges entry
        if (!user.active_merges) {
            user.active_merges = [];
        }
        
        const existingMergeIndex = user.active_merges.findIndex(
                m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                     (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
            );
            
            if (existingMergeIndex !== -1) {
            // Update existing record with new timer
            user.active_merges[existingMergeIndex].start_time = now;
            user.active_merges[existingMergeIndex].estimated_finish_time = 
                new Date(now.getTime() + (waitTimeMinutes * 60 * 1000));
            } else {
            // Create new record
            user.active_merges.push({
                    creature1_id: creature1Id,
                    creature1_name: creature1.name,
                    creature1_level: creature1.level,
                    creature2_id: creature2Id,
                    creature2_name: creature2.name,
                    creature2_level: creature2.level,
                start_time: now,
                estimated_finish_time: new Date(now.getTime() + (waitTimeMinutes * 60 * 1000)),
                    target_level: targetLevel,
                progress: creature1.upgrade_progress || 1,
                is_complete: false,
                    rarity: creatureTemplate.type,
                wait_time_minutes: waitTimeMinutes,
                anima_spent: animaCost
            });
        }

        // Save user
        user.markModified('creatures');
            user.markModified('active_merges');
        await user.save();
        
        // Return success response - ALWAYS return timer started message
        return res.status(200).json({
            success: true,
            message: `Evolution timer started! Wait ${waitTimeMinutes} minutes before collecting.`,
                anima_cost: animaCost,
                remaining_anima: user.currency.anima,
            timer: {
                wait_minutes: waitTimeMinutes,
                start_time: now.toISOString(),
                estimated_finish_time: new Date(now.getTime() + (waitTimeMinutes * 60 * 1000)).toISOString()
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
        // Define now variable here at the top of the function for use throughout
        const now = new Date();

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
        
        // Get the lastClickTime from either creature near the top of the function
        const lastClickTime = creature1.last_upgrade_click_time || creature2.last_upgrade_click_time || now;
        const timeSinceLastClick = lastClickTime ? (now - new Date(lastClickTime)) / 1000 : 0;

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
        
        // Check if this merge is already in progress
        const activeMergeIndex = user.active_merges ? user.active_merges.findIndex(
            m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                 (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
        ) : -1;

        let currentProgress = 0;
        let totalSteps = creatureTemplate.type === 'common' ? 2 : 
                         creatureTemplate.type === 'rare' ? 4 : 
                         creatureTemplate.type === 'epic' ? 8 : 10;
        let currentStep = 1;
        
        // Check if we have an active merge record
        if (activeMergeIndex !== -1) {
            currentProgress = user.active_merges[activeMergeIndex].progress || 0;
            currentStep = user.active_merges[activeMergeIndex].current_step || 1;
        }

        // Generate random progress based on creature rarity and current progress
        let progressIncrement;
        if (creatureTemplate.type === 'common') {
            if (currentProgress < 50) {
                // First collection: 50-60%
                progressIncrement = Math.floor(Math.random() * 11) + 50; // 50-60%
        } else {
                // Second collection: remaining progress
                progressIncrement = 100 - currentProgress; // Complete it
            }
        } else if (creatureTemplate.type === 'rare') {
            // Rare: 20-30% per step (auto-collect gives bonus)
            progressIncrement = Math.floor(Math.random() * 11) + 25; // 25-35%
        } else if (creatureTemplate.type === 'epic') {
            // Epic: 10-15% per step (auto-collect gives bonus)
            progressIncrement = Math.floor(Math.random() * 6) + 15; // 15-20%
        } else {
            // Legendary/Elite: 5-15% per step (auto-collect gives bonus)
            progressIncrement = Math.floor(Math.random() * 11) + 10; // 10-20%
        }

        // Update total progress
        const newProgress = Math.min(100, currentProgress + progressIncrement);
        const isComplete = newProgress >= 100;
        
        // Check if wait time has completed for collection
        if (!isComplete) {
            // If the evolution is not complete yet, check if we can collect now
            const now = new Date();
            const timeSinceLastClick = lastClickTime ? (now - new Date(lastClickTime)) / 1000 : 0; // in seconds
            
            // Get required wait time based on level and creature type
            let requiredWaitTimeMinutes;
            if (creatureTemplate.type === 'common') {
                requiredWaitTimeMinutes = targetLevel === 11 ? 2 : targetLevel === 21 ? 5 : 10; // Changed from 5/10/20 to 2/5/10
            } else if (creatureTemplate.type === 'rare') {
                requiredWaitTimeMinutes = targetLevel === 11 ? 30 : targetLevel === 21 ? 60 : 90;
            } else if (creatureTemplate.type === 'epic') {
                requiredWaitTimeMinutes = targetLevel === 11 ? 60 : targetLevel === 21 ? 120 : 240;
            } else if (creatureTemplate.type === 'legendary' || creatureTemplate.type === 'elite') {
                requiredWaitTimeMinutes = targetLevel === 11 ? 240 : targetLevel === 21 ? 480 : 1440;
            }
            
            const requiredWaitTimeSeconds = requiredWaitTimeMinutes * 60;
            
            // Check if enough time has passed to collect
            if (timeSinceLastClick < requiredWaitTimeSeconds) {
                const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
                const remainingMinutes = Math.floor(remainingSeconds / 60);
                const remainingSecondsFormatted = remainingSeconds % 60;
                
                return res.status(400).json({
                    success: false,
                    message: `Need to wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} more before collecting`,
                    remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
                    progress: {
                        current: newProgress,
                        total: 100,
                        percentage: `${newProgress}%`
                    }
                });
            }
        }

        // If we get here, either the evolution is complete or we've waited enough time to collect

        // IMPORTANT: Do NOT reset the lastClickTime here, as that's only done in the evolve API
        // Only update the progress, but don't change any timer-related fields
        // This ensures that only the evolve API starts/controls timers, and collect API only adds progress

        // Update the active merge record
        if (activeMergeIndex !== -1) {
            user.active_merges[activeMergeIndex].progress = newProgress;
            // IMPORTANT: Don't change start_time, only update last_update
            user.active_merges[activeMergeIndex].last_update = now;
        }
        
        // Also update the creature's progress
        user.creatures[creature1Index].upgrade_progress = newProgress;
        user.creatures[creature2Index].upgrade_progress = newProgress;
        user.markModified('creatures');
        
        // Update the merging history record
        const existingMergeIndex = user.merging_history ? user.merging_history.findIndex(
            m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                 (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
        ) : -1;
        
        if (existingMergeIndex !== -1) {
            user.merging_history[existingMergeIndex].progress = newProgress;
            // IMPORTANT: Don't change start_time, only update last_update
            user.merging_history[existingMergeIndex].last_update = now;
            if (isComplete) {
                user.merging_history[existingMergeIndex].is_complete = true;
                user.merging_history[existingMergeIndex].completion_time = now;
            }
        }

        user.markModified('active_merges');
        user.markModified('merging_history');
        
        // If evolution is complete, create the merged creature
        if (isComplete) {
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

            // Update building references - remove old creatures and add the new one
            const buildingIndex = creature1.building_index;
            if (buildingIndex !== undefined && buildingIndex !== null) {
                const buildingToUpdate = user.buildings.find(b => b.index === buildingIndex);
                
                if (buildingToUpdate) {
                    // Initialize creatures array if it doesn't exist
                    if (!buildingToUpdate.creatures) {
                        buildingToUpdate.creatures = [];
                    }
                    
                    console.log('BEFORE: Building creatures array:', buildingToUpdate.creatures.map(c => c && c.toString ? c.toString() : 'invalid'));
                    
                    // Remove old creature references
                    buildingToUpdate.creatures = buildingToUpdate.creatures.filter(c => {
                        if (!c) return false;
                        const c1Id = creature1._id && creature1._id.toString ? creature1._id.toString() : '';
                        const c2Id = creature2._id && creature2._id.toString ? creature2._id.toString() : '';
                        return c.toString && c.toString() !== c1Id && c.toString() !== c2Id;
                    });
                    
                    // Add the new merged creature reference
                    if (mergedCreature._id) {
                        buildingToUpdate.creatures.push(mergedCreature._id);
                        console.log(`Added merged creature ${mergedCreature._id} to building ${buildingIndex}`);
                    } else {
                        // If mergedCreature._id is undefined, we need to save first to get the ID
                        user.markModified('creatures');
                        await user.save();
                        
                        // Now mergedCreature should have an _id
                        const savedCreature = user.creatures[user.creatures.length - 1];
                        if (savedCreature && savedCreature._id) {
                            buildingToUpdate.creatures.push(savedCreature._id);
                            console.log(`Added saved creature ${savedCreature._id} to building ${buildingIndex} after save`);
        } else {
                            console.error('Failed to get merged creature ID even after save');
                        }
                    }
                    
                    console.log('AFTER: Building creatures array:', buildingToUpdate.creatures.map(c => c && c.toString ? c.toString() : 'invalid'));
                    
                    // Mark buildings as modified
                    user.markModified('buildings');
                    
                    // Save user immediately to ensure building changes are persisted
                    try {
                        await user.save();
                        console.log('User saved successfully with updated building creatures array in collect-upgrade');
                    } catch (saveError) {
                        console.error('Error saving user with updated building in collect-upgrade:', saveError);
                    }
                }
            }

            // Remove from active_merges if complete
            if (activeMergeIndex !== -1) {
                user.active_merges.splice(activeMergeIndex, 1);
                user.markModified('active_merges');
            }

            user.markModified('merging_history');
        user.markModified('creatures');
        await user.save();

            return res.status(200).json({
            success: true,
                message: `Evolution complete! Creature upgraded to level ${targetLevel}`,
            data: {
                merged_creature: mergedCreature,
                is_complete: true,
                    progress: 100,
                    total_progress: 100
                }
            });
        } else {
            // Evolution not complete yet, save progress
            await user.save();
            
            return res.status(200).json({
                success: true,
                message: `Evolution in progress: ${newProgress}% complete`,
                data: {
                    is_complete: false,
                    progress: progressIncrement,
                    total_progress: newProgress,
                    current_step: currentStep + 1,
                    total_steps: totalSteps
                }
            });
        }
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
            (targetLevel === 11 ? 2 : targetLevel === 21 ? 5 : 10) * 60; // Changed from 5/10/20 to 2/5/10 for minutes

        if (timeSinceLastClick < requiredWaitTimeSeconds) {
            const remainingSeconds = Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick);
            const remainingMinutes = Math.floor(remainingSeconds / 60);
            const remainingSecondsFormatted = remainingSeconds % 60;
            
            return res.status(400).json({
                success: false,
                message: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} remaining`,
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

        // Update building references - remove old creatures and add the new one
        const buildingIndex = creature1.building_index;
        if (buildingIndex !== undefined && buildingIndex !== null) {
            const buildingToUpdate = user.buildings.find(b => b.index === buildingIndex);
            
            if (buildingToUpdate) {
                // Initialize creatures array if it doesn't exist
                if (!buildingToUpdate.creatures) {
                    buildingToUpdate.creatures = [];
                }
                
                console.log('BEFORE: Building creatures array:', buildingToUpdate.creatures.map(c => c && c.toString ? c.toString() : 'invalid'));
                
                // Remove old creature references
                buildingToUpdate.creatures = buildingToUpdate.creatures.filter(c => {
                    if (!c) return false;
                    const c1Id = creature1._id && creature1._id.toString ? creature1._id.toString() : '';
                    const c2Id = creature2._id && creature2._id.toString ? creature2._id.toString() : '';
                    return c.toString && c.toString() !== c1Id && c.toString() !== c2Id;
                });
                
                // Add the new merged creature reference
                if (mergedCreature._id) {
                    buildingToUpdate.creatures.push(mergedCreature._id);
                    console.log(`Added merged creature ${mergedCreature._id} to building ${buildingIndex}`);
                } else {
                    // If mergedCreature._id is undefined, we need to save first to get the ID
                    user.markModified('creatures');
                    await user.save();
                    
                    // Now mergedCreature should have an _id
                    const savedCreature = user.creatures[user.creatures.length - 1];
                    if (savedCreature && savedCreature._id) {
                        buildingToUpdate.creatures.push(savedCreature._id);
                        console.log(`Added saved creature ${savedCreature._id} to building ${buildingIndex} after save`);
                    } else {
                        console.error('Failed to get merged creature ID even after save');
                    }
                }
                
                console.log('AFTER: Building creatures array:', buildingToUpdate.creatures.map(c => c && c.toString ? c.toString() : 'invalid'));
                
                // Log the update for debugging
                console.log('Updated building creatures in auto-collect-upgrade:', {
                    buildingIndex,
                    oldCreatures: [
                        creature1._id && creature1._id.toString ? creature1._id.toString() : 'undefined', 
                        creature2._id && creature2._id.toString ? creature2._id.toString() : 'undefined'
                    ],
                    newCreature: mergedCreature._id ? mergedCreature._id.toString() : 'undefined',
                    currentCreatures: buildingToUpdate.creatures.map(c => c && c.toString ? c.toString() : 'undefined')
                });
                
                // Mark buildings as modified
                user.markModified('buildings');
                
                // Save user immediately to ensure building changes are persisted
                try {
                    await user.save();
                    console.log('User saved successfully with updated building creatures array in auto-collect-upgrade');
                } catch (saveError) {
                    console.error('Error saving user with updated building in auto-collect-upgrade:', saveError);
                }
            } else {
                console.log('Building not found in auto-collect-upgrade:', {
                    buildingIndex,
                    totalBuildings: user.buildings ? user.buildings.length : 0
                });
            }
        }

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
            const waitTimeMinutes = targetLevel === 11 ? 2 : targetLevel === 21 ? 5 : 10; // Changed from 5/10/20 to 2/5/10
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

        // No need to define the variables again since they already exist in this scope
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
            requiredWaitTimeMinutes = targetLevel === 11 ? 2 : targetLevel === 21 ? 5 : 10; // Changed from 5/10/20 to 2/5/10
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

        // Get the current progress directly from the creature
        const currentProgress = Math.max(creature1.upgrade_progress || 0, creature2.upgrade_progress || 0);

        // Calculate if upgrade is ready for collection
        let isReady = timeSinceLastClick >= requiredWaitTimeSeconds;

        // Calculate remaining time
        const remainingSeconds = Math.max(0, Math.ceil(requiredWaitTimeSeconds - timeSinceLastClick));
        const remainingMinutes = Math.floor(remainingSeconds / 60);
        const remainingSecondsFormatted = remainingSeconds % 60;
        
        // Calculate time-based progress - this is for the timer progress, not the evolution progress
        const timeProgressPercentage = Math.min(100, Math.floor((timeSinceLastClick / requiredWaitTimeSeconds) * 100));

        // Get active merge record for additional details
        let activeMergeRecord = null;
        if (user.active_merges) {
            activeMergeRecord = user.active_merges.find(
                m => (m.creature1_id === creature1Id && m.creature2_id === creature2Id) ||
                     (m.creature1_id === creature2Id && m.creature2_id === creature1Id)
            );
        }

        // Combine progress information
        const totalProgress = currentProgress;
        const canCollect = isReady;
        const canEvolve = currentProgress > 0 && currentProgress < 100;

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
                'Upgrade is ready to collect.' : 
                `You must wait the full ${requiredWaitTimeMinutes} minutes before collecting. Please wait ${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')} more.`,
            remaining_time: `${remainingMinutes}:${remainingSecondsFormatted.toString().padStart(2, '0')}`,
            progress: {
                current: timeProgressPercentage,
                total: 100,
                percentage: `${timeProgressPercentage}%`
            },
            evolution_progress: {
                current: totalProgress,
                total: 100,
                percentage: `${totalProgress}%`,
                can_collect: canCollect,
                can_evolve: canEvolve
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

                
