const mongoose = require('mongoose');

// Define the schema for User Battle Pass
const userBattlePassSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    battle_pass_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BattlePass',
        required: true
    },
    current_xp: {
        type: Number,
        default: 0
    },
    current_level: {
        type: Number,
        default: 1
    },
    is_elite: {
        type: Boolean,
        default: false
    },
    last_collected_level: {
        type: Number,
        default: 0
    },
    claimed_rewards: [{
        level: Number,
        reward_type: String,
        is_free: Boolean,
        is_elite: Boolean,
        claim_date: {
            type: Date,
            default: Date.now
        }
    }],
    xp_history: [{
        amount: Number,
        source: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

// Compound index for faster lookups
userBattlePassSchema.index({ userId: 1, battle_pass_id: 1 }, { unique: true });

// Method to add XP and update level
userBattlePassSchema.methods.addXP = async function(amount, source) {
    // Add to XP history
    this.xp_history.push({
        amount,
        source,
        date: new Date()
    });
    
    // Update current XP
    this.current_xp += amount;
    
    // Update level
    await this.updateLevel();
    
    // Update timestamp
    this.updated_at = new Date();
    
    return this.save();
};

// Method to update level based on current XP
userBattlePassSchema.methods.updateLevel = async function() {
    // Get the battle pass details
    const BattlePass = mongoose.model('BattlePass');
    const battlePass = await BattlePass.findById(this.battle_pass_id);
    
    if (!battlePass) {
        throw new Error('Battle Pass not found');
    }
    
    let totalXpNeeded = 0;
    let newLevel = 1;
    
    // Calculate the level based on current XP
    for (let level = 1; level <= battlePass.max_level; level++) {
        // Find the XP requirement for this level
        const xpRequirement = battlePass.xp_requirements.find(
            req => level >= req.level_start && level <= req.level_end
        );
        
        if (!xpRequirement) continue;
        
        // Add the XP needed for this level
        const xpForThisLevel = xpRequirement.xp_required;
        
        // If current XP is less than needed for this level, we've found our level
        if (this.current_xp < totalXpNeeded + xpForThisLevel) {
            newLevel = level;
            break;
        }
        
        // Add the XP for this level to the running total
        totalXpNeeded += xpForThisLevel;
        
        // Update level since we've passed this level's XP requirement
        newLevel = level + 1;
        
        // If we've reached the max level, stop
        if (level === battlePass.max_level) {
            newLevel = battlePass.max_level;
            break;
        }
    }
    
    // Update the level
    this.current_level = newLevel;
};

// Method to claim a reward
userBattlePassSchema.methods.claimReward = async function(level, isElite) {
    // Check if the reward has already been claimed
    const alreadyClaimed = this.claimed_rewards.some(
        reward => reward.level === level && reward.is_elite === isElite
    );
    
    if (alreadyClaimed) {
        throw new Error(`Reward for level ${level} (${isElite ? 'elite' : 'free'}) already claimed`);
    }
    
    // Check if the user has reached this level
    if (this.current_level < level) {
        throw new Error(`User has not reached level ${level} yet`);
    }
    
    // Check if user has elite pass if claiming elite reward
    if (isElite && !this.is_elite) {
        throw new Error('User does not have elite pass to claim this reward');
    }
    
    // Get the battle pass
    const BattlePass = mongoose.model('BattlePass');
    const battlePass = await BattlePass.findById(this.battle_pass_id);
    
    if (!battlePass) {
        throw new Error('Battle Pass not found');
    }
    
    // Find the reward
    const rewardList = isElite ? battlePass.elite_rewards : battlePass.free_rewards;
    const reward = rewardList.find(r => r.level === level);
    
    if (!reward) {
        throw new Error(`No ${isElite ? 'elite' : 'free'} reward found for level ${level}`);
    }
    
    // Add to claimed rewards - No XP deduction occurs
    this.claimed_rewards.push({
        level,
        reward_type: reward.reward_type,
        is_free: !isElite,
        is_elite: isElite,
        claim_date: new Date()
    });
    
    // Update last collected level if this level is higher
    if (level > this.last_collected_level) {
        this.last_collected_level = level;
    }
    
    // Update timestamp
    this.updated_at = new Date();
    
    await this.save();
    
    // Return the reward details
    return reward;
};

// Pre-save hook to update the updated_at timestamp
userBattlePassSchema.pre('save', function(next) {
    this.updated_at = new Date();
    next();
});

const UserBattlePass = mongoose.model('UserBattlePass', userBattlePassSchema);

module.exports = UserBattlePass; 