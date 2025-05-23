const express = require('express');
const router = express.Router();
const questService = require('../service/questService');
const Quest = require('../models/quest');
const logService = require('../service/logService');
const User = require('../models/user');

/**
 * @route GET /api/quests
 * @desc Get all quests
 * @access Public
 */
router.get('/', async (req, res) => {
    try {
        const { type, category, active } = req.query;
        
        // Build filter
        const filter = {};
        if (type) filter.type = type;
        if (category) filter.category = category;
        if (active !== undefined) filter.active = active === 'true';
        
        // Find quests with filter
        const quests = await Quest.find(filter);
        
        res.status(200).json({
            success: true,
            data: quests
        });
    } catch (error) {
        console.error('Error fetching quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route GET /api/quests/:questId
 * @desc Get a specific quest by ID
 * @access Public
 */
router.get('/:questId', async (req, res) => {
    try {
        const { questId } = req.params;
        
        // Find quest
        const quest = await Quest.findOne({ quest_id: questId });
        if (!quest) {
            return res.status(404).json({
                success: false,
                message: `Quest ${questId} not found`
            });
        }
        
        res.status(200).json({
            success: true,
            data: quest
        });
    } catch (error) {
        console.error('Error fetching quest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route GET /api/quests/user/:userId
 * @desc Get all active quests for a user
 * @access Public
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get user quests
        const result = await questService.getUserQuests(userId);
        
        if (!result.success) {
            return res.status(404).json(result);
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching user quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/assign/:userId
 * @desc Assign quests to a user
 * @access Public
 */
router.post('/assign/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type = 'daily' } = req.body;
        
        // Validate quest type
        if (!['daily', 'weekly', 'monthly'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid quest type. Must be daily, weekly, or monthly.'
            });
        }
        
        // Assign quests
        const result = await questService.assignQuestsToUser(userId, type);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Log event
        await logService.createLog({
            userId,
            eventType: 'QUEST_ASSIGNED',
            data: {
                quest_type: type,
                quests_count: result.data.assigned_quests.length
            }
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error assigning quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/progress/:userId
 * @desc Update quest progress for a user
 * @access Public
 */
router.post('/progress/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, amount = 1 } = req.body;
        
        if (!action) {
            return res.status(400).json({
                success: false,
                message: 'Action is required'
            });
        }
        
        // Update progress
        const result = await questService.updateQuestProgress(userId, action, amount);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Log event if quests were completed
        if (result.data.completed_quests && result.data.completed_quests.length > 0) {
            await logService.createLog({
                userId,
                eventType: 'QUEST_COMPLETED',
                data: {
                    action,
                    completed_quests: result.data.completed_quests.map(q => q.quest_id)
                }
            });
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error updating quest progress:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/claim/:userId/:questId
 * @desc Claim reward for a completed quest
 * @access Public
 */
router.post('/claim/:userId/:questId', async (req, res) => {
    try {
        const { userId, questId } = req.params;
        
        // Claim reward
        const result = await questService.claimQuestReward(userId, questId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Log event
        await logService.createLog({
            userId,
            eventType: 'QUEST_REWARD_CLAIMED',
            data: {
                quest_id: questId,
                reward_type: result.data.reward_type,
                reward_amount: result.data.reward_amount
            }
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error claiming quest reward:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/refresh
 * @desc Refresh quests for all users (admin only)
 * @access Private/Admin
 */
router.post('/refresh', async (req, res) => {
    try {
        const { type = 'daily' } = req.body;
        
        // Validate quest type
        if (!['daily', 'weekly', 'monthly'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid quest type. Must be daily, weekly, or monthly.'
            });
        }
        
        // Refresh quests
        const result = await questService.refreshQuestsForAllUsers(type);
        
        // Log event
        await logService.createLog({
            userId: 'SYSTEM',
            eventType: 'QUESTS_REFRESHED',
            data: {
                quest_type: type,
                refresh_count: result.data.refresh_count,
                error_count: result.data.error_count
            }
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error refreshing quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests
 * @desc Create a new quest (admin only)
 * @access Private/Admin
 */
router.post('/', async (req, res) => {
    try {
        const {
            quest_id,
            title,
            description,
            type,
            category,
            action,
            required_amount,
            reward_type,
            reward_amount,
            duration,
            active = true
        } = req.body;
        
        // Validate required fields
        if (!quest_id || !title || !description || !type || !category || !action || !required_amount || !reward_type || !reward_amount || !duration) {
            return res.status(400).json({
                success: false,
                message: 'Missing required quest fields'
            });
        }
        
        // Check if quest already exists
        const existingQuest = await Quest.findOne({ quest_id });
        if (existingQuest) {
            return res.status(400).json({
                success: false,
                message: `Quest with ID ${quest_id} already exists`
            });
        }
        
        // Create new quest
        const newQuest = new Quest({
            quest_id,
            title,
            description,
            type,
            category,
            action,
            required_amount,
            reward_type,
            reward_amount,
            duration,
            active
        });
        
        await newQuest.save();
        
        // Log event
        await logService.createLog({
            userId: 'SYSTEM',
            eventType: 'QUEST_CREATED',
            data: {
                quest_id,
                title,
                type
            }
        });
        
        res.status(201).json({
            success: true,
            message: 'Quest created successfully',
            data: newQuest
        });
    } catch (error) {
        console.error('Error creating quest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route PUT /api/quests/:questId
 * @desc Update a quest (admin only)
 * @access Private/Admin
 */
router.put('/:questId', async (req, res) => {
    try {
        const { questId } = req.params;
        const updateData = req.body;
        
        // Find quest
        const quest = await Quest.findOne({ quest_id: questId });
        if (!quest) {
            return res.status(404).json({
                success: false,
                message: `Quest ${questId} not found`
            });
        }
        
        // Update quest
        Object.keys(updateData).forEach(key => {
            if (key !== 'quest_id') { // Don't allow changing the primary ID
                quest[key] = updateData[key];
            }
        });
        
        quest.updated_at = new Date();
        await quest.save();
        
        // Log event
        await logService.createLog({
            userId: 'SYSTEM',
            eventType: 'QUEST_UPDATED',
            data: {
                quest_id: questId,
                updated_fields: Object.keys(updateData)
            }
        });
        
        res.status(200).json({
            success: true,
            message: 'Quest updated successfully',
            data: quest
        });
    } catch (error) {
        console.error('Error updating quest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route DELETE /api/quests/:questId
 * @desc Delete a quest (admin only)
 * @access Private/Admin
 */
router.delete('/:questId', async (req, res) => {
    try {
        const { questId } = req.params;
        
        // Find and delete quest
        const quest = await Quest.findOneAndDelete({ quest_id: questId });
        if (!quest) {
            return res.status(404).json({
                success: false,
                message: `Quest ${questId} not found`
            });
        }
        
        // Log event
        await logService.createLog({
            userId: 'SYSTEM',
            eventType: 'QUEST_DELETED',
            data: {
                quest_id: questId,
                title: quest.title,
                type: quest.type
            }
        });
        
        res.status(200).json({
            success: true,
            message: 'Quest deleted successfully',
            data: {
                quest_id: questId
            }
        });
    } catch (error) {
        console.error('Error deleting quest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/check-expired
 * @desc Check and remove expired quests (scheduled job)
 * @access Private
 */
router.post('/check-expired', async (req, res) => {
    try {
        const result = await questService.checkExpiredQuests();
        
        if (result.data.expired_count > 0) {
            // Log event
            await logService.createLog({
                userId: 'SYSTEM',
                eventType: 'QUESTS_EXPIRED',
                data: {
                    expired_count: result.data.expired_count,
                    user_count: result.data.user_count
                }
            });
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error checking expired quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/initialize-active
 * @desc Initialize active quests (admin only)
 * @access Private/Admin
 */
router.post('/initialize-active', async (req, res) => {
    try {
        const result = await questService.initializeActiveQuests();
        
        // Log event
        await logService.createLog({
            userId: 'SYSTEM',
            eventType: 'ACTIVE_QUESTS_INITIALIZED',
            data: result.data
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error initializing active quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route GET /api/quests/active
 * @desc Get all active quests
 * @access Public
 */
router.get('/active', async (req, res) => {
    try {
        const activeQuests = {};
        
        // Get active quests for all types
        for (const type of ['daily', 'weekly', 'monthly']) {
            try {
                const typeQuests = await questService.getActiveQuests(type);
                
                // Get full quest details
                const questDetails = await Quest.find({ 
                    quest_id: { $in: typeQuests.active_quest_ids } 
                });
                
                activeQuests[type] = {
                    quests: questDetails,
                    last_refreshed: typeQuests.last_refreshed,
                    next_refresh: typeQuests.next_refresh
                };
            } catch (error) {
                activeQuests[type] = {
                    error: error.message
                };
            }
        }
        
        res.status(200).json({
            success: true,
            data: activeQuests
        });
    } catch (error) {
        console.error('Error getting active quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route GET /api/quests/active/:type
 * @desc Get active quests of a specific type
 * @access Public
 */
router.get('/active/:type', async (req, res) => {
    try {
        const { type } = req.params;
        
        // Validate quest type
        if (!['daily', 'weekly', 'monthly'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid quest type. Must be daily, weekly, or monthly.'
            });
        }
        
        // Get active quests
        const activeQuests = await questService.getActiveQuests(type);
        
        // Get full quest details
        const questDetails = await Quest.find({ 
            quest_id: { $in: activeQuests.active_quest_ids } 
        });
        
        res.status(200).json({
            success: true,
            data: {
                type,
                quests: questDetails,
                last_refreshed: activeQuests.last_refreshed,
                next_refresh: activeQuests.next_refresh
            }
        });
    } catch (error) {
        console.error(`Error getting active ${req.params.type} quests:`, error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/check-refresh
 * @desc Check if active quests need to be refreshed (scheduled job)
 * @access Private
 */
router.post('/check-refresh', async (req, res) => {
    try {
        const result = await questService.checkAndRefreshActiveQuests();
        
        // Log event if any refreshes happened
        const refreshed = Object.values(result.data).some(r => r.refreshed);
        if (refreshed) {
            await logService.createLog({
                userId: 'SYSTEM',
                eventType: 'ACTIVE_QUESTS_REFRESHED',
                data: result.data
            });
        }
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error checking active quests refresh:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/assign-active/:userId
 * @desc Assign current active quests to a user
 * @access Public
 */
router.post('/assign-active/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Assign active quests to user
        const result = await questService.assignActiveQuestsToUser(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Log event
        await logService.createLog({
            userId,
            eventType: 'ACTIVE_QUESTS_ASSIGNED',
            data: {
                daily_count: result.data.results.daily?.quest_count || 0,
                weekly_count: result.data.results.weekly?.quest_count || 0,
                monthly_count: result.data.results.monthly?.quest_count || 0
            }
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error assigning active quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/replace/:userId/:questId
 * @desc Replace a quest with a new random one
 * @access Public
 */
router.post('/replace/:userId/:questId', async (req, res) => {
    try {
        const { userId, questId } = req.params;
        
        // Replace quest
        const result = await questService.replaceQuest(userId, questId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Log event
        await logService.createLog({
            userId,
            eventType: 'QUEST_REPLACED',
            data: {
                old_quest_id: questId,
                old_quest_title: result.data.old_quest.title,
                new_quest_id: result.data.new_quest.quest_id,
                new_quest_title: result.data.new_quest.title,
                quest_type: result.data.quest_type
            }
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error replacing quest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/elite/assign/:userId
 * @desc Assign Elite quests to a user with Elite Pass
 * @access Public
 */
router.post('/elite/assign/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Assign elite quests
        const result = await questService.assignEliteQuestsToUser(userId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Log event
        await logService.createLog({
            userId,
            eventType: 'ELITE_QUESTS_ASSIGNED',
            data: {
                quests_count: result.data.assigned_quests.length
            }
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error assigning elite quests:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route POST /api/quests/elite/replace/:userId/:questId
 * @desc Replace an Elite quest with a new random one
 * @access Public
 */
router.post('/elite/replace/:userId/:questId', async (req, res) => {
    try {
        const { userId, questId } = req.params;
        
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `User ${userId} not found`
            });
        }
        
        // Check if user has an active Elite Pass
        if (!user.elite_pass || !user.elite_pass.active) {
            return res.status(403).json({
                success: false,
                message: `User ${userId} does not have an active Elite Pass`
            });
        }
        
        // Check if user has exceeded replacement limit (max 1 replacement per week)
        if (user.elite_quest_stats && user.elite_quest_stats.replacements >= 1) {
            return res.status(400).json({
                success: false,
                message: 'You have already used your Elite quest replacement for this week'
            });
        }
        
        // Find the quest to verify it's an elite quest
        const quest = await Quest.findOne({ quest_id: questId });
        if (!quest || !quest.is_elite) {
            return res.status(400).json({
                success: false,
                message: 'Selected quest is not an Elite quest'
            });
        }
        
        // Replace the quest (reusing existing replaceQuest function since the logic is similar)
        const result = await questService.replaceQuest(userId, questId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Update elite replacement counter
        if (!user.elite_quest_stats) {
            user.elite_quest_stats = { replacements: 0 };
        }
        user.elite_quest_stats.replacements += 1;
        await user.save();
        
        // Log event
        await logService.createLog({
            userId,
            eventType: 'ELITE_QUEST_REPLACED',
            data: {
                old_quest_id: questId,
                old_quest_title: result.data.old_quest.title,
                new_quest_id: result.data.new_quest.quest_id,
                new_quest_title: result.data.new_quest.title
            }
        });
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error replacing elite quest:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router; 