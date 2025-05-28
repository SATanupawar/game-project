const mongoose = require('mongoose');
const BattlePass = require('../models/battlePass');

async function initializeBattlePass() {
    try {
        // Connect to the database
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected');
        
        // Calculate start and end dates (current month)
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
        endDate.setHours(23, 59, 59, 999); // Set to end of day
        
        // Check if there's already an active battle pass
        const existingBattlePass = await BattlePass.findOne({
            active: true,
            start_date: { $lte: now },
            end_date: { $gte: now }
        });
        
        if (existingBattlePass) {
            console.log('An active battle pass already exists for this period:', existingBattlePass.name);
            await mongoose.disconnect();
            return;
        }
        
        // Create the "New Beginnings" battle pass
        const battlePass = new BattlePass({
            name: 'New Beginnings',
            description: 'The first season of your adventure begins!',
            start_date: startDate,
            end_date: endDate,
            active: true,
            max_level: 51,
            xp_requirements: [
                { level_start: 1, level_end: 5, xp_required: 100 },
                { level_start: 6, level_end: 10, xp_required: 500 },
                { level_start: 11, level_end: 15, xp_required: 500 },
                { level_start: 16, level_end: 20, xp_required: 700 },
                { level_start: 21, level_end: 25, xp_required: 800 },
                { level_start: 26, level_end: 30, xp_required: 1000 },
                { level_start: 31, level_end: 35, xp_required: 1000 },
                { level_start: 36, level_end: 40, xp_required: 1500 },
                { level_start: 41, level_end: 45, xp_required: 2000 },
                { level_start: 46, level_end: 51, xp_required: 2000 }
            ],
            free_rewards: [
                { level: 1, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 2, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 3, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 4, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 5, reward_type: 'card_pack', pack_id: 'common_pack', description: 'Common Card Pack' },
                { level: 6, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 7, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 8, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 9, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 10, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 11, reward_type: 'card_pack', pack_id: 'magical_pack', description: 'Magical Card Pack' },
                { level: 12, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 13, reward_type: 'card_pack', pack_id: 'rare_pack', description: 'Rare Card Pack' },
                { level: 14, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 15, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 16, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 17, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 18, reward_type: 'card_pack', pack_id: 'common_pack', description: 'Common Card Pack' },
                { level: 19, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 20, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 21, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 22, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 23, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 24, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 25, reward_type: 'card_pack', pack_id: 'magical_pack', description: 'Magical Card Pack' },
                { level: 26, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 27, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 28, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 29, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 30, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 31, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 32, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 33, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 34, reward_type: 'card_pack', pack_id: 'magical_pack', description: 'Magical Card Pack' },
                { level: 35, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 36, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 37, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 38, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 39, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 40, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 41, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 42, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 43, reward_type: 'card_pack', pack_id: 'common_pack', description: 'Common Card Pack' },
                { level: 44, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 45, reward_type: 'card_pack', pack_id: 'magical_pack', description: 'Magical Card Pack' },
                { level: 46, reward_type: 'arcane_energy', amount: 5000, description: 'Arcane Energy' },
                { level: 47, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 48, reward_type: 'anima', amount: 90, description: 'Anima' },
                { level: 49, reward_type: 'gold', amount: 25000, description: 'Gold Coins' },
                { level: 50, reward_type: 'gems', amount: 15, description: 'Gems' },
                { level: 51, reward_type: 'card_pack', pack_id: 'epic_pack', description: 'Epic Card Pack' }
            ],
            elite_rewards: [
                { level: 1, reward_type: 'creature', creature_id: 'darkfire_dragon', description: 'Darkfire Dragon' },
                { level: 2, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 3, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 4, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 5, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 6, reward_type: 'card_pack', pack_id: 'rare_pack', description: 'Rare Card Pack' },
                { level: 7, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 8, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 9, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 10, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 11, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 12, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 13, reward_type: 'card_pack', pack_id: 'common_pack', description: 'Common Card Pack' },
                { level: 14, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 15, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 16, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 17, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 18, reward_type: 'card_pack', pack_id: 'rare_pack', description: 'Rare Card Pack' },
                { level: 19, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 20, reward_type: 'creature', creature_id: 'voidflame_dragon', description: 'Voidflame Dragon' },
                { level: 21, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 22, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 23, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 24, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 25, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 26, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 27, reward_type: 'card_pack', pack_id: 'epic_pack', description: 'Epic Card Pack' },
                { level: 28, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 29, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 30, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 31, reward_type: 'card_pack', pack_id: 'magical_pack', description: 'Magical Card Pack' },
                { level: 32, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 33, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 34, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 35, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 36, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 37, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 38, reward_type: 'decoration', decoration_id: 'golden_tree', description: 'Golden Tree' },
                { level: 39, reward_type: 'card_pack', pack_id: 'rare_pack', description: 'Rare Card Pack' },
                { level: 40, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 41, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 42, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 43, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 44, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 45, reward_type: 'gold', amount: 125000, description: 'Gold Coins' },
                { level: 46, reward_type: 'anima', amount: 450, description: 'Anima' },
                { level: 47, reward_type: 'card_pack', pack_id: 'magical_pack', description: 'Magical Card Pack' },
                { level: 48, reward_type: 'arcane_energy', amount: 25000, description: 'Arcane Energy' },
                { level: 49, reward_type: 'creature', creature_id: 'darkfire_dragon', description: 'Darkfire Dragon' },
                { level: 50, reward_type: 'gems', amount: 75, description: 'Gems' },
                { level: 51, reward_type: 'card_pack', pack_id: 'legendary_pack', description: 'Legendary Card Pack' }
            ]
        });
        
        await battlePass.save();
        console.log('Successfully created "New Beginnings" battle pass');
        
        // Disconnect from the database
        await mongoose.disconnect();
        console.log('Disconnected from database');
    } catch (error) {
        console.error('Error initializing battle pass:', error);
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from database:', disconnectError);
        }
        process.exit(1);
    }
}

// Run the initialization function
initializeBattlePass(); 