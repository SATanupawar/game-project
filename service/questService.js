const Quest = require('../models/quest');
const User = require('../models/user');
const ActiveQuests = require('../models/activeQuests');

/**
 * Assign quests to a user based on type (daily, weekly, monthly)
 * @param {string} userId - The user ID to assign quests to
 * @param {string} questType - Type of quests to assign (daily, weekly, monthly)
 * @returns {Promise<Object>} - Result of assignment
 */
async function assignQuestsToUser(userId, questType = 'daily') {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        // Get all active quests of specified type
        const quests = await Quest.find({ type: questType, active: true });
        if (!quests || quests.length === 0) {
            throw new Error(`No active ${questType} quests found`);
        }

        // Calculate expiration time based on quest type
        const now = new Date();
        let expiresAt;

        switch (questType) {
            case 'daily':
                // Expires at midnight (end of day)
                expiresAt = new Date(now);
                expiresAt.setHours(23, 59, 59, 999);
                break;
            case 'weekly':
                // Expires in 7 days
                expiresAt = new Date(now);
                expiresAt.setDate(expiresAt.getDate() + 7);
                expiresAt.setHours(23, 59, 59, 999);
                break;
            case 'monthly':
                // Expires in 30 days
                expiresAt = new Date(now);
                expiresAt.setDate(expiresAt.getDate() + 30);
                expiresAt.setHours(23, 59, 59, 999);
                break;
            default:
                throw new Error(`Invalid quest type: ${questType}`);
        }

        // Remove any existing quests of this type
        user.active_quests = user.active_quests.filter(q => {
            // Get quest details
            const quest = quests.find(quest => quest.quest_id === q.quest_id);
            return !quest || quest.type !== questType;
        });

        // Add new quests
        for (const quest of quests) {
            // Add quest to user's active quests
            user.active_quests.push({
                quest_id: quest.quest_id,
                progress: 0,
                completed: false,
                rewarded: false,
                expires_at: expiresAt
            });
        }

        // Update last refresh timestamp
        switch (questType) {
            case 'daily':
                user.quest_stats.last_daily_refresh = now;
                // Reset daily quest replacements counter
                user.quest_stats.daily_replacements = 0;
                break;
            case 'weekly':
                user.quest_stats.last_weekly_refresh = now;
                // Reset weekly quest replacements counter
                user.quest_stats.weekly_replacements = 0;
                break;
            case 'monthly':
                user.quest_stats.last_monthly_refresh = now;
                // Reset monthly quest replacements counter
                user.quest_stats.monthly_replacements = 0;
                break;
        }

        // Save user
        await user.save();

        return {
            success: true,
            message: `Assigned ${quests.length} ${questType} quests to user ${userId}`,
            data: {
                userId,
                assigned_quests: quests.map(q => ({
                    quest_id: q.quest_id,
                    title: q.title,
                    description: q.description,
                    required_amount: q.required_amount,
                    reward_type: q.reward_type,
                    reward_amount: q.reward_amount,
                    expires_at: expiresAt
                }))
            }
        };
    } catch (error) {
        console.error(`Error assigning ${questType} quests:`, error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Update quest progress for a user
 * @param {string} userId - The user ID
 * @param {string} action - The action that was performed
 * @param {number} amount - The amount to update progress by
 * @returns {Promise<Object>} - Updated quests with progress
 */
async function updateQuestProgress(userId, action, amount = 1) {
    try {
        console.log(`[QUEST UPDATE] Starting progress update for user: ${userId}, action: ${action}, amount: ${amount}`);
        
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            console.log(`[QUEST UPDATE] User ${userId} not found`);
            throw new Error(`User ${userId} not found`);
        }
        
        console.log(`[QUEST UPDATE] Found user ${userId}, checking ${user.active_quests.length} active quests`);

        // Load all quests for quest details
        const quests = await Quest.find({});
        const questMap = {};
        quests.forEach(q => {
            questMap[q.quest_id] = q;
        });
        
        console.log(`[QUEST UPDATE] Loaded ${quests.length} quests from database`);

        // Track completed quests
        const newlyCompletedQuests = [];
        
        // Update progress for matching quests
        for (let i = 0; i < user.active_quests.length; i++) {
            const userQuest = user.active_quests[i];
            const quest = questMap[userQuest.quest_id];
            
            console.log(`[QUEST UPDATE] Checking quest: ${userQuest.quest_id}, action: ${quest?.action}, completed: ${userQuest.completed}`);
            
            // Skip if quest doesn't exist, is already completed, or doesn't match the action
            if (!quest || userQuest.completed || quest.action !== action) {
                console.log(`[QUEST UPDATE] Skipping quest ${userQuest.quest_id}: exists=${!!quest}, completed=${userQuest.completed}, actionMatch=${quest?.action === action}`);
                continue;
            }
            
            console.log(`[QUEST UPDATE] Updating progress for quest: ${userQuest.quest_id}, current: ${userQuest.progress}, adding: ${amount}`);
            
            // Update progress
            userQuest.progress += amount;
            
            // Check if quest is now completed
            if (userQuest.progress >= quest.required_amount && !userQuest.completed) {
                console.log(`[QUEST UPDATE] Quest completed: ${userQuest.quest_id}, progress: ${userQuest.progress}/${quest.required_amount}`);
                userQuest.completed = true;
                userQuest.completed_at = new Date();
                newlyCompletedQuests.push({
                    quest_id: userQuest.quest_id,
                    title: quest.title,
                    reward_type: quest.reward_type,
                    reward_amount: quest.reward_amount
                });
            } else {
                console.log(`[QUEST UPDATE] Quest progress updated: ${userQuest.quest_id}, progress: ${userQuest.progress}/${quest.required_amount}`);
            }
        }
        
        // Save user
        await user.save();
        console.log(`[QUEST UPDATE] Saved user progress, completed ${newlyCompletedQuests.length} new quests`);
        
        return {
            success: true,
            message: `Updated progress for ${action} quests`,
            data: {
                userId,
                action,
                amount,
                completed_quests: newlyCompletedQuests
            }
        };
    } catch (error) {
        console.error('[QUEST UPDATE] Error updating quest progress:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Claim rewards for completed quests
 * @param {string} userId - The user ID
 * @param {string} questId - The quest ID to claim
 * @returns {Promise<Object>} - Result of claiming rewards
 */
async function claimQuestReward(userId, questId) {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }
        
        // Find quest in user's active quests
        const userQuestIndex = user.active_quests.findIndex(q => q.quest_id === questId);
        if (userQuestIndex === -1) {
            throw new Error(`Quest ${questId} not found for user ${userId}`);
        }
        
        const userQuest = user.active_quests[userQuestIndex];
        
        // Check if quest is completed and not already rewarded
        if (!userQuest.completed) {
            throw new Error(`Quest ${questId} is not completed yet`);
        }
        
        if (userQuest.rewarded) {
            throw new Error(`Quest ${questId} rewards have already been claimed`);
        }
        
        // Get quest details
        const quest = await Quest.findOne({ quest_id: questId });
        if (!quest) {
            throw new Error(`Quest ${questId} not found in database`);
        }
        
        // Grant reward based on type
        let rewardMessage = '';
        
        switch (quest.reward_type) {
            case 'gold':
                // Initialize currency if needed
                if (!user.currency) {
                    user.currency = { gold: 0 };
                }
                
                // Add gold
                if (!user.currency.gold) {
                    user.currency.gold = 0;
                }
                user.currency.gold += quest.reward_amount;
                rewardMessage = `Added ${quest.reward_amount} gold`;
                break;
                
            case 'arcane_energy':
                // Initialize currency if needed
                if (!user.currency) {
                    user.currency = { arcane_energy: 0 };
                }
                
                // Add arcane energy
                if (!user.currency.arcane_energy) {
                    user.currency.arcane_energy = 0;
                }
                user.currency.arcane_energy += quest.reward_amount;
                rewardMessage = `Added ${quest.reward_amount} arcane energy`;
                break;
                
            case 'gems':
                // Initialize currency if needed
                if (!user.currency) {
                    user.currency = { gems: 0 };
                }
                
                // Add gems
                if (!user.currency.gems) {
                    user.currency.gems = 0;
                }
                user.currency.gems += quest.reward_amount;
                rewardMessage = `Added ${quest.reward_amount} gems`;
                break;
                
            case 'xp':
                // Add XP
                user.xp += quest.reward_amount;
                rewardMessage = `Added ${quest.reward_amount} XP`;
                
                // Check if user leveled up (simplified, you might want a more complex level system)
                const oldLevel = user.level;
                if (user.xp >= oldLevel * 1000) {
                    user.level += 1;
                    rewardMessage += ` and leveled up to ${user.level}!`;
                }
                break;
                
            case 'card_pack':
                // Logic to add card packs
                rewardMessage = `Added ${quest.reward_amount} card pack(s)`;
                break;
                
            case 'chest':
                // Logic to add chests
                rewardMessage = `Added ${quest.reward_amount} chest(s)`;
                break;
                
            default:
                throw new Error(`Unknown reward type: ${quest.reward_type}`);
        }
        
        // Mark quest as rewarded
        userQuest.rewarded = true;
        user.active_quests[userQuestIndex] = userQuest;
        
        // Add to completed quests
        user.completed_quests.push({
            quest_id: questId,
            completed_at: new Date(),
            type: quest.type
        });
        
        // Update quest stats
        switch (quest.type) {
            case 'daily':
                user.quest_stats.daily_completed += 1;
                break;
            case 'weekly':
                user.quest_stats.weekly_completed += 1;
                break;
            case 'monthly':
                user.quest_stats.monthly_completed += 1;
                break;
        }
        user.quest_stats.total_completed += 1;
        
        // Save user
        await user.save();
        
        return {
            success: true,
            message: `Successfully claimed reward for quest ${quest.title}. ${rewardMessage}`,
            data: {
                userId,
                quest_id: questId,
                reward_type: quest.reward_type,
                reward_amount: quest.reward_amount,
                reward_message: rewardMessage
            }
        };
    } catch (error) {
        console.error('Error claiming quest reward:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Get active quests for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} - User's active quests
 */
async function getUserQuests(userId) {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }
        
        // Get all quests for details
        const quests = await Quest.find({});
        const questMap = {};
        quests.forEach(q => {
            questMap[q.quest_id] = q;
        });
        
        // Format active quests with full details
        const activeQuests = user.active_quests.map(userQuest => {
            const questDetails = questMap[userQuest.quest_id] || {};
            
            return {
                quest_id: userQuest.quest_id,
                title: questDetails.title || 'Unknown Quest',
                description: questDetails.description || '',
                type: questDetails.type || 'unknown',
                category: questDetails.category || 'unknown',
                action: questDetails.action || 'unknown',
                required_amount: questDetails.required_amount || 0,
                current_progress: userQuest.progress,
                completion_percentage: Math.min(
                    100, 
                    Math.round((userQuest.progress / (questDetails.required_amount || 1)) * 100)
                ),
                completed: userQuest.completed,
                rewarded: userQuest.rewarded,
                expires_at: userQuest.expires_at,
                reward_type: questDetails.reward_type || 'unknown',
                reward_amount: questDetails.reward_amount || 0
            };
        });
        
        // Group by type
        const dailyQuests = activeQuests.filter(q => q.type === 'daily');
        const weeklyQuests = activeQuests.filter(q => q.type === 'weekly');
        const monthlyQuests = activeQuests.filter(q => q.type === 'monthly');
        
        return {
            success: true,
            data: {
                userId,
                daily_quests: dailyQuests,
                weekly_quests: weeklyQuests,
                monthly_quests: monthlyQuests,
                quest_stats: user.quest_stats,
                daily_refresh: user.quest_stats.last_daily_refresh,
                weekly_refresh: user.quest_stats.last_weekly_refresh,
                monthly_refresh: user.quest_stats.last_monthly_refresh,
                replacements: {
                    daily: user.quest_stats.daily_replacements || 0,
                    weekly: user.quest_stats.weekly_replacements || 0,
                    monthly: user.quest_stats.monthly_replacements || 0,
                    total: user.quest_stats.total_replacements || 0
                },
                recent_replacements: user.replaced_quests ? 
                    user.replaced_quests.sort((a, b) => new Date(b.replaced_at) - new Date(a.replaced_at)).slice(0, 5) : 
                    []
            }
        };
    } catch (error) {
        console.error('Error getting user quests:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Refresh quests for all users (for server-side scheduled job)
 * @param {string} questType - Type of quests to refresh (daily, weekly, monthly)
 * @returns {Promise<Object>} - Results of refresh operation
 */
async function refreshQuestsForAllUsers(questType = 'daily') {
    try {
        // Find all users
        const users = await User.find({});
        
        let refreshCount = 0;
        const refreshErrors = [];
        
        // Process each user
        for (const user of users) {
            try {
                const result = await assignQuestsToUser(user.userId, questType);
                if (result.success) {
                    refreshCount++;
                } else {
                    refreshErrors.push({
                        userId: user.userId,
                        error: result.message
                    });
                }
            } catch (err) {
                refreshErrors.push({
                    userId: user.userId,
                    error: err.message
                });
            }
        }
        
        return {
            success: true,
            message: `Refreshed ${questType} quests for ${refreshCount} users with ${refreshErrors.length} errors`,
            data: {
                refresh_count: refreshCount,
                error_count: refreshErrors.length,
                errors: refreshErrors
            }
        };
    } catch (error) {
        console.error(`Error refreshing ${questType} quests:`, error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Check for expired quests and update them
 * @returns {Promise<Object>} - Results of check operation
 */
async function checkExpiredQuests() {
    try {
        const now = new Date();
        
        // Find all users with expired quests
        const users = await User.find({
            'active_quests.expires_at': { $lt: now }
        });
        
        let expiredCount = 0;
        
        // Process each user
        for (const user of users) {
            // Filter out expired quests
            const expiredQuests = user.active_quests.filter(q => q.expires_at < now);
            expiredCount += expiredQuests.length;
            
            // Move uncompleted quests to completed quests with status expired
            expiredQuests.forEach(quest => {
                if (!quest.completed) {
                    user.completed_quests.push({
                        quest_id: quest.quest_id,
                        completed_at: now,
                        type: 'expired' // Mark as expired
                    });
                }
            });
            
            // Remove expired quests from active quests
            user.active_quests = user.active_quests.filter(q => q.expires_at >= now);
            
            // Save user
            await user.save();
        }
        
        return {
            success: true,
            message: `Removed ${expiredCount} expired quests from ${users.length} users`,
            data: {
                expired_count: expiredCount,
                user_count: users.length
            }
        };
    } catch (error) {
        console.error('Error checking expired quests:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Get random quests of a specific type
 * @param {string} questType - Type of quests to select (daily, weekly, monthly)
 * @param {number} count - Number of quests to select
 * @returns {Promise<Array>} - Array of selected quest IDs
 */
async function getRandomQuests(questType, count) {
    try {
        // Get all active quests of specified type
        const quests = await Quest.find({ type: questType, active: true });
        
        if (!quests || quests.length === 0) {
            throw new Error(`No active ${questType} quests found`);
        }
        
        // If we have fewer quests than requested, return all of them
        if (quests.length <= count) {
            return quests.map(q => q.quest_id);
        }
        
        // Shuffle and select random quests
        const shuffled = [...quests].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);
        
        return selected.map(q => q.quest_id);
    } catch (error) {
        console.error(`Error selecting random ${questType} quests:`, error);
        throw error;
    }
}

/**
 * Get or initialize active quests
 * @param {string} questType - Type of quests (daily, weekly, monthly)
 * @returns {Promise<Object>} - Active quests data
 */
async function getActiveQuests(questType) {
    try {
        // Calculate expiration time based on quest type
        const now = new Date();
        let nextRefresh;
        let count;

        switch (questType) {
            case 'daily':
                // Next day at midnight
                nextRefresh = new Date(now);
                nextRefresh.setDate(nextRefresh.getDate() + 1);
                nextRefresh.setHours(0, 0, 0, 0);
                count = 5; // 5 daily quests
                break;
            case 'weekly':
                // Next week (7 days from now)
                nextRefresh = new Date(now);
                nextRefresh.setDate(nextRefresh.getDate() + 7);
                nextRefresh.setHours(0, 0, 0, 0);
                count = 2; // 2 weekly quests
                break;
            case 'monthly':
                // Next month (30 days from now)
                nextRefresh = new Date(now);
                nextRefresh.setDate(nextRefresh.getDate() + 30);
                nextRefresh.setHours(0, 0, 0, 0);
                count = 1; // 1 monthly quest
                break;
            default:
                throw new Error(`Invalid quest type: ${questType}`);
        }
        
        // Find active quests record
        let activeQuests = await ActiveQuests.findOne({ type: questType });
        
        // If no active quests exist or it's time to refresh, create new ones
        if (!activeQuests || now >= activeQuests.next_refresh) {
            // Get random quests
            const questIds = await getRandomQuests(questType, count);
            
            if (activeQuests) {
                // Update existing record
                activeQuests.active_quest_ids = questIds;
                activeQuests.last_refreshed = now;
                activeQuests.next_refresh = nextRefresh;
            } else {
                // Create new record
                activeQuests = new ActiveQuests({
                    type: questType,
                    active_quest_ids: questIds,
                    last_refreshed: now,
                    next_refresh: nextRefresh
                });
            }
            
            await activeQuests.save();
        }
        
        return activeQuests;
    } catch (error) {
        console.error(`Error getting active ${questType} quests:`, error);
        throw error;
    }
}

/**
 * Check if active quests need refreshing and refresh them
 * @returns {Promise<Object>} - Results of refresh check
 */
async function checkAndRefreshActiveQuests() {
    try {
        const now = new Date();
        const types = ['daily', 'weekly', 'monthly'];
        const results = {};
        
        for (const type of types) {
            // Find active quests of this type
            const activeQuests = await ActiveQuests.findOne({ type });
            
            // Skip if not found
            if (!activeQuests) {
                results[type] = { refreshed: false, message: 'No active quests found' };
                continue;
            }
            
            // Check if refresh is needed
            if (now >= activeQuests.next_refresh) {
                // Get new random quests
                const count = type === 'daily' ? 5 : (type === 'weekly' ? 2 : 1);
                const questIds = await getRandomQuests(type, count);
                
                // Calculate next refresh date
                let nextRefresh = new Date(now);
                switch (type) {
                    case 'daily':
                        nextRefresh.setDate(nextRefresh.getDate() + 1);
                        break;
                    case 'weekly':
                        nextRefresh.setDate(nextRefresh.getDate() + 7);
                        break;
                    case 'monthly':
                        nextRefresh.setDate(nextRefresh.getDate() + 30);
                        break;
                }
                nextRefresh.setHours(0, 0, 0, 0);
                
                // Update active quests
                activeQuests.active_quest_ids = questIds;
                activeQuests.last_refreshed = now;
                activeQuests.next_refresh = nextRefresh;
                await activeQuests.save();
                
                results[type] = { 
                    refreshed: true, 
                    message: `Refreshed ${count} ${type} quests`, 
                    next_refresh: nextRefresh 
                };
            } else {
                results[type] = { 
                    refreshed: false, 
                    message: `Not time to refresh yet`, 
                    next_refresh: activeQuests.next_refresh 
                };
            }
        }
        
        return {
            success: true,
            message: 'Checked all quest types for refresh',
            data: results
        };
    } catch (error) {
        console.error('Error checking and refreshing active quests:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Assign active quests to a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Result with assigned quests
 */
async function assignActiveQuestsToUser(userId) {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }
        
        const questTypes = ['daily', 'weekly', 'monthly'];
        const results = {};
        
        for (const type of questTypes) {
            try {
                // Get active quests for this type
                const activeQuests = await getActiveQuests(type);
                
                // Calculate expiration time
                const now = new Date();
                let expiresAt = new Date(activeQuests.next_refresh);
                
                // Remove any existing quests of this type
                user.active_quests = user.active_quests.filter(q => {
                    // Find quest details to check its type
                    const questId = q.quest_id;
                    // Keep if it's not the current type we're processing
                    return !activeQuests.active_quest_ids.includes(questId);
                });
                
                // Get full details of active quests
                const questDetails = await Quest.find({ 
                    quest_id: { $in: activeQuests.active_quest_ids } 
                });
                
                // Create a map for quick lookup
                const questMap = {};
                questDetails.forEach(q => {
                    questMap[q.quest_id] = q;
                });
                
                // Add new quests to user
                for (const questId of activeQuests.active_quest_ids) {
                    // Skip if quest details not found
                    if (!questMap[questId]) continue;
                    
                    // Check if user already has this quest
                    const existingQuest = user.active_quests.find(q => q.quest_id === questId);
                    if (existingQuest) continue;
                    
                    // Add quest to user's active quests
                    user.active_quests.push({
                        quest_id: questId,
                        progress: 0,
                        completed: false,
                        rewarded: false,
                        expires_at: expiresAt
                    });
                }
                
                // Update last refresh timestamp
                switch (type) {
                    case 'daily':
                        user.quest_stats.last_daily_refresh = now;
                        break;
                    case 'weekly':
                        user.quest_stats.last_weekly_refresh = now;
                        break;
                    case 'monthly':
                        user.quest_stats.last_monthly_refresh = now;
                        break;
                }
                
                // Add to results
                results[type] = {
                    success: true,
                    quest_count: activeQuests.active_quest_ids.length,
                    quests: activeQuests.active_quest_ids.map(id => {
                        const quest = questMap[id] || {};
                        return {
                            quest_id: id,
                            title: quest.title || 'Unknown',
                            description: quest.description || ''
                        };
                    })
                };
            } catch (error) {
                results[type] = {
                    success: false,
                    message: error.message
                };
            }
        }
        
        // Save user
        await user.save();
        
        return {
            success: true,
            message: 'Assigned active quests to user',
            data: {
                userId,
                results
            }
        };
    } catch (error) {
        console.error('Error assigning active quests to user:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Initialize active quests for first time
 * @returns {Promise<Object>} - Initialization results
 */
async function initializeActiveQuests() {
    try {
        const now = new Date();
        const types = [
            { type: 'daily', count: 5, days: 1 },
            { type: 'weekly', count: 2, days: 7 },
            { type: 'monthly', count: 1, days: 30 }
        ];
        
        const results = {};
        
        for (const { type, count, days } of types) {
            // Check if active quests already exist
            const existing = await ActiveQuests.findOne({ type });
            if (existing) {
                results[type] = { 
                    initialized: false, 
                    message: 'Already initialized' 
                };
                continue;
            }
            
            // Get random quests
            const questIds = await getRandomQuests(type, count);
            
            // Calculate next refresh
            const nextRefresh = new Date(now);
            nextRefresh.setDate(nextRefresh.getDate() + days);
            nextRefresh.setHours(0, 0, 0, 0);
            
            // Create active quests record
            const activeQuests = new ActiveQuests({
                type,
                active_quest_ids: questIds,
                last_refreshed: now,
                next_refresh: nextRefresh
            });
            
            await activeQuests.save();
            
            results[type] = {
                initialized: true,
                quest_count: questIds.length,
                quests: questIds,
                next_refresh: nextRefresh
            };
        }
        
        return {
            success: true,
            message: 'Initialized active quests',
            data: results
        };
    } catch (error) {
        console.error('Error initializing active quests:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Utility function for tracking quest progress in any API
 * @param {string} userId - The user ID
 * @param {string} actionType - The type of action being performed
 * @param {object} actionData - The action data for additional context
 * @returns {Promise<Object>} - Result of quest progress update
 */
async function trackQuestProgress(userId, actionType, actionData = {}) {
    if (!userId || !actionType) {
        console.log('Missing userId or actionType in trackQuestProgress');
        return { success: false, message: 'Missing required parameters' };
    }
    
    try {
        console.log(`[QUEST TRACKING] Starting progress tracking for user: ${userId}, action: ${actionType}`, actionData);
        
        // Map of API actions to quest actions
        const actionMapping = {
            // Building actions
            'place_building': 'place_building',
            'move_building': 'move_building',
            'upgrade_building': 'upgrade_building',
            'collect_building_gold': 'collect_gold',
            
            // Creature actions
            'create_creature': 'create_creature',
            'upgrade_creature': 'upgrade_creature',
            'merge_creatures': 'merge_creatures',
            'assign_creature': 'assign_creature',
            'feed_creature': 'feed_creature',
            
            // Combat actions
            'win_battle': 'win_battle',
            'participate_battle': 'participate_battle',
            'get_knockout': 'get_knockout',
            
            // Card/Item actions
            'open_card_pack': 'open_card_pack',
            'open_chest': 'open_chest',
            
            // Currency actions
            'collect_gold': 'collect_gold',
            'collect_arcane_energy': 'collect_arcane_energy',
            'spend_gems': 'spend_gems',
            'spend_gold': 'spend_gold',
            
            // Decoration actions
            'place_decoration': 'place_decoration',
            
            // Boost actions
            'use_boost': 'use_boost'
        };
        
        // Determine the quest action from the mapping or use the original action
        const questAction = actionMapping[actionType] || actionType;
        console.log(`[QUEST TRACKING] Mapped action '${actionType}' to '${questAction}'`);
        
        // Extract amount from action data if available, default to 1
        const amount = actionData.amount || 1;
        console.log(`[QUEST TRACKING] Progress amount: ${amount}`);
        
        // Update quest progress for the mapped action
        const result = await updateQuestProgress(userId, questAction, amount);
        
        // Log quest progress for debugging
        console.log(`[QUEST TRACKING] Quest progress updated for user ${userId}, action: ${questAction}, amount: ${amount}`);
        console.log(`[QUEST TRACKING] Result: ${JSON.stringify(result)}`);
        
        return result;
    } catch (error) {
        console.error('[QUEST TRACKING] Error in trackQuestProgress:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Replace a quest with a new random one for a user
 * @param {string} userId - The user ID
 * @param {string} questId - The quest ID to replace
 * @returns {Promise<Object>} - Result of the replacement
 */
async function replaceQuest(userId, questId) {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }
        
        // Find quest in user's active quests
        const userQuestIndex = user.active_quests.findIndex(q => q.quest_id === questId);
        if (userQuestIndex === -1) {
            throw new Error(`Quest ${questId} not found for user ${userId}`);
        }
        
        // Get the quest that is being replaced
        const replacedQuest = await Quest.findOne({ quest_id: questId });
        if (!replacedQuest) {
            throw new Error(`Quest ${questId} not found in database`);
        }
        
        const questType = replacedQuest.type; // daily, weekly, or monthly
        
        // Check replacement limits
        if (!user.quest_stats) {
            user.quest_stats = {};
        }
        
        // Initialize replacement counters if they don't exist
        if (typeof user.quest_stats.daily_replacements === 'undefined') {
            user.quest_stats.daily_replacements = 0;
        }
        if (typeof user.quest_stats.weekly_replacements === 'undefined') {
            user.quest_stats.weekly_replacements = 0;
        }
        if (typeof user.quest_stats.monthly_replacements === 'undefined') {
            user.quest_stats.monthly_replacements = 0;
        }
        if (typeof user.quest_stats.total_replacements === 'undefined') {
            user.quest_stats.total_replacements = 0;
        }
        
        // Set replacement limits
        const MAX_DAILY_REPLACEMENTS = 2;
        const MAX_WEEKLY_REPLACEMENTS = 5;
        const MAX_MONTHLY_REPLACEMENTS = 10;
        
        // Check if user has exceeded the replacement limit
        switch (questType) {
            case 'daily':
                if (user.quest_stats.daily_replacements >= MAX_DAILY_REPLACEMENTS) {
                    throw new Error(`You have reached the maximum number of daily quest replacements (${MAX_DAILY_REPLACEMENTS})`);
                }
                break;
            case 'weekly':
                if (user.quest_stats.weekly_replacements >= MAX_WEEKLY_REPLACEMENTS) {
                    throw new Error(`You have reached the maximum number of weekly quest replacements (${MAX_WEEKLY_REPLACEMENTS})`);
                }
                break;
            case 'monthly':
                if (user.quest_stats.monthly_replacements >= MAX_MONTHLY_REPLACEMENTS) {
                    throw new Error(`You have reached the maximum number of monthly quest replacements (${MAX_MONTHLY_REPLACEMENTS})`);
                }
                break;
        }
        
        // Get all active quests of the same type
        const allQuests = await Quest.find({ 
            type: questType, 
            active: true,
            quest_id: { $ne: questId } // Exclude current quest
        });
        
        // Filter out quests that the user already has
        const userQuestIds = user.active_quests.map(q => q.quest_id);
        const availableQuests = allQuests.filter(q => !userQuestIds.includes(q.quest_id));
        
        if (availableQuests.length === 0) {
            throw new Error(`No available ${questType} quests to replace with`);
        }
        
        // Select a random quest from available quests
        const randomIndex = Math.floor(Math.random() * availableQuests.length);
        const newQuest = availableQuests[randomIndex];
        
        // Calculate expiration time based on the original quest's expiration
        const expiresAt = user.active_quests[userQuestIndex].expires_at;
        
        // Remove the old quest
        const oldQuest = { ...user.active_quests[userQuestIndex] };
        user.active_quests.splice(userQuestIndex, 1);
        
        // Add new quest
        user.active_quests.push({
            quest_id: newQuest.quest_id,
            progress: 0,
            completed: false,
            rewarded: false,
            expires_at: expiresAt
        });
        
        // Increment appropriate replacement counters
        switch (questType) {
            case 'daily':
                user.quest_stats.daily_replacements += 1;
                break;
            case 'weekly':
                user.quest_stats.weekly_replacements += 1;
                break;
            case 'monthly':
                user.quest_stats.monthly_replacements += 1;
                break;
        }
        user.quest_stats.total_replacements += 1;
        
        // Add to replaced_quests history
        if (!user.replaced_quests) {
            user.replaced_quests = [];
        }
        
        user.replaced_quests.push({
            old_quest_id: questId,
            old_quest_title: replacedQuest.title,
            new_quest_id: newQuest.quest_id,
            new_quest_title: newQuest.title,
            quest_type: questType,
            replaced_at: new Date()
        });
        
        // Save user
        await user.save();
        
        return {
            success: true,
            message: `Successfully replaced quest ${questId} with ${newQuest.quest_id}`,
            data: {
                userId,
                old_quest: {
                    quest_id: questId,
                    title: replacedQuest.title,
                    description: replacedQuest.description
                },
                new_quest: {
                    quest_id: newQuest.quest_id,
                    title: newQuest.title,
                    description: newQuest.description,
                    action: newQuest.action,
                    required_amount: newQuest.required_amount,
                    reward_type: newQuest.reward_type,
                    reward_amount: newQuest.reward_amount
                },
                quest_type: questType,
                replacements: {
                    daily: user.quest_stats.daily_replacements,
                    weekly: user.quest_stats.weekly_replacements,
                    monthly: user.quest_stats.monthly_replacements,
                    total: user.quest_stats.total_replacements
                },
                limits: {
                    daily: MAX_DAILY_REPLACEMENTS,
                    weekly: MAX_WEEKLY_REPLACEMENTS,
                    monthly: MAX_MONTHLY_REPLACEMENTS
                }
            }
        };
    } catch (error) {
        console.error('Error replacing quest:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Assign elite quests to a user with Elite Pass
 * @param {string} userId - The user ID to assign quests to
 * @returns {Promise<Object>} - Result of assignment
 */
async function assignEliteQuestsToUser(userId) {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        // Check if user has an active Elite Pass
        if (!user.elite_pass || !user.elite_pass.active) {
            throw new Error(`User ${userId} does not have an active Elite Pass`);
        }

        // Get all active elite quests
        const eliteQuests = await Quest.find({ is_elite: true, active: true });
        if (!eliteQuests || eliteQuests.length === 0) {
            throw new Error(`No active elite quests found`);
        }

        // Calculate expiration time (weekly like regular weekly quests)
        const now = new Date();
        let expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 7);
        expiresAt.setHours(23, 59, 59, 999);

        // Remove any existing elite quests
        user.active_quests = user.active_quests.filter(q => {
            // Get quest details
            const quest = eliteQuests.find(quest => quest.quest_id === q.quest_id);
            return !quest || !quest.is_elite;
        });

        // Select 3 random elite quests
        const shuffled = [...eliteQuests].sort(() => 0.5 - Math.random());
        const selectedEliteQuests = shuffled.slice(0, 3);

        // Add new elite quests
        for (const quest of selectedEliteQuests) {
            // Add quest to user's active quests
            user.active_quests.push({
                quest_id: quest.quest_id,
                progress: 0,
                completed: false,
                rewarded: false,
                expires_at: expiresAt
            });
        }

        // Update last refresh timestamp
        if (!user.elite_quest_stats) {
            user.elite_quest_stats = {
                completed: 0,
                last_refresh: null,
                replacements: 0
            };
        }
        user.elite_quest_stats.last_refresh = now;
        user.elite_quest_stats.replacements = 0; // Reset replacements counter

        // Save user
        await user.save();

        return {
            success: true,
            message: `Assigned ${selectedEliteQuests.length} elite quests to user ${userId}`,
            data: {
                userId,
                assigned_quests: selectedEliteQuests.map(q => ({
                    quest_id: q.quest_id,
                    title: q.title,
                    description: q.description,
                    required_amount: q.required_amount,
                    reward_type: q.reward_type,
                    reward_amount: q.reward_amount,
                    expires_at: expiresAt
                }))
            }
        };
    } catch (error) {
        console.error(`Error assigning elite quests:`, error);
        return {
            success: false,
            message: error.message
        };
    }
}

module.exports = {
    assignQuestsToUser,
    updateQuestProgress,
    claimQuestReward,
    getUserQuests,
    refreshQuestsForAllUsers,
    checkExpiredQuests,
    getRandomQuests,
    getActiveQuests,
    checkAndRefreshActiveQuests,
    assignActiveQuestsToUser,
    initializeActiveQuests,
    trackQuestProgress,
    replaceQuest,
    assignEliteQuestsToUser
}; 