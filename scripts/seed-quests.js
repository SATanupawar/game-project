const mongoose = require('mongoose');
require('dotenv').config();

// Import the Quest model
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

// Seed data for daily quests
const dailyQuests = [
    {
        quest_id: 'daily-card-pack-1',
        title: 'Daily Card Pack',
        description: 'Open 1 card pack',
        type: 'daily',
        category: 'card',
        action: 'open_card_pack',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24, // 24 hours
    },
    {
        quest_id: 'daily-gold-collect',
        title: 'Gold Collector',
        description: 'Collect 3,000 gold',
        type: 'daily',
        category: 'currency',
        action: 'collect_gold',
        required_amount: 3000,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-arcane-energy',
        title: 'Arcane Harvester',
        description: 'Harvest 4,000 arcane energy',
        type: 'daily',
        category: 'currency',
        action: 'harvest_arcane_energy',
        required_amount: 4000,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-place-building',
        title: 'Construct',
        description: 'Place 1 building',
        type: 'daily',
        category: 'building',
        action: 'place_building',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-place-decoration',
        title: 'Decorator',
        description: 'Place 1 decoration',
        type: 'daily',
        category: 'decoration',
        action: 'place_decoration',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-summon-creature',
        title: 'Summoner',
        description: 'Summon 1 creature',
        type: 'daily',
        category: 'creature',
        action: 'summon_creature',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-feed-creature',
        title: 'Caretaker',
        description: 'Feed 1 creature',
        type: 'daily',
        category: 'creature',
        action: 'feed_creature',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-play-battle',
        title: 'Battler',
        description: 'Play 1 multiplayer battle',
        type: 'daily',
        category: 'battle',
        action: 'play_battle',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-use-boost',
        title: 'Boost User',
        description: 'Use a boost once',
        type: 'daily',
        category: 'boost',
        action: 'use_boost',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-knockouts',
        title: 'Knockout Champion',
        description: 'Get 3 knockouts in multiplayer',
        type: 'daily',
        category: 'battle',
        action: 'get_knockouts',
        required_amount: 3,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-spend-gold',
        title: 'Big Spender',
        description: 'Spend 1,000 gold',
        type: 'daily',
        category: 'currency',
        action: 'spend_gold',
        required_amount: 1000,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    },
    {
        quest_id: 'daily-open-chest',
        title: 'Treasure Hunter',
        description: 'Open 1 chest',
        type: 'daily',
        category: 'chest',
        action: 'open_chest',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 100,
        duration: 24,
    }
];

// Weekly quests
const weeklyQuests = [
    {
        quest_id: 'weekly-battles-complete',
        title: 'Battle Master',
        description: 'Complete 10 multiplayer battles',
        type: 'weekly',
        category: 'battle',
        action: 'play_battle',
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168, // 7 days in hours
    },
    {
        quest_id: 'weekly-battles-win',
        title: 'Victory Seeker',
        description: 'Win 5 multiplayer battles',
        type: 'weekly',
        category: 'battle',
        action: 'win_battle',
        required_amount: 5,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-spend-gold',
        title: 'Gold Splurger',
        description: 'Spend 10,000 gold',
        type: 'weekly',
        category: 'currency',
        action: 'spend_gold',
        required_amount: 10000,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-summon-creatures',
        title: 'Master Summoner',
        description: 'Summon 3 creatures',
        type: 'weekly',
        category: 'creature',
        action: 'summon_creature',
        required_amount: 3,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-feed-creatures',
        title: 'Dedicated Caretaker',
        description: 'Feed 5 creatures',
        type: 'weekly',
        category: 'creature',
        action: 'feed_creature',
        required_amount: 5,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-collect-gold',
        title: 'Rich Collector',
        description: 'Collect 30,000 gold',
        type: 'weekly',
        category: 'currency',
        action: 'collect_gold',
        required_amount: 30000,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-harvest-arcane',
        title: 'Arcane Master',
        description: 'Harvest 40,000 arcane energy',
        type: 'weekly',
        category: 'currency',
        action: 'harvest_arcane_energy',
        required_amount: 40000,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-place-buildings',
        title: 'City Builder',
        description: 'Place 3 buildings',
        type: 'weekly',
        category: 'building',
        action: 'place_building',
        required_amount: 3,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-place-decorations',
        title: 'Master Decorator',
        description: 'Place 5 decorations',
        type: 'weekly',
        category: 'decoration',
        action: 'place_decoration',
        required_amount: 5,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-open-card-packs',
        title: 'Card Collector',
        description: 'Open 10 card packs',
        type: 'weekly',
        category: 'card',
        action: 'open_card_pack',
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-knockouts',
        title: 'Knockout King',
        description: 'Get 20 knockouts in multiplayer battles',
        type: 'weekly',
        category: 'battle',
        action: 'get_knockouts',
        required_amount: 20,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    },
    {
        quest_id: 'weekly-open-chests',
        title: 'Master Treasure Hunter',
        description: 'Open 3 chests',
        type: 'weekly',
        category: 'chest',
        action: 'open_chest',
        required_amount: 3,
        reward_type: 'xp',
        reward_amount: 500,
        duration: 168,
    }
];

// Monthly quests
const monthlyQuests = [
    {
        quest_id: 'monthly-win-battles',
        title: 'Battle Champion',
        description: 'Win 30 multiplayer battles',
        type: 'monthly',
        category: 'battle',
        action: 'win_battle',
        required_amount: 30,
        reward_type: 'xp',
        reward_amount: 1000,
        duration: 720, // 30 days in hours
    },
    {
        quest_id: 'monthly-summon-creatures',
        title: 'Creature Lord',
        description: 'Summon 30 creatures',
        type: 'monthly',
        category: 'creature',
        action: 'summon_creature',
        required_amount: 30,
        reward_type: 'xp',
        reward_amount: 1000,
        duration: 720,
    },
    {
        quest_id: 'monthly-open-card-packs',
        title: 'Card Pack Master',
        description: 'Open 40 card packs',
        type: 'monthly',
        category: 'card',
        action: 'open_card_pack',
        required_amount: 40,
        reward_type: 'xp',
        reward_amount: 1000,
        duration: 720,
    },
    {
        quest_id: 'monthly-open-chests',
        title: 'Chest Master',
        description: 'Open 40 chests',
        type: 'monthly',
        category: 'chest',
        action: 'open_chest',
        required_amount: 40,
        reward_type: 'xp',
        reward_amount: 1000,
        duration: 720,
    },
    {
        quest_id: 'monthly-complete-battles',
        title: 'Grand Battle Master',
        description: 'Complete 50 battles',
        type: 'monthly',
        category: 'battle',
        action: 'play_battle',
        required_amount: 50,
        reward_type: 'xp',
        reward_amount: 1000,
        duration: 720,
    }
];

// Elite quests - available only for users with Elite Pass
const eliteQuests = [
    {
        quest_id: 'elite-feed-creatures',
        title: 'Elite Caretaker',
        description: 'Feed 10 Creatures',
        type: 'weekly',
        category: 'creature',
        action: 'feed_creature',
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168, // 7 days in hours
        is_elite: true
    },
    {
        quest_id: 'elite-battles',
        title: 'Elite Battler',
        description: 'Participate in 10 multiplayer battles',
        type: 'weekly',
        category: 'battle',
        action: 'play_battle', 
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-card-packs',
        title: 'Elite Card Collector',
        description: 'Open 10 card packs',
        type: 'weekly',
        category: 'card',
        action: 'open_card_pack',
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-knockouts',
        title: 'Elite Knockout Master',
        description: 'Get 10 knockouts in multiplayer battles',
        type: 'weekly',
        category: 'battle',
        action: 'get_knockouts',
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-chests',
        title: 'Elite Treasure Hunter',
        description: 'Open 10 chests',
        type: 'weekly',
        category: 'chest',
        action: 'open_chest',
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-gold',
        title: 'Elite Gold Collector',
        description: 'Collect 10,000 gold',
        type: 'weekly',
        category: 'currency',
        action: 'collect_gold',
        required_amount: 10000,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-arcane-energy',
        title: 'Elite Arcane Harvester',
        description: 'Harvest 10,000 arcane energy',
        type: 'weekly',
        category: 'currency',
        action: 'harvest_arcane_energy',
        required_amount: 10000,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-decorations',
        title: 'Elite Decorator',
        description: 'Have 10 decorations on the map',
        type: 'weekly',
        category: 'decoration', 
        action: 'place_decoration',
        required_amount: 10,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-summon',
        title: 'Elite Summoner',
        description: 'Summon 5 creatures',
        type: 'weekly',
        category: 'creature',
        action: 'summon_creature',
        required_amount: 5,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    },
    {
        quest_id: 'elite-evolve',
        title: 'Elite Evolution Master',
        description: 'Evolve 1 creature',
        type: 'weekly',
        category: 'creature',
        action: 'evolve_creature',
        required_amount: 1,
        reward_type: 'xp',
        reward_amount: 750,
        duration: 168,
        is_elite: true
    }
];

// Combine all quests
const allQuests = [...dailyQuests, ...weeklyQuests, ...monthlyQuests, ...eliteQuests];

// Function to seed the database
async function seedQuests() {
    try {
        // Clear existing quests
        await Quest.deleteMany({});
        console.log('Cleared existing quests');

        // Insert all quests
        await Quest.insertMany(allQuests);
        
        console.log(`Successfully seeded ${allQuests.length} quests:`);
        console.log(`- ${dailyQuests.length} daily quests`);
        console.log(`- ${weeklyQuests.length} weekly quests`);
        console.log(`- ${monthlyQuests.length} monthly quests`);
        console.log(`- ${eliteQuests.length} elite quests`);
        
        mongoose.connection.close();
        console.log('Database connection closed');
    } catch (error) {
        console.error('Error seeding quests:', error);
        process.exit(1);
    }
}

// Run the seed function
seedQuests(); 