const mongoose = require('mongoose');

// Try to unregister the model if it exists
try {
    mongoose.deleteModel('UserLevel');
} catch (e) {
    // Model doesn't exist yet, which is fine
}

const userLevelSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true,
        unique: true,
        min: 1,
        max: 100 // Explicit max of 100
    },
    required_xp: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

// Create indexes for faster queries
userLevelSchema.index({ level: 1 });
userLevelSchema.index({ required_xp: 1 });

// Static method to get level by XP
userLevelSchema.statics.getLevelByXP = async function(xp) {
    const level = await this.findOne({ required_xp: { $lte: xp } })
        .sort({ level: -1 })
        .limit(1);
    return level ? level.level : 1;
};

// Static method to get XP needed for next level
userLevelSchema.statics.getXPForNextLevel = async function(currentLevel) {
    const nextLevel = await this.findOne({ level: currentLevel + 1 });
    return nextLevel ? nextLevel.required_xp : null;
};

// Static method to get XP progress to next level
userLevelSchema.statics.getXPProgress = async function(currentXP) {
    const currentLevel = await this.getLevelByXP(currentXP);
    const currentLevelData = await this.findOne({ level: currentLevel });
    const nextLevelData = await this.findOne({ level: currentLevel + 1 });

    if (!nextLevelData) {
        return {
            current_level: currentLevel,
            current_xp: currentXP,
            next_level_xp: null,
            xp_needed: 0,
            progress_percentage: 100
        };
    }

    const xpForCurrentLevel = currentLevelData.required_xp;
    const xpForNextLevel = nextLevelData.required_xp;
    const xpNeeded = xpForNextLevel - currentXP;
    const xpProgress = currentXP - xpForCurrentLevel;
    const xpTotal = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = Math.floor((xpProgress / xpTotal) * 100);

    return {
        current_level: currentLevel,
        current_xp: currentXP,
        next_level_xp: xpForNextLevel,
        xp_needed: xpNeeded,
        progress_percentage: progressPercentage
    };
};

// Create the model with an explicit collection name
const UserLevel = mongoose.model('UserLevel', userLevelSchema, 'userlevels');

module.exports = UserLevel; 