const mongoose = require('mongoose');
const BattlePass = require('../models/battlePass');
const UserBattlePass = require('../models/userBattlePass');
const User = require('../models/user');

/**
 * Get user's battle pass progress with detailed tracking
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Detailed battle pass progress
 */
async function getUserBattlePassProgress(userId) {
    try {
        // Check if user exists
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Get current active battle pass
        const now = new Date();
        const battlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });

        if (!battlePass) {
            return {
                success: false,
                message: 'No active Battle Pass found'
            };
        }

        // Find user battle pass progress
        let userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });

        if (!userBattlePass) {
            // User hasn't started this battle pass yet
            return {
                success: true,
                message: 'User has not started this Battle Pass',
                data: {
                    battle_pass_name: battlePass.name,
                    battle_pass_end_date: battlePass.end_date,
                    has_started: false,
                    is_elite: false,
                    current_level: 0,
                    current_xp: 0,
                    max_level: battlePass.max_level,
                    season_days_remaining: Math.ceil((battlePass.end_date - now) / (1000 * 60 * 60 * 24))
                }
            };
        }

        // Get all rewards from battle pass
        const allFreeRewards = battlePass.free_rewards;
        const allEliteRewards = battlePass.elite_rewards;

        // Organize claimed and unclaimed rewards
        const claimedFreeRewards = [];
        const claimedEliteRewards = [];
        const unclaimedFreeRewards = [];
        const unclaimedEliteRewards = [];
        const lockedFreeRewards = [];
        const lockedEliteRewards = [];

        // Process free rewards
        for (const reward of allFreeRewards) {
            const claimed = userBattlePass.claimed_rewards.some(
                r => r.level === reward.level && r.is_free === true
            );

            if (claimed) {
                claimedFreeRewards.push({
                    ...reward.toObject(),
                    claimed: true,
                    locked: false
                });
            } else if (reward.level <= userBattlePass.current_level) {
                unclaimedFreeRewards.push({
                    ...reward.toObject(),
                    claimed: false,
                    locked: false
                });
            } else {
                lockedFreeRewards.push({
                    ...reward.toObject(),
                    claimed: false,
                    locked: true,
                    levels_away: reward.level - userBattlePass.current_level
                });
            }
        }

        // Process elite rewards (if user has elite pass)
        for (const reward of allEliteRewards) {
            const claimed = userBattlePass.claimed_rewards.some(
                r => r.level === reward.level && r.is_elite === true
            );

            if (claimed) {
                claimedEliteRewards.push({
                    ...reward.toObject(),
                    claimed: true,
                    locked: false
                });
            } else if (reward.level <= userBattlePass.current_level && userBattlePass.is_elite) {
                unclaimedEliteRewards.push({
                    ...reward.toObject(),
                    claimed: false,
                    locked: false
                });
            } else {
                lockedEliteRewards.push({
                    ...reward.toObject(),
                    claimed: false,
                    locked: true,
                    levels_away: reward.level - userBattlePass.current_level,
                    requires_elite: !userBattlePass.is_elite
                });
            }
        }

        // Calculate XP to next level
        let xpToNextLevel = 0;
        let xpForCurrentLevel = 0;
        let totalXpNeeded = 0;
        let currentLevelProgress = 0;

        if (userBattlePass.current_level < battlePass.max_level) {
            // Calculate XP for all previous levels
            for (let level = 1; level < userBattlePass.current_level; level++) {
                const xpRequirement = battlePass.xp_requirements.find(
                    req => level >= req.level_start && level <= req.level_end
                );
                
                if (xpRequirement) {
                    totalXpNeeded += xpRequirement.xp_required;
                }
            }
            
            // Get current level XP requirement
            const currentLevelXpReq = battlePass.xp_requirements.find(
                req => userBattlePass.current_level >= req.level_start && userBattlePass.current_level <= req.level_end
            );
            
            if (currentLevelXpReq) {
                xpForCurrentLevel = currentLevelXpReq.xp_required;
                const xpInCurrentLevel = userBattlePass.current_xp - totalXpNeeded;
                xpToNextLevel = Math.max(0, xpForCurrentLevel - xpInCurrentLevel);
                currentLevelProgress = Math.min(100, Math.floor((xpInCurrentLevel / xpForCurrentLevel) * 100));
            }
        } else {
            // User is at max level
            currentLevelProgress = 100;
        }

        // Get recent XP history (last 10 entries)
        const recentXpHistory = userBattlePass.xp_history
            .sort((a, b) => b.date - a.date)
            .slice(0, 10)
            .map(entry => ({
                amount: entry.amount,
                source: entry.source,
                date: entry.date
            }));

        return {
            success: true,
            data: {
                battle_pass_name: battlePass.name,
                battle_pass_description: battlePass.description,
                battle_pass_start_date: battlePass.start_date,
                battle_pass_end_date: battlePass.end_date,
                has_started: true,
                is_elite: userBattlePass.is_elite,
                current_level: userBattlePass.current_level,
                current_xp: userBattlePass.current_xp,
                max_level: battlePass.max_level,
                xp_to_next_level: xpToNextLevel,
                current_level_progress: currentLevelProgress,
                recent_xp_history: recentXpHistory,
                season_days_remaining: Math.ceil((battlePass.end_date - now) / (1000 * 60 * 60 * 24)),
                
                // Reward tracking
                free_rewards: {
                    claimed: claimedFreeRewards,
                    unclaimed: unclaimedFreeRewards,
                    locked: lockedFreeRewards
                },
                elite_rewards: {
                    claimed: claimedEliteRewards,
                    unclaimed: unclaimedEliteRewards,
                    locked: lockedEliteRewards
                },
                
                // Summary counts
                summary: {
                    total_free_rewards: allFreeRewards.length,
                    claimed_free_rewards: claimedFreeRewards.length,
                    unclaimed_free_rewards: unclaimedFreeRewards.length,
                    
                    total_elite_rewards: allEliteRewards.length,
                    claimed_elite_rewards: claimedEliteRewards.length,
                    unclaimed_elite_rewards: unclaimedEliteRewards.length,
                    
                    completion_percentage: Math.floor(
                        ((claimedFreeRewards.length + (userBattlePass.is_elite ? claimedEliteRewards.length : 0)) / 
                        (allFreeRewards.length + (userBattlePass.is_elite ? allEliteRewards.length : 0))) * 100
                    )
                }
            }
        };
    } catch (error) {
        console.error('Error getting battle pass progress:', error);
        return {
            success: false,
            message: 'Error getting battle pass progress',
            error: error.message
        };
    }
}

/**
 * Get leaderboard of users by battle pass level
 * @param {number} limit - Number of users to return (default 20)
 * @returns {Promise<Object>} Leaderboard of users
 */
async function getBattlePassLeaderboard(limit = 20) {
    try {
        // Get current active battle pass
        const now = new Date();
        const battlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });

        if (!battlePass) {
            return {
                success: false,
                message: 'No active Battle Pass found'
            };
        }

        // Get all user battle passes for this battle pass
        const userBattlePasses = await UserBattlePass.find({
            battle_pass_id: battlePass._id
        }).sort({ current_level: -1, current_xp: -1 }).limit(limit);

        // Get user details for each entry
        const leaderboard = [];
        for (const userBP of userBattlePasses) {
            const user = await User.findOne({ userId: userBP.userId });
            if (user) {
                leaderboard.push({
                    userId: userBP.userId,
                    username: user.username || user.userId,
                    level: userBP.current_level,
                    xp: userBP.current_xp,
                    is_elite: userBP.is_elite,
                    claimed_rewards: userBP.claimed_rewards.length
                });
            }
        }

        return {
            success: true,
            data: {
                battle_pass_name: battlePass.name,
                season_days_remaining: Math.ceil((battlePass.end_date - now) / (1000 * 60 * 60 * 24)),
                leaderboard
            }
        };
    } catch (error) {
        console.error('Error getting battle pass leaderboard:', error);
        return {
            success: false,
            message: 'Error getting battle pass leaderboard',
            error: error.message
        };
    }
}

/**
 * Get user's next available rewards
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Next available rewards
 */
async function getNextAvailableRewards(userId) {
    try {
        // Check if user exists
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Get current active battle pass
        const now = new Date();
        const battlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });

        if (!battlePass) {
            return {
                success: false,
                message: 'No active Battle Pass found'
            };
        }

        // Find user battle pass progress
        let userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });

        if (!userBattlePass) {
            // User hasn't started this battle pass yet
            return {
                success: true,
                message: 'User has not started this Battle Pass',
                data: {
                    current_level: 0,
                    next_free_rewards: [battlePass.free_rewards.find(r => r.level === 1)],
                    next_elite_rewards: [battlePass.elite_rewards.find(r => r.level === 1)]
                }
            };
        }

        // Get unclaimed rewards at current level
        const unclaimedCurrentFreeRewards = battlePass.free_rewards
            .filter(r => r.level === userBattlePass.current_level)
            .filter(r => !userBattlePass.claimed_rewards.some(
                cr => cr.level === r.level && cr.is_free === true
            ));

        const unclaimedCurrentEliteRewards = userBattlePass.is_elite ? 
            battlePass.elite_rewards
                .filter(r => r.level === userBattlePass.current_level)
                .filter(r => !userBattlePass.claimed_rewards.some(
                    cr => cr.level === r.level && cr.is_elite === true
                )) : [];

        // Get next level rewards
        const nextLevelFreeRewards = battlePass.free_rewards
            .filter(r => r.level === userBattlePass.current_level + 1);
            
        const nextLevelEliteRewards = userBattlePass.is_elite ?
            battlePass.elite_rewards
                .filter(r => r.level === userBattlePass.current_level + 1) : [];

        // Calculate XP needed for next level
        let xpToNextLevel = 0;
        
        if (userBattlePass.current_level < battlePass.max_level) {
            // Calculate XP for all previous levels
            let totalXpNeeded = 0;
            for (let level = 1; level < userBattlePass.current_level; level++) {
                const xpRequirement = battlePass.xp_requirements.find(
                    req => level >= req.level_start && level <= req.level_end
                );
                
                if (xpRequirement) {
                    totalXpNeeded += xpRequirement.xp_required;
                }
            }
            
            // Get current level XP requirement
            const currentLevelXpReq = battlePass.xp_requirements.find(
                req => userBattlePass.current_level >= req.level_start && userBattlePass.current_level <= req.level_end
            );
            
            if (currentLevelXpReq) {
                const xpInCurrentLevel = userBattlePass.current_xp - totalXpNeeded;
                xpToNextLevel = Math.max(0, currentLevelXpReq.xp_required - xpInCurrentLevel);
            }
        }

        return {
            success: true,
            data: {
                current_level: userBattlePass.current_level,
                is_elite: userBattlePass.is_elite,
                xp_to_next_level: xpToNextLevel,
                unclaimed_current_level: {
                    free: unclaimedCurrentFreeRewards,
                    elite: unclaimedCurrentEliteRewards
                },
                next_level_rewards: {
                    level: userBattlePass.current_level + 1,
                    free: nextLevelFreeRewards,
                    elite: nextLevelEliteRewards
                }
            }
        };
    } catch (error) {
        console.error('Error getting next available rewards:', error);
        return {
            success: false,
            message: 'Error getting next available rewards',
            error: error.message
        };
    }
}

module.exports = {
    getUserBattlePassProgress,
    getBattlePassLeaderboard,
    getNextAvailableRewards
}; 