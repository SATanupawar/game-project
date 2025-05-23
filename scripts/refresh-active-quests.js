const mongoose = require('mongoose');
require('dotenv').config();

// Import ActiveQuests model and Quest model
const ActiveQuests = require('../models/activeQuests');
const Quest = require('../models/quest');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
});

/**
 * Select random quests of specified type
 * @param {string} type - Quest type (daily, weekly, monthly)
 * @param {number} count - Number of quests to select
 * @returns {Promise<Array>} - Array of selected quest IDs
 */
async function selectRandomQuests(type, count) {
    try {
        // Get all active quests of the specified type
        const quests = await Quest.find({ type, active: true });
        
        if (!quests || quests.length === 0) {
            throw new Error(`No active ${type} quests found`);
        }
        
        // If we have fewer quests than requested, return all of them
        if (quests.length <= count) {
            return quests.map(q => q.quest_id);
        }
        
        // Shuffle and select random quests
        const shuffled = [...quests].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, count);
        
        return selected.map(q => q.quest_id);
    } catch (error) {
        console.error(`Error selecting random ${type} quests:`, error);
        throw error;
    }
}

/**
 * Check and refresh active quests if needed
 */
async function checkAndRefreshActiveQuests() {
    try {
        console.log('Checking if active quests need refreshing...');
        
        const now = new Date();
        const types = [
            { type: 'daily', count: 5, days: 1 },
            { type: 'weekly', count: 2, days: 7 },
            { type: 'monthly', count: 1, days: 30 }
        ];
        
        for (const { type, count, days } of types) {
            // Find active quests of this type
            const activeQuests = await ActiveQuests.findOne({ type });
            
            // Skip if not found (initialize them first)
            if (!activeQuests) {
                console.log(`Warning: No active ${type} quests found. Run initialize-active-quests.js first.`);
                continue;
            }
            
            // Check if refresh is needed
            if (now >= activeQuests.next_refresh) {
                console.log(`Refreshing ${type} quests...`);
                
                // Get new random quests
                const questIds = await selectRandomQuests(type, count);
                
                // Calculate next refresh date
                let nextRefresh = new Date(now);
                nextRefresh.setDate(nextRefresh.getDate() + days);
                nextRefresh.setHours(0, 0, 0, 0);
                
                // Update active quests
                activeQuests.active_quest_ids = questIds;
                activeQuests.last_refreshed = now;
                activeQuests.next_refresh = nextRefresh;
                await activeQuests.save();
                
                console.log(`Refreshed ${type} quests with: ${questIds.join(', ')}`);
                console.log(`Next refresh scheduled for: ${nextRefresh}`);
            } else {
                console.log(`${type} quests do not need refreshing yet.`);
                console.log(`Next refresh scheduled for: ${activeQuests.next_refresh}`);
            }
        }
        
        console.log('Refresh check completed.');
        
        // Close database connection
        mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error checking and refreshing active quests:', error);
        process.exit(1);
    }
}

// Run the refresh check function
checkAndRefreshActiveQuests(); 