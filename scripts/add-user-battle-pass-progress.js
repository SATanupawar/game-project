const mongoose = require('mongoose');
const User = require('../models/user');
const BattlePass = require('../models/battlePass');
const UserBattlePass = require('../models/userBattlePass');

async function addUserBattlePassProgress() {
    try {
        // Connect to the database
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected');
        
        // Get command line arguments
        const args = process.argv.slice(2);
        const userId = args[0];
        const levelToSet = args[1] ? parseInt(args[1]) : null;
        const isElite = args[2] === 'elite';
        
        if (!userId) {
            console.log('Usage: node add-user-battle-pass-progress.js <userId> [levelToSet] [elite]');
            console.log('  userId: User ID to add progress for');
            console.log('  levelToSet: (Optional) Level to set the user to (if not provided, adds XP to current level)');
            console.log('  elite: (Optional) Add "elite" to enable elite pass');
            await mongoose.disconnect();
            return;
        }
        
        // Check if user exists
        const user = await User.findOne({ userId });
        if (!user) {
            console.error(`User ${userId} not found`);
            await mongoose.disconnect();
            return;
        }
        
        // Get current active battle pass
        const now = new Date();
        const battlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });
        
        if (!battlePass) {
            console.error('No active battle pass found');
            await mongoose.disconnect();
            return;
        }
        
        // Find or create user battle pass
        let userBattlePass = await UserBattlePass.findOne({
            userId,
            battle_pass_id: battlePass._id
        });
        
        if (!userBattlePass) {
            // Create new user battle pass
            userBattlePass = new UserBattlePass({
                userId,
                battle_pass_id: battlePass._id,
                current_xp: 0,
                current_level: 1,
                is_elite: isElite,
                claimed_rewards: [],
                xp_history: []
            });
            await userBattlePass.save();
            console.log(`Created new battle pass progress for user ${userId}`);
        }
        
        // Update elite status if requested
        if (isElite && !userBattlePass.is_elite) {
            userBattlePass.is_elite = true;
            await userBattlePass.save();
            console.log(`Updated user ${userId} to elite battle pass`);
            
            // Also update user's elite pass status
            if (!user.elite_pass) {
                user.elite_pass = {
                    active: true,
                    activated_at: now,
                    expires_at: battlePass.end_date
                };
            } else {
                user.elite_pass.active = true;
                user.elite_pass.activated_at = now;
                user.elite_pass.expires_at = battlePass.end_date;
            }
            
            user.markModified('elite_pass');
            await user.save();
        }
        
        // If level is specified, set the user to that level
        if (levelToSet) {
            if (levelToSet < 1 || levelToSet > battlePass.max_level) {
                console.error(`Invalid level: ${levelToSet}. Must be between 1 and ${battlePass.max_level}`);
                await mongoose.disconnect();
                return;
            }
            
            // Calculate XP needed to reach the specified level
            let totalXpNeeded = 0;
            for (let level = 1; level < levelToSet; level++) {
                const xpRequirement = battlePass.xp_requirements.find(
                    req => level >= req.level_start && level <= req.level_end
                );
                
                if (xpRequirement) {
                    totalXpNeeded += xpRequirement.xp_required;
                }
            }
            
            // Add a bit more XP to ensure we're at the right level
            totalXpNeeded += 10;
            
            // Update user battle pass
            userBattlePass.current_xp = totalXpNeeded;
            userBattlePass.current_level = levelToSet;
            
            // Add XP history entry
            userBattlePass.xp_history.push({
                amount: totalXpNeeded - userBattlePass.current_xp,
                source: 'admin_set_level',
                date: new Date()
            });
            
            await userBattlePass.save();
            console.log(`Set user ${userId} to level ${levelToSet} with ${totalXpNeeded} XP`);
        } else {
            // Add some XP to current level
            const xpToAdd = 100;
            
            // Add to XP history
            userBattlePass.xp_history.push({
                amount: xpToAdd,
                source: 'admin_add_xp',
                date: new Date()
            });
            
            // Update current XP
            userBattlePass.current_xp += xpToAdd;
            
            // Update level
            await userBattlePass.updateLevel();
            
            await userBattlePass.save();
            console.log(`Added ${xpToAdd} XP to user ${userId}`);
            console.log(`User is now level ${userBattlePass.current_level} with ${userBattlePass.current_xp} XP`);
        }
        
        // Display summary of current progress
        console.log('\nBattle Pass Progress Summary:');
        console.log('-----------------------------');
        console.log(`Battle Pass: ${battlePass.name}`);
        console.log(`User: ${userId}`);
        console.log(`Elite Status: ${userBattlePass.is_elite ? 'YES' : 'NO'}`);
        console.log(`Current Level: ${userBattlePass.current_level} / ${battlePass.max_level}`);
        console.log(`Current XP: ${userBattlePass.current_xp}`);
        console.log(`Claimed Rewards: ${userBattlePass.claimed_rewards.length}`);
        
        // Disconnect from the database
        await mongoose.disconnect();
        console.log('\nDisconnected from database');
    } catch (error) {
        console.error('Error adding battle pass progress:', error);
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from database:', disconnectError);
        }
        process.exit(1);
    }
}

// Run the function
addUserBattlePassProgress(); 