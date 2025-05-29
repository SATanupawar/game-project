const mongoose = require('mongoose');
const User = require('../models/user');
const Quest = require('../models/quest');

async function assignEliteQuestsToAllUsers() {
    try {
        // Connect to the database
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected');
        
        // Find all users with active elite pass
        const users = await User.find({
            'elite_pass.active': true
        });
        
        console.log(`Found ${users.length} users with active elite pass`);
        
        if (users.length === 0) {
            console.log('No users with active elite pass found');
            await mongoose.disconnect();
            return;
        }
        
        // Get all active elite quests
        const eliteQuests = await Quest.find({ is_elite: true, active: true });
        if (!eliteQuests || eliteQuests.length === 0) {
            console.log('No active elite quests found');
            await mongoose.disconnect();
            return;
        }
        
        console.log(`Found ${eliteQuests.length} active elite quests`);
        
        // Calculate expiration time (weekly like regular weekly quests)
        const now = new Date();
        let expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + 7);
        expiresAt.setHours(23, 59, 59, 999);
        
        let assignedCount = 0;
        let errorCount = 0;
        
        // Process each user
        for (const user of users) {
            try {
                // Remove any existing elite quests
                user.active_quests = user.active_quests.filter(q => {
                    // Get quest details
                    const quest = eliteQuests.find(quest => quest.quest_id === q.quest_id);
                    return !quest || !quest.is_elite;
                });
                
                // Select 3 random elite quests
                const shuffled = [...eliteQuests].sort(() => 0.5 - Math.random());
                const selectedEliteQuests = shuffled.slice(0, 3);
                
                // Add new elite quests
                for (const quest of selectedEliteQuests) {
                    // Add quest to user's active quests
                    user.active_quests.push({
                        quest_id: quest.quest_id,
                        progress: 0,
                        completed: false,
                        rewarded: false,
                        expires_at: expiresAt
                    });
                }
                
                // Update or initialize elite quest stats
                if (!user.elite_quest_stats) {
                    user.elite_quest_stats = {
                        completed: 0,
                        last_refresh: now,
                        replacements: 0
                    };
                } else {
                    user.elite_quest_stats.last_refresh = now;
                    user.elite_quest_stats.replacements = 0; // Reset replacements counter
                }
                
                // Save user
                await user.save();
                assignedCount++;
                
                console.log(`Assigned ${selectedEliteQuests.length} elite quests to user ${user.userId}`);
            } catch (error) {
                console.error(`Error assigning elite quests to user ${user.userId}:`, error);
                errorCount++;
            }
        }
        
        console.log('\nElite quests assignment complete:');
        console.log(`- Successfully assigned to ${assignedCount} users`);
        console.log(`- Errors occurred for ${errorCount} users`);
        
        // Disconnect from database
        await mongoose.disconnect();
        console.log('MongoDB Disconnected');
    } catch (error) {
        console.error('Error assigning elite quests to users:', error);
        await mongoose.disconnect();
    }
}

// Run the script
assignEliteQuestsToAllUsers(); 