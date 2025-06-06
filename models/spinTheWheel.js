const mongoose = require('mongoose');

// Schema for reward configuration
const spinWheelRewardSchema = new mongoose.Schema({
    min_value: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    max_value: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    reward_type: {
        type: String,
        required: true,
        enum: ['card_pack', 'gold', 'arcane_energy', 'gems', 'anima']
    },
    reward_value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
});

// Static method to get a reward based on spin value
spinWheelRewardSchema.statics.getRewardBySpinValue = async function(spinValue) {
    try {
        const reward = await this.findOne({
            min_value: { $lte: spinValue },
            max_value: { $gte: spinValue },
            active: true
        });
        
        return reward;
    } catch (error) {
        console.error('Error getting reward by spin value:', error);
        return null;
    }
};

// Static method to generate a weighted random spin (favoring 40-100)
spinWheelRewardSchema.statics.generateWeightedSpin = function() {
    // Generate a random number between 0 and 1
    const rand = Math.random();
    
    // Apply weighting: 
    // - 30% chance to get 1-40
    // - 70% chance to get 41-100
    let spinValue;
    
    if (rand < 0.3) {
        // 30% chance for values 1-40
        spinValue = Math.floor(Math.random() * 40) + 1;
    } else {
        // 70% chance for values 41-100
        spinValue = Math.floor(Math.random() * 60) + 41;
    }
    
    return spinValue;
};

const SpinWheelReward = mongoose.model('SpinWheelReward', spinWheelRewardSchema);

module.exports = SpinWheelReward; 