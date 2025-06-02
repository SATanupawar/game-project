const mongoose = require('mongoose');
const User = require('../models/user');
const UserBattlePass = require('../models/userBattlePass');
const BattlePass = require('../models/battlePass');
require('dotenv').config();

async function fixBattlePassClaimedRewards() {
    try {
        // Get MongoDB URI from environment or use default connection string
        const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/game-project';
        
        if (!MONGO_URI) {
            throw new Error('MongoDB URI is not defined in environment variables');
        }
        
        // Connect to database
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        
        // Find all users with battlePassSummary
        const users = await User.find({
            'battlePassSummary': { $exists: true }
        });
        
        console.log(`Found ${users.length} users with battlePassSummary`);
        
        let updatedCount = 0;
        
        // Fix each user
        for (const user of users) {
            if (!user.battlePassSummary) continue;
            
            // Check if claimed_rewards exists as an array of objects
            if (Array.isArray(user.battlePassSummary.claimed_rewards)) {
                // Get the current array
                const claimedRewards = user.battlePassSummary.claimed_rewards || [];
                
                // Categorize the rewards
                const claimedFreeRewards = claimedRewards.filter(reward => !reward.is_elite);
                const claimedEliteRewards = claimedRewards.filter(reward => reward.is_elite);
                
                // Keep the original array format to maintain backward compatibility
                user.markModified('battlePassSummary');
                await user.save();
                
                updatedCount++;
                console.log(`Updated user ${user.userId}`);
            }
            
            // If using UserBattlePass model, update that too
            const now = new Date();
            const currentBattlePass = await BattlePass.findOne({
                start_date: { $lte: now },
                end_date: { $gte: now },
                active: true
            });
            
            if (currentBattlePass) {
                const userBattlePass = await UserBattlePass.findOne({
                    userId: user.userId,
                    battle_pass_id: currentBattlePass._id
                });
                
                if (userBattlePass && Array.isArray(userBattlePass.claimed_rewards)) {
                    await userBattlePass.save();
                }
            }
        }
        
        console.log(`Updated ${updatedCount} users successfully`);
        console.log('Fix complete. Disconnecting from MongoDB...');
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        
    } catch (error) {
        console.error('Error fixing battle pass claimed rewards:', error);
        process.exit(1);
    }
}

// Run the function
fixBattlePassClaimedRewards()
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    }); 