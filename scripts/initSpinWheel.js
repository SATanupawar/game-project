const mongoose = require('mongoose');
require('dotenv').config();
const SpinWheelReward = require('../models/spinTheWheel');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.error('MongoDB connection error:', err));

// Reward configuration based on the provided table
const rewardConfigurations = [
    // Card Packs
    { min_value: 1, max_value: 20, reward_type: 'card_pack', reward_value: 'common_pack_01' },
    { min_value: 21, max_value: 30, reward_type: 'card_pack', reward_value: 'rare_pack_01' },
    { min_value: 31, max_value: 35, reward_type: 'card_pack', reward_value: 'epic_pack_01' },
    { min_value: 36, max_value: 40, reward_type: 'card_pack', reward_value: 'legendary_pack_01' },
    
    // Gold
    { min_value: 41, max_value: 45, reward_type: 'gold', reward_value: 8000 },
    { min_value: 46, max_value: 50, reward_type: 'gold', reward_value: 10000 },
    { min_value: 51, max_value: 55, reward_type: 'gold', reward_value: 12000 },
    
    // Arcane Energy
    { min_value: 56, max_value: 60, reward_type: 'arcane_energy', reward_value: 8000 },
    { min_value: 61, max_value: 65, reward_type: 'arcane_energy', reward_value: 10000 },
    { min_value: 66, max_value: 70, reward_type: 'arcane_energy', reward_value: 12000 },
    
    // Gems
    { min_value: 71, max_value: 75, reward_type: 'gems', reward_value: 20 },
    { min_value: 76, max_value: 80, reward_type: 'gems', reward_value: 50 },
    { min_value: 81, max_value: 85, reward_type: 'gems', reward_value: 100 },
    
    // Anima
    { min_value: 86, max_value: 90, reward_type: 'anima', reward_value: 50 },
    { min_value: 91, max_value: 95, reward_type: 'anima', reward_value: 100 },
    { min_value: 96, max_value: 100, reward_type: 'anima', reward_value: 200 }
];

async function initRewardConfigurations() {
    try {
        // Clear existing configurations
        await SpinWheelReward.deleteMany({});
        console.log('Cleared existing reward configurations');
        
        // Insert new configurations
        await SpinWheelReward.insertMany(rewardConfigurations);
        console.log('Successfully inserted reward configurations');
        
        // Log count to verify
        const count = await SpinWheelReward.countDocuments();
        console.log(`Total reward configurations: ${count}`);
        
        mongoose.disconnect();
        console.log('MongoDB disconnected');
    } catch (error) {
        console.error('Error initializing reward configurations:', error);
        mongoose.disconnect();
    }
}

// Run the initialization
initRewardConfigurations(); 