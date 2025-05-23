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
 * Initialize active quests in the database
 */
async function initializeActiveQuests() {
    try {
        console.log('Starting active quests initialization...');
        
        // Check if active quests already exist
        const existingDaily = await ActiveQuests.findOne({ type: 'daily' });
        const existingWeekly = await ActiveQuests.findOne({ type: 'weekly' });
        const existingMonthly = await ActiveQuests.findOne({ type: 'monthly' });
        
        // Set next refresh dates
        const now = new Date();
        
        // Daily: next day at midnight
        const dailyNextRefresh = new Date(now);
        dailyNextRefresh.setDate(dailyNextRefresh.getDate() + 1);
        dailyNextRefresh.setHours(0, 0, 0, 0);
        
        // Weekly: 7 days from now
        const weeklyNextRefresh = new Date(now);
        weeklyNextRefresh.setDate(weeklyNextRefresh.getDate() + 7);
        weeklyNextRefresh.setHours(0, 0, 0, 0);
        
        // Monthly: 30 days from now
        const monthlyNextRefresh = new Date(now);
        monthlyNextRefresh.setDate(monthlyNextRefresh.getDate() + 30);
        monthlyNextRefresh.setHours(0, 0, 0, 0);
        
        // Initialize daily quests if not exist
        if (!existingDaily) {
            const dailyQuestIds = await selectRandomQuests('daily', 5);
            const dailyQuests = new ActiveQuests({
                type: 'daily',
                active_quest_ids: dailyQuestIds,
                last_refreshed: now,
                next_refresh: dailyNextRefresh
            });
            await dailyQuests.save();
            console.log(`Initialized 5 daily quests: ${dailyQuestIds.join(', ')}`);
        } else {
            console.log('Daily quests already initialized');
        }
        
        // Initialize weekly quests if not exist
        if (!existingWeekly) {
            const weeklyQuestIds = await selectRandomQuests('weekly', 2);
            const weeklyQuests = new ActiveQuests({
                type: 'weekly',
                active_quest_ids: weeklyQuestIds,
                last_refreshed: now,
                next_refresh: weeklyNextRefresh
            });
            await weeklyQuests.save();
            console.log(`Initialized 2 weekly quests: ${weeklyQuestIds.join(', ')}`);
        } else {
            console.log('Weekly quests already initialized');
        }
        
        // Initialize monthly quests if not exist
        if (!existingMonthly) {
            const monthlyQuestIds = await selectRandomQuests('monthly', 1);
            const monthlyQuests = new ActiveQuests({
                type: 'monthly',
                active_quest_ids: monthlyQuestIds,
                last_refreshed: now,
                next_refresh: monthlyNextRefresh
            });
            await monthlyQuests.save();
            console.log(`Initialized 1 monthly quest: ${monthlyQuestIds.join(', ')}`);
        } else {
            console.log('Monthly quests already initialized');
        }
        
        console.log('Active quests initialization completed');
        
        // Close database connection
        mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error initializing active quests:', error);
        process.exit(1);
    }
}

// Run the initialization function
initializeActiveQuests(); 