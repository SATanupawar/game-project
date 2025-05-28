const mongoose = require('mongoose');
const User = require('../../models/user');
const UserBattlePass = require('../../models/userBattlePass');
const BattlePass = require('../../models/battlePass');

async function migrateBattlePassData() {
    try {
        // Connect to the database
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected');
        
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
        
        console.log(`Found active battle pass: ${battlePass.name}`);
        
        // Get all UserBattlePass records
        const userBattlePasses = await UserBattlePass.find({
            battle_pass_id: battlePass._id
        });
        
        console.log(`Found ${userBattlePasses.length} user battle pass records to migrate`);
        
        // Process each user battle pass
        let successCount = 0;
        let errorCount = 0;
        
        for (const userBP of userBattlePasses) {
            try {
                // Find the user
                const user = await User.findOne({ userId: userBP.userId });
                
                if (!user) {
                    console.error(`User ${userBP.userId} not found, skipping`);
                    errorCount++;
                    continue;
                }
                
                // Update user's battle pass summary
                user.battlePassSummary = {
                    current_level: userBP.current_level,
                    current_xp: userBP.current_xp,
                    is_elite: userBP.is_elite,
                    claimed_rewards: userBP.claimed_rewards || [],
                    battle_pass_id: battlePass._id,
                    battle_pass_name: battlePass.name,
                    last_updated: new Date()
                };
                
                user.markModified('battlePassSummary');
                await user.save();
                
                console.log(`Updated battle pass data for user ${userBP.userId}`);
                successCount++;
            } catch (userError) {
                console.error(`Error updating user ${userBP.userId}:`, userError);
                errorCount++;
            }
        }
        
        console.log('\nMigration Complete:');
        console.log(`- Successfully migrated: ${successCount}`);
        console.log(`- Errors: ${errorCount}`);
        console.log(`- Total processed: ${userBattlePasses.length}`);
        
        // Disconnect from the database
        await mongoose.disconnect();
        console.log('Disconnected from database');
    } catch (error) {
        console.error('Error during migration:', error);
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from database:', disconnectError);
        }
        process.exit(1);
    }
}

// Run the migration
migrateBattlePassData(); 