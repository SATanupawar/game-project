const mongoose = require('mongoose');
const BattlePass = require('../models/battlePass');
const User = require('../models/user');

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
            // Initialize battle pass data
            user.battlePassSummary = {
                current_level: 0,
                current_xp: 0,
                is_elite: user.elite_pass && user.elite_pass.active,
                claimed_rewards: [],
                battle_pass_id: battlePass._id,
                battle_pass_name: battlePass.name,
                last_updated: new Date()
            };
            
            await user.save();
            
            return {
                success: true,
                message: 'User has not started this Battle Pass',
                data: {
                    battle_pass_name: battlePass.name,
                    battle_pass_end_date: battlePass.end_date,
                    has_started: false,
                    is_elite: user.elite_pass && user.elite_pass.active,
                    current_level: 0,
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

        return {
            success: true,
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
                    current_xp: user.battlePassSummary.current_xp,
                    current_level: user.battlePassSummary.current_level,
                    is_elite: user.battlePassSummary.is_elite,
                    xp_to_next_level: xpToNextLevel,
                    total_xp_for_current_level: totalXpForCurrentLevel,
                    claimed_rewards: user.battlePassSummary.claimed_rewards,
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
        
        user.markModified('battlePassSummary');
        await user.save();

        // Check if user leveled up
        const leveledUp = user.battlePassSummary.current_level > previousLevel;
        const newRewards = [];

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
            message: `Added ${xpAmount} XP to Battle Pass`,
            data: {
                previous_level: previousLevel,
                current_level: user.battlePassSummary.current_level,
                current_xp: user.battlePassSummary.current_xp,
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
            
            // Calculate XP to deduct based on level
            let xpToDeduct = 0;
            let totalXpForPreviousLevels = 0;
            
            // Calculate XP for all levels up to the claimed reward level
            for (let l = 1; l <= level; l++) {
                const xpRequirement = battlePass.xp_requirements.find(
                    req => l >= req.level_start && l <= req.level_end
                );
                
                if (xpRequirement) {
                    if (l < level) {
                        totalXpForPreviousLevels += xpRequirement.xp_required;
                    } else {
                        // For the claimed level, deduct the full level's XP requirement
                        xpToDeduct = xpRequirement.xp_required;
                    }
                }
            }
            
            // Deduct XP, but ensure we don't go below the minimum XP needed for current level
            const minXpForCurrentLevel = totalXpForPreviousLevels;
            const newXP = Math.max(minXpForCurrentLevel, user.battlePassSummary.current_xp - xpToDeduct);
            
            // Store the previous XP for the response
            const previousXP = user.battlePassSummary.current_xp;
            
            // Update current XP
            user.battlePassSummary.current_xp = newXP;
            
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
                    // Add card pack to user's inventory (this would depend on your existing system)
                    if (!user.card_packs) user.card_packs = [];
                    user.card_packs.push({
                        pack_id: reward.pack_id,
                        obtained_at: new Date(),
                        source: 'battle_pass'
                    });
                    rewardDetails = { pack_id: reward.pack_id };
                    break;
                    
                case 'creature':
                    // Add creature to user's inventory
                    if (!user.creature_inventory) user.creature_inventory = [];
                    
                    // Check if creature already exists in inventory
                    const existingCreature = user.creature_inventory.find(c => 
                        c.creature_id && c.creature_id.toString() === reward.creature_id
                    );
                    
                    if (existingCreature) {
                        existingCreature.count += 1;
                    } else {
                        user.creature_inventory.push({
                            creature_id: mongoose.Types.ObjectId(reward.creature_id),
                            name: reward.description || 'Battle Pass Creature',
                            count: 1,
                            obtained_at: new Date(),
                            source: 'battle_pass'
                        });
                    }
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
            
            return {
                success: true,
                message: `Successfully claimed ${isElite ? 'elite' : 'free'} reward for level ${level}`,
                data: {
                    reward_type: reward.reward_type,
                    level,
                    is_elite: isElite,
                    details: rewardDetails,
                    updated_xp: {
                        previous_xp: previousXP,
                        current_xp: user.battlePassSummary.current_xp,
                        xp_deducted: xpToDeduct
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