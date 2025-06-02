const mongoose = require('mongoose');
const BattlePass = require('../models/battlePass');
const User = require('../models/user');
const UserBattlePass = require('../models/userBattlePass');

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
 * Calculate completed levels and current level progress
 * @param {Object} user - User document with battlePassSummary
 * @param {Object} battlePass - Battle Pass document
 * @returns {Object} Progress details
 */
function calculateBattlePassProgress(user, battlePass) {
    const currentLevel = user.battlePassSummary.current_level;
    const currentXP = user.battlePassSummary.current_xp;
    
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
        const claimed = user.battlePassSummary.claimed_rewards.some(r => r.level === level);
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

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Check if user has battle pass data
        if (!user.battlePassSummary || !user.battlePassSummary.current_level) {
            // Initialize battle pass data with level 1 (automatically started)
            user.battlePassSummary = {
                current_level: 1,  // Start at level 1 instead of 0
                current_xp: 0,
                is_elite: user.elite_pass && user.elite_pass.active,
                claimed_rewards: [],
                battle_pass_id: battlePass._id,
                battle_pass_name: battlePass.name,
                last_updated: new Date()
            };
            
            await user.save();
            
            // Find or create UserBattlePass record
            let userBattlePass = await UserBattlePass.findOne({
                userId,
                battle_pass_id: battlePass._id
            });
            
            if (!userBattlePass) {
                userBattlePass = new UserBattlePass({
                    userId,
                    battle_pass_id: battlePass._id,
                    current_level: 1,  // Start at level 1
                    current_xp: 0,
                    is_elite: user.elite_pass && user.elite_pass.active
                });
                await userBattlePass.save();
            }
            
            // Return battle pass data as started
            return {
                success: true,
                message: 'Battle Pass started automatically',
                data: {
                    battle_pass_name: battlePass.name,
                    battle_pass_end_date: battlePass.end_date,
                    has_started: true,
                    is_elite: user.elite_pass && user.elite_pass.active,
                    current_level: 1,  // Level 1
                    current_xp: 0,
                    max_level: battlePass.max_level,
                    season_days_remaining: Math.ceil((battlePass.end_date - new Date()) / (1000 * 60 * 60 * 24))
                }
            };
        }

        // Get unclaimed rewards
        const unclaimedFreeRewards = [];
        const unclaimedEliteRewards = [];

        // Check free rewards
        for (const reward of battlePass.free_rewards) {
            if (reward.level <= user.battlePassSummary.current_level) {
                const claimed = user.battlePassSummary.claimed_rewards.some(
                    r => r.level === reward.level && r.is_elite === false
                );
                if (!claimed) {
                    unclaimedFreeRewards.push(reward);
                }
            }
        }

        // Check elite rewards if user has elite pass
        if (user.battlePassSummary.is_elite) {
            for (const reward of battlePass.elite_rewards) {
                if (reward.level <= user.battlePassSummary.current_level) {
                    const claimed = user.battlePassSummary.claimed_rewards.some(
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
        
        if (user.battlePassSummary.current_level < battlePass.max_level) {
            const nextLevel = user.battlePassSummary.current_level + 1;
            const xpRequirement = battlePass.xp_requirements.find(
                req => nextLevel >= req.level_start && nextLevel <= req.level_end
            );
            
            if (xpRequirement) {
                xpToNextLevel = xpRequirement.xp_required;
            }
            
            // Calculate current level XP
            let totalXpNeeded = 0;
            for (let level = 1; level < user.battlePassSummary.current_level; level++) {
                const levelXpReq = battlePass.xp_requirements.find(
                    req => level >= req.level_start && level <= req.level_end
                );
                if (levelXpReq) {
                    totalXpNeeded += levelXpReq.xp_required;
                }
            }
            
            // Get current level XP requirement
            const currentLevelXpReq = battlePass.xp_requirements.find(
                req => user.battlePassSummary.current_level >= req.level_start && user.battlePassSummary.current_level <= req.level_end
            );
            
            if (currentLevelXpReq) {
                totalXpForCurrentLevel = currentLevelXpReq.xp_required;
                const xpInCurrentLevel = user.battlePassSummary.current_xp - totalXpNeeded;
                xpToNextLevel = Math.max(0, totalXpForCurrentLevel - xpInCurrentLevel);
            }
        }

        // Calculate current level progress
        const currentLevelProgress = totalXpForCurrentLevel > 0 ? (user.battlePassSummary.current_xp / totalXpForCurrentLevel) * 100 : 0;

        // Calculate battle pass progress details
        const progressDetails = calculateBattlePassProgress(user, battlePass);

        // Separate claimed rewards into free and elite categories
        const claimedRewards = user.battlePassSummary.claimed_rewards || [];
        const claimedFreeRewards = claimedRewards.filter(reward => !reward.is_elite);
        const claimedEliteRewards = claimedRewards.filter(reward => reward.is_elite);
        
        // Prepare response
        return {
            success: true,
            message: 'Battle Pass progress retrieved successfully',
            data: {
                current_level: user.battlePassSummary.current_level,
                current_xp: user.battlePassSummary.current_xp,
                is_elite: user.battlePassSummary.is_elite,
                last_collected_level: user.battlePassSummary.last_collected_level || 0,
                xp_for_current_level: totalXpForCurrentLevel,
                xp_to_next_level: xpToNextLevel,
                progress_percentage: currentLevelProgress,
                completed_levels: progressDetails.completed_levels,
                current_level_progress: progressDetails.current_level_progress,
                battle_pass: {
                    name: battlePass.name,
                    start_date: battlePass.start_date,
                    end_date: battlePass.end_date,
                    days_remaining: Math.ceil((battlePass.end_date - new Date()) / (1000 * 60 * 60 * 24)),
                    max_level: battlePass.max_level
                },
                claimed_rewards: {
                    free: claimedFreeRewards.map(reward => reward.level),
                    elite: claimedEliteRewards.map(reward => reward.level)
                },
                unclaimed_rewards: progressDetails.uncollected_rewards,
                unclaimed_free_rewards: unclaimedFreeRewards,
                unclaimed_elite_rewards: unclaimedEliteRewards
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

/**
 * Update user's battle pass level based on current XP
 * @param {Object} user - User document
 * @param {Object} battlePass - Battle Pass document
 * @returns {Promise<Object>} Updated user
 */
async function updateUserBattlePassLevel(user, battlePass) {
    let totalXpNeeded = 0;
    let newLevel = 1;
    
    // Calculate the level based on current XP
    for (let level = 1; level <= battlePass.max_level; level++) {
        // Find the XP requirement for this level
        const xpRequirement = battlePass.xp_requirements.find(
            req => level >= req.level_start && level <= req.level_end
        );
        
        if (!xpRequirement) continue;
        
        // If current XP is less than needed for this level, we've found our level
        if (user.battlePassSummary.current_xp < totalXpNeeded + xpRequirement.xp_required) {
            newLevel = level;
            break;
        }
        
        // Add the XP for this level
        totalXpNeeded += xpRequirement.xp_required;
        
        // If we've reached the max level, stop
        if (level === battlePass.max_level) {
            newLevel = battlePass.max_level;
        }
    }
    
    // Update the level
    user.battlePassSummary.current_level = newLevel;
    return user;
}

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

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Initialize battle pass summary if it doesn't exist
        if (!user.battlePassSummary) {
            user.battlePassSummary = {
                current_level: 1,
                current_xp: 0,
                is_elite: user.elite_pass && user.elite_pass.active,
                claimed_rewards: [],
                battle_pass_id: battlePass._id,
                battle_pass_name: battlePass.name,
                last_updated: new Date()
            };
        }
        
        // Save current level for comparison
        const previousLevel = user.battlePassSummary.current_level;

        // Update current XP
        user.battlePassSummary.current_xp += xpAmount;
        
        // Update level
        await updateUserBattlePassLevel(user, battlePass);
        
        // Update timestamp
        user.battlePassSummary.last_updated = new Date();
        
        // Calculate battle pass progress details for internal use
        const progressDetails = calculateBattlePassProgress(user, battlePass);
        
        // Update the progress details
        user.battlePassSummary.completed_levels = progressDetails.completed_levels;
        user.battlePassSummary.current_level_progress = progressDetails.current_level_progress;
        user.battlePassSummary.uncollected_rewards = progressDetails.uncollected_rewards;
        
        user.markModified('battlePassSummary');
        await user.save();

        // Check if user leveled up
        const leveledUp = user.battlePassSummary.current_level > previousLevel;
        const newRewards = [];

        // Make sure current_level_progress has all required fields
        let currentLevelProgress = progressDetails.current_level_progress;

        // If we reached max level, set progress to 100%
        if (user.battlePassSummary.current_level >= battlePass.max_level) {
            currentLevelProgress = {
                xp_required: 0,
                xp_earned: 0,
                xp_remaining: 0,
                progress_percentage: 100
            };
        }

        if (leveledUp) {
            // Find new rewards that are available at the new level
            for (let level = previousLevel + 1; level <= user.battlePassSummary.current_level; level++) {
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
                if (user.battlePassSummary.is_elite) {
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

        return {
            success: true,
            message: leveledUp ? `Level up! Reached level ${user.battlePassSummary.current_level}` : `Added ${xpAmount} XP to Battle Pass`,
            data: {
                user_id: userId,
                previous_level: previousLevel,
                current_level: user.battlePassSummary.current_level,
                levels_gained: leveledUp ? user.battlePassSummary.current_level - previousLevel : 0,
                xp_added: xpAmount,
                total_xp: user.battlePassSummary.current_xp,
                remaining_xp: user.battlePassSummary.current_xp,
                battle_pass: {
                    current_level: user.battlePassSummary.current_level,
                    xp_added: xpAmount,
                    leveled_up: leveledUp,
                    current_level_progress: currentLevelProgress
                }
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
        // Convert isElite parameter to boolean if it's a string
        isElite = isElite === true || isElite === "true" || isElite === 1 || isElite === "1";
        
        // Get current battle pass
        const currentBattlePassResult = await getCurrentBattlePass();
        if (!currentBattlePassResult.success) {
            return currentBattlePassResult; // Return the error
        }

        const battlePass = currentBattlePassResult.battle_pass;

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Check if user has battle pass data
        if (!user.battlePassSummary || !user.battlePassSummary.current_level) {
            return {
                success: false,
                message: 'User has not started this Battle Pass'
            };
        }

        // Try to claim the reward
        try {
            // Check if the reward has already been claimed
            const alreadyClaimed = user.battlePassSummary.claimed_rewards.some(
                reward => reward.level === level && reward.is_elite === isElite
            );
            
            if (alreadyClaimed) {
                return {
                    success: false,
                    message: `Reward for level ${level} (${isElite ? 'elite' : 'free'}) already claimed`
                };
            }
            
            // Check if the user has reached this level
            if (user.battlePassSummary.current_level < level) {
                return {
                    success: false,
                    message: `User has not reached level ${level} yet`
                };
            }
            
            // Check if user has elite pass if claiming elite reward
            if (isElite && !user.battlePassSummary.is_elite) {
                return {
                    success: false,
                    message: 'User does not have elite pass to claim this reward'
                };
            }
            
            // Find the reward
            const rewardList = isElite ? battlePass.elite_rewards : battlePass.free_rewards;
            const reward = rewardList.find(r => r.level === level);
            
            if (!reward) {
                return {
                    success: false,
                    message: `No ${isElite ? 'elite' : 'free'} reward found for level ${level}`
                };
            }
            
            // Store the previous XP for the response
            const previousXP = user.battlePassSummary.current_xp;
            
            // No longer deducting XP when claiming rewards
            
            // Add to claimed rewards
            if (!user.battlePassSummary.claimed_rewards) {
                user.battlePassSummary.claimed_rewards = [];
            }
            
            user.battlePassSummary.claimed_rewards.push({
                level,
                reward_type: reward.reward_type,
                is_free: !isElite,
                is_elite: isElite,
                claim_date: new Date()
            });
            
            // Update last collected level if this level is higher
            if (!user.battlePassSummary.last_collected_level || level > user.battlePassSummary.last_collected_level) {
                user.battlePassSummary.last_collected_level = level;
            }
            
            // Process the reward - add to user's account based on reward type
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
            user.markModified('battlePassSummary');
            if (reward.reward_type === 'card_pack') user.markModified('card_packs');
            if (reward.reward_type === 'creature') user.markModified('creature_inventory');
            if (reward.reward_type === 'decoration') user.markModified('decorations');
            
            await user.save();
            
            // Calculate battle pass progress details
            const progressDetails = calculateBattlePassProgress(user, battlePass);
            
            // Update the user's battlePassSummary with the new progress details
            user.battlePassSummary.completed_levels = progressDetails.completed_levels;
            user.battlePassSummary.current_level_progress = progressDetails.current_level_progress;
            user.battlePassSummary.uncollected_rewards = progressDetails.uncollected_rewards;
            
            user.markModified('battlePassSummary');
            await user.save();
            
            // Separate claimed rewards into free and elite categories
            const claimedRewards = user.battlePassSummary.claimed_rewards || [];
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
                        current_level_progress: progressDetails.current_level_progress,
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

        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Initialize battle pass summary if it doesn't exist
        if (!user.battlePassSummary) {
            user.battlePassSummary = {
                current_level: 1,
                current_xp: 0,
                is_elite: true,
                claimed_rewards: [],
                battle_pass_id: battlePass._id,
                battle_pass_name: battlePass.name,
                last_updated: new Date()
            };
        } else if (user.battlePassSummary.is_elite) {
            return {
                success: false,
                message: 'User already has Elite Battle Pass'
            };
        } else {
            user.battlePassSummary.is_elite = true;
        }

        // Update user's elite status
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
        user.markModified('battlePassSummary');
        await user.save();

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

module.exports = {
    getCurrentBattlePass,
    getUserBattlePassProgress,
    addUserBattlePassXP,
    claimBattlePassReward,
    upgradeToEliteBattlePass
}; 