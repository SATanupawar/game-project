const mongoose = require('mongoose');
const BattlePass = require('../models/battlePass');
const UserBattlePass = require('../models/userBattlePass');
const User = require('../models/user');

/**
 * Create a new Battle Pass
 * @param {Object} battlePassData - Battle Pass data
 * @returns {Promise<Object>} Created Battle Pass
 */
async function createBattlePass(battlePassData) {
    try {
        // Check if there's already an active battle pass that would overlap
        const existingBattlePasses = await BattlePass.find({
            active: true,
            $or: [
                // New battle pass starts during an existing one
                {
                    start_date: { $lte: battlePassData.start_date },
                    end_date: { $gte: battlePassData.start_date }
                },
                // New battle pass ends during an existing one
                {
                    start_date: { $lte: battlePassData.end_date },
                    end_date: { $gte: battlePassData.end_date }
                },
                // New battle pass completely contains an existing one
                {
                    start_date: { $gte: battlePassData.start_date },
                    end_date: { $lte: battlePassData.end_date }
                }
            ]
        });

        if (existingBattlePasses.length > 0) {
            return {
                success: false,
                message: 'There is already an active Battle Pass during this time period'
            };
        }

        // Create new battle pass
        const battlePass = new BattlePass(battlePassData);
        await battlePass.save();

        return {
            success: true,
            message: 'Battle Pass created successfully',
            battle_pass: battlePass
        };
    } catch (error) {
        console.error('Error creating Battle Pass:', error);
        return {
            success: false,
            message: 'Error creating Battle Pass',
            error: error.message
        };
    }
}

/**
 * Get the current active Battle Pass
 * @returns {Promise<Object>} Active Battle Pass
 */
async function getCurrentBattlePass() {
    try {
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

        return {
            success: true,
            battle_pass: battlePass
        };
    } catch (error) {
        console.error('Error getting current Battle Pass:', error);
        return {
            success: false,
            message: 'Error getting current Battle Pass',
            error: error.message
        };
    }
}

/**
 * Get a user's Battle Pass progress
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User's Battle Pass progress
 */
async function getUserBattlePassProgress(userId) {
    try {
        // Get current battle pass
        const currentBattlePassResult = await getCurrentBattlePass();
        if (!currentBattlePassResult.success) {
            return currentBattlePassResult; // Return the error
        }

        const battlePass = currentBattlePassResult.battle_pass;

        // Find or create user battle pass progress
        let userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });

        if (!userBattlePass) {
            // Check if user has elite pass
            const user = await User.findOne({ userId });
            const isElite = user && user.elite_pass && user.elite_pass.active;

            // Create new progress record
            userBattlePass = new UserBattlePass({
                userId,
                battle_pass_id: battlePass._id,
                is_elite: isElite
            });
            await userBattlePass.save();
        }

        // Get unclaimed rewards
        const unclaimedFreeRewards = [];
        const unclaimedEliteRewards = [];

        // Check free rewards
        for (const reward of battlePass.free_rewards) {
            if (reward.level <= userBattlePass.current_level) {
                const claimed = userBattlePass.claimed_rewards.some(
                    r => r.level === reward.level && r.is_free === true
                );
                if (!claimed) {
                    unclaimedFreeRewards.push(reward);
                }
            }
        }

        // Check elite rewards if user has elite pass
        if (userBattlePass.is_elite) {
            for (const reward of battlePass.elite_rewards) {
                if (reward.level <= userBattlePass.current_level) {
                    const claimed = userBattlePass.claimed_rewards.some(
                        r => r.level === reward.level && r.is_elite === true
                    );
                    if (!claimed) {
                        unclaimedEliteRewards.push(reward);
                    }
                }
            }
        }

        // Calculate XP to next level
        let xpToNextLevel = 0;
        let totalXpForCurrentLevel = 0;
        
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
                totalXpForCurrentLevel = currentLevelXpReq.xp_required;
                const xpInCurrentLevel = userBattlePass.current_xp - totalXpNeeded;
                xpToNextLevel = Math.max(0, totalXpForCurrentLevel - xpInCurrentLevel);
            }
        }

        // Separate claimed rewards into free and elite categories
        const claimedRewards = userBattlePass.claimed_rewards || [];
        const claimedFreeRewards = claimedRewards.filter(reward => !reward.is_elite);
        const claimedEliteRewards = claimedRewards.filter(reward => reward.is_elite);

        return {
            success: true,
            message: 'Battle Pass progress retrieved successfully',
            data: {
                battle_pass: {
                    _id: battlePass._id,
                    name: battlePass.name,
                    description: battlePass.description,
                    start_date: battlePass.start_date,
                    end_date: battlePass.end_date,
                    max_level: battlePass.max_level
                },
                user_progress: {
                    current_xp: userBattlePass.current_xp,
                    current_level: userBattlePass.current_level,
                    is_elite: userBattlePass.is_elite,
                    last_collected_level: userBattlePass.last_collected_level || 0,
                    xp_to_next_level: xpToNextLevel,
                    total_xp_for_current_level: totalXpForCurrentLevel,
                    claimed_rewards: {
                        free: claimedFreeRewards,
                        elite: claimedEliteRewards
                    },
                    unclaimed_free_rewards: unclaimedFreeRewards,
                    unclaimed_elite_rewards: unclaimedEliteRewards
                },
                season_time_remaining: Math.max(0, Math.floor((battlePass.end_date - new Date()) / 1000))
            }
        };
    } catch (error) {
        console.error('Error getting user Battle Pass progress:', error);
        return {
            success: false,
            message: 'Error getting user Battle Pass progress',
            error: error.message
        };
    }
}

// Calculate completed levels and current level progress
const calculateBattlePassProgress = async (userBattlePass, battlePass) => {
    const currentLevel = userBattlePass.current_level;
    const currentXP = userBattlePass.current_xp;
    
    // Calculate completed levels
    const completedLevels = [];
    let totalXpForCompletedLevels = 0;
    
    for (let level = 1; level < currentLevel; level++) {
        completedLevels.push(level);
        
        // Find the XP requirement for this level
        const xpRequirement = battlePass.xp_requirements.find(
            req => level >= req.level_start && level <= req.level_end
        );
        
        if (xpRequirement) {
            totalXpForCompletedLevels += xpRequirement.xp_required;
        }
    }
    
    // Calculate current level progress
    const currentLevelXpReq = battlePass.xp_requirements.find(
        req => currentLevel >= req.level_start && currentLevel <= req.level_end
    );
    
    const xpRequired = currentLevelXpReq ? currentLevelXpReq.xp_required : 0;
    const xpEarned = currentXP - totalXpForCompletedLevels;
    const xpRemaining = Math.max(0, xpRequired - xpEarned);
    const progressPercentage = xpRequired > 0 ? Math.min(100, Math.floor((xpEarned / xpRequired) * 100)) : 0;
    
    // Get uncollected rewards
    const unclaimedRewards = [];
    for (let level = 1; level < currentLevel; level++) {
        const claimed = userBattlePass.claimed_rewards.some(r => r.level === level);
        if (!claimed) {
            unclaimedRewards.push(level);
        }
    }
    
    return {
        completed_levels: {
            count: completedLevels.length,
            levels: completedLevels,
            total_xp_earned: totalXpForCompletedLevels
        },
        current_level_progress: {
            xp_required: xpRequired,
            xp_earned: xpEarned,
            xp_remaining: xpRemaining,
            progress_percentage: progressPercentage
        },
        uncollected_rewards: unclaimedRewards
    };
};

/**
 * Add XP to a user's Battle Pass
 * @param {string} userId - User ID
 * @param {number} xpAmount - Amount of XP to add
 * @param {string} source - Source of the XP
 * @returns {Promise<Object>} Updated progress
 */
async function addUserBattlePassXP(userId, xpAmount, source) {
    try {
        if (!userId || typeof xpAmount !== 'number' || xpAmount <= 0) {
            return {
                success: false,
                message: 'Invalid user ID or XP amount'
            };
        }

        // Get current battle pass
        const currentBattlePassResult = await getCurrentBattlePass();
        if (!currentBattlePassResult.success) {
            return currentBattlePassResult; // Return the error
        }

        const battlePass = currentBattlePassResult.battle_pass;

        // Find or create user battle pass progress
        let userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });

        // Find the user to update their summary
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        if (!userBattlePass) {
            // Check if user has elite pass
            const isElite = user && user.elite_pass && user.elite_pass.active;

            // Create new progress record
            userBattlePass = new UserBattlePass({
                userId,
                battle_pass_id: battlePass._id,
                is_elite: isElite
            });
        }

        // Save current level for comparison
        const previousLevel = userBattlePass.current_level;

        // Add XP and update level
        await userBattlePass.addXP(xpAmount, source);

        // Check if user leveled up
        const leveledUp = userBattlePass.current_level > previousLevel;
        const newRewards = [];

        if (leveledUp) {
            // Find new rewards that are available at the new level
            for (let level = previousLevel + 1; level <= userBattlePass.current_level; level++) {
                // Add free rewards
                const freeReward = battlePass.free_rewards.find(r => r.level === level);
                if (freeReward) {
                    newRewards.push({
                        ...freeReward.toObject(),
                        is_free: true,
                        is_elite: false
                    });
                }

                // Add elite rewards if user has elite pass
                if (userBattlePass.is_elite) {
                    const eliteReward = battlePass.elite_rewards.find(r => r.level === level);
                    if (eliteReward) {
                        newRewards.push({
                            ...eliteReward.toObject(),
                            is_free: false,
                            is_elite: true
                        });
                    }
                }
            }
        }

        // Calculate battle pass progress details
        const progressDetails = await calculateBattlePassProgress(userBattlePass, battlePass);

        // Update user's battle pass summary
        if (!user.battlePassSummary) {
            user.battlePassSummary = {};
        }
        
        user.battlePassSummary = {
            current_level: userBattlePass.current_level,
            current_xp: userBattlePass.current_xp,
            is_elite: userBattlePass.is_elite,
            completed_levels: progressDetails.completed_levels,
            current_level_progress: progressDetails.current_level_progress,
            claimed_rewards: userBattlePass.claimed_rewards || [],
            last_collected_level: userBattlePass.last_collected_level || 0,
            uncollected_rewards: progressDetails.uncollected_rewards,
            battle_pass_id: battlePass._id,
            battle_pass_name: battlePass.name,
            last_updated: new Date()
        };
        
        user.markModified('battlePassSummary');
        await user.save();

        return {
            success: true,
            message: `Added ${xpAmount} XP to Battle Pass`,
            data: {
                previous_level: previousLevel,
                current_level: userBattlePass.current_level,
                current_xp: userBattlePass.current_xp,
                leveled_up: leveledUp,
                new_rewards: newRewards
            }
        };
    } catch (error) {
        console.error('Error adding Battle Pass XP:', error);
        return {
            success: false,
            message: 'Error adding Battle Pass XP',
            error: error.message
        };
    }
}

/**
 * Claim a Battle Pass reward
 * @param {string} userId - User ID
 * @param {number} level - Level of the reward
 * @param {boolean} isElite - Whether this is an elite reward
 * @returns {Promise<Object>} Claimed reward
 */
async function claimBattlePassReward(userId, level, isElite) {
    try {
        // Get current battle pass
        const currentBattlePassResult = await getCurrentBattlePass();
        if (!currentBattlePassResult.success) {
            return currentBattlePassResult; // Return the error
        }

        const battlePass = currentBattlePassResult.battle_pass;

        // Find user battle pass progress
        const userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });

        if (!userBattlePass) {
            return {
                success: false,
                message: 'User has not started this Battle Pass'
            };
        }

        // Try to claim the reward
        try {
            const reward = await userBattlePass.claimReward(level, isElite);
            
            // Process the reward - add to user's account based on reward type
            const user = await User.findOne({ userId });
            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            // Initialize currency object if it doesn't exist
            if (!user.currency) {
                user.currency = {
                    gems: 0,
                    arcane_energy: 0,
                    anima: 0,
                    gold: 0
                };
            }
            
            let rewardDetails = null;
            
            switch (reward.reward_type) {
                case 'gold':
                    user.gold_coins = (user.gold_coins || 0) + reward.amount;
                    user.currency.gold = (user.currency.gold || 0) + reward.amount;
                    rewardDetails = { gold: reward.amount };
                    break;
                    
                case 'arcane_energy':
                    user.currency.arcane_energy = (user.currency.arcane_energy || 0) + reward.amount;
                    rewardDetails = { arcane_energy: reward.amount };
                    break;
                    
                case 'anima':
                    user.currency.anima = (user.currency.anima || 0) + reward.amount;
                    rewardDetails = { anima: reward.amount };
                    break;
                    
                case 'gems':
                    user.currency.gems = (user.currency.gems || 0) + reward.amount;
                    rewardDetails = { gems: reward.amount };
                    break;
                    
                case 'card_pack':
                    // Add card pack to user's inventory
                    if (!user.card_packs) user.card_packs = [];
                    user.card_packs.push({
                        pack_id: reward.pack_id,
                        name: reward.description || 'Battle Pass Pack',
                        obtained_at: new Date(),
                        source: 'battle_pass',
                        is_opened: false
                    });
                    user.markModified('card_packs');
                    rewardDetails = { pack_id: reward.pack_id };
                    break;
                    
                case 'creature':
                    // Add creature to user's inventory
                    if (!user.creature_inventory) user.creature_inventory = [];
                    
                    // Prepare creature data with required fields
                    const creatureData = {
                        creature_id: reward.creature_id, // String ID is fine for now
                        name: reward.description || 'Battle Pass Creature',
                        creature_type: 'battle_pass',
                        count: 1,
                        rarity: 'rare',
                        obtained_at: new Date(),
                        source: 'battle_pass'
                    };
                    
                    // Try to convert to ObjectId if it's a valid format
                    if (reward.creature_id && reward.creature_id.match(/^[0-9a-fA-F]{24}$/)) {
                        creatureData.creature_id = new mongoose.Types.ObjectId(reward.creature_id);
                        
                        // Check if creature already exists in inventory
                        const existingCreature = user.creature_inventory.find(c => 
                            c.creature_id && c.creature_id.toString() === reward.creature_id
                        );
                        
                        if (existingCreature) {
                            existingCreature.count += 1;
                        } else {
                            user.creature_inventory.push(creatureData);
                        }
                    } else {
                        // If it's not a valid ObjectId, still add to inventory with string ID
                        // Check if creature already exists by name
                        const existingCreature = user.creature_inventory.find(c => 
                            c.name === creatureData.name
                        );
                        
                        if (existingCreature) {
                            existingCreature.count += 1;
                        } else {
                            user.creature_inventory.push(creatureData);
                        }
                    }
                    
                    user.markModified('creature_inventory');
                    rewardDetails = { creature_id: reward.creature_id };
                    break;
                    
                case 'decoration':
                    // Add decoration to user (this would depend on your existing system)
                    if (!user.decorations) user.decorations = [];
                    user.decorations.push({
                        decoration_id: reward.decoration_id,
                        obtained_at: new Date(),
                        source: 'battle_pass'
                    });
                    rewardDetails = { decoration_id: reward.decoration_id };
                    break;
            }
            
            // Mark modified to ensure nested fields are saved
            user.markModified('currency');
            if (reward.reward_type === 'card_pack') user.markModified('card_packs');
            if (reward.reward_type === 'creature') user.markModified('creature_inventory');
            if (reward.reward_type === 'decoration') user.markModified('decorations');
            
            // Calculate battle pass progress details
            const progressDetails = await calculateBattlePassProgress(userBattlePass, battlePass);
            
            // Update user's battle pass summary with the latest claimed rewards
            if (!user.battlePassSummary) {
                user.battlePassSummary = {};
            }
            
            user.battlePassSummary = {
                current_level: userBattlePass.current_level,
                current_xp: userBattlePass.current_xp,
                is_elite: userBattlePass.is_elite,
                completed_levels: progressDetails.completed_levels,
                current_level_progress: progressDetails.current_level_progress,
                claimed_rewards: userBattlePass.claimed_rewards || [],
                last_collected_level: userBattlePass.last_collected_level || 0,
                uncollected_rewards: progressDetails.uncollected_rewards,
                battle_pass_id: battlePass._id,
                battle_pass_name: battlePass.name,
                last_updated: new Date()
            };
            
            user.markModified('battlePassSummary');
            await user.save();
            
            // Separate claimed rewards into free and elite categories
            const claimedRewards = userBattlePass.claimed_rewards || [];
            const claimedFreeRewards = claimedRewards.filter(reward => !reward.is_elite);
            const claimedEliteRewards = claimedRewards.filter(reward => reward.is_elite);
            
            return {
                success: true,
                message: `Successfully claimed ${isElite ? 'elite' : 'free'} reward for level ${level}`,
                data: {
                    reward_type: reward.reward_type,
                    level,
                    is_elite: isElite,
                    details: rewardDetails,
                    battle_pass: {
                        current_level: userBattlePass.current_level,
                        claimed_rewards: {
                            free: claimedFreeRewards.map(reward => reward.level),
                            elite: claimedEliteRewards.map(reward => reward.level)
                        }
                    }
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    } catch (error) {
        console.error('Error claiming Battle Pass reward:', error);
        return {
            success: false,
            message: 'Error claiming Battle Pass reward',
            error: error.message
        };
    }
}

/**
 * Upgrade a user to Elite Battle Pass
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result
 */
async function upgradeToEliteBattlePass(userId) {
    try {
        // Get current battle pass
        const currentBattlePassResult = await getCurrentBattlePass();
        if (!currentBattlePassResult.success) {
            return currentBattlePassResult; // Return the error
        }

        const battlePass = currentBattlePassResult.battle_pass;

        // Find user battle pass progress
        let userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });

        if (!userBattlePass) {
            // Create new progress record
            userBattlePass = new UserBattlePass({
                userId,
                battle_pass_id: battlePass._id,
                is_elite: true
            });
        } else if (userBattlePass.is_elite) {
            return {
                success: false,
                message: 'User already has Elite Battle Pass'
            };
        } else {
            userBattlePass.is_elite = true;
        }

        await userBattlePass.save();

        // Update user's elite status
        const user = await User.findOne({ userId });
        if (user) {
            if (!user.elite_pass) {
                user.elite_pass = {
                    active: true,
                    activated_at: new Date(),
                    expires_at: new Date(battlePass.end_date)
                };
            } else {
                user.elite_pass.active = true;
                user.elite_pass.activated_at = new Date();
                user.elite_pass.expires_at = new Date(battlePass.end_date);
            }
            
            user.markModified('elite_pass');
            await user.save();
        }

        return {
            success: true,
            message: 'Successfully upgraded to Elite Battle Pass',
            data: {
                is_elite: true,
                expires_at: battlePass.end_date
            }
        };
    } catch (error) {
        console.error('Error upgrading to Elite Battle Pass:', error);
        return {
            success: false,
            message: 'Error upgrading to Elite Battle Pass',
            error: error.message
        };
    }
}

/**
 * Sync a user's battle pass summary with their actual battle pass progress
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Result
 */
async function syncUserBattlePassSummary(userId) {
    try {
        // Get current battle pass
        const currentBattlePassResult = await getCurrentBattlePass();
        if (!currentBattlePassResult.success) {
            return currentBattlePassResult; // Return the error
        }

        const battlePass = currentBattlePassResult.battle_pass;

        // Find user battle pass progress
        const userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });

        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // If user doesn't have battle pass progress yet, initialize empty summary
        if (!userBattlePass) {
            user.battlePassSummary = {
                current_level: 0,
                current_xp: 0,
                is_elite: user.elite_pass && user.elite_pass.active,
                completed_levels: { count: 0, levels: [], total_xp_earned: 0 },
                current_level_progress: { xp_required: 0, xp_earned: 0, xp_remaining: 0, progress_percentage: 0 },
                claimed_rewards: [],
                last_collected_level: 0,
                uncollected_rewards: [],
                battle_pass_id: battlePass._id,
                battle_pass_name: battlePass.name,
                last_updated: new Date()
            };
        } else {
            // Calculate battle pass progress details
            const progressDetails = await calculateBattlePassProgress(userBattlePass, battlePass);
            
            // Update user's battle pass summary
            user.battlePassSummary = {
                current_level: userBattlePass.current_level,
                current_xp: userBattlePass.current_xp,
                is_elite: userBattlePass.is_elite,
                completed_levels: progressDetails.completed_levels,
                current_level_progress: progressDetails.current_level_progress,
                claimed_rewards: userBattlePass.claimed_rewards || [],
                last_collected_level: userBattlePass.last_collected_level || 0,
                uncollected_rewards: progressDetails.uncollected_rewards,
                battle_pass_id: battlePass._id,
                battle_pass_name: battlePass.name,
                last_updated: new Date()
            };
        }

        user.markModified('battlePassSummary');
        await user.save();

        return {
            success: true,
            message: 'Battle Pass summary synced successfully',
            data: {
                userId,
                battlePassSummary: user.battlePassSummary
            }
        };
    } catch (error) {
        console.error('Error syncing Battle Pass summary:', error);
        return {
            success: false,
            message: 'Error syncing Battle Pass summary',
            error: error.message
        };
    }
}

module.exports = {
    createBattlePass,
    getCurrentBattlePass,
    getUserBattlePassProgress,
    addUserBattlePassXP,
    claimBattlePassReward,
    upgradeToEliteBattlePass,
    syncUserBattlePassSummary
}; 