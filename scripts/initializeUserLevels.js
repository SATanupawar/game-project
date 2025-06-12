const mongoose = require('mongoose');
const UserLevel = require('../models/userLevel');
require('dotenv').config();

// Create user levels array with all 100 levels and unlockable creatures
const userLevels = [
    { level: 1, required_xp: 0, unlockable_creatures: ['azurescale_dragon'] },
    { level: 2, required_xp: 600, unlockable_creatures: [] },
    { level: 3, required_xp: 1000, unlockable_creatures: ['tulpar'] },
    { level: 4, required_xp: 1500, unlockable_creatures: [] },
    { level: 5, required_xp: 2000, unlockable_creatures: [] },
    { level: 6, required_xp: 2500, unlockable_creatures: ['savage_gargoyle'] },
    { level: 7, required_xp: 3000, unlockable_creatures: [] },
    { level: 8, required_xp: 3500, unlockable_creatures: [] },
    { level: 9, required_xp: 4000, unlockable_creatures: [] },
    { level: 10, required_xp: 4500, unlockable_creatures: ['stoneborn_behemoth'] },
    { level: 11, required_xp: 7000, unlockable_creatures: [] },
    { level: 12, required_xp: 7000, unlockable_creatures: ['ironscale_wyvern'] },
    { level: 13, required_xp: 7000, unlockable_creatures: [] },
    { level: 14, required_xp: 7000, unlockable_creatures: ['corrupted_oni'] },
    { level: 15, required_xp: 7000, unlockable_creatures: [] },
    { level: 16, required_xp: 7000, unlockable_creatures: [] },
    { level: 17, required_xp: 7000, unlockable_creatures: ['fire_dragon'] },
    { level: 18, required_xp: 7000, unlockable_creatures: [] },
    { level: 19, required_xp: 7000, unlockable_creatures: [] },
    { level: 20, required_xp: 7000, unlockable_creatures: ['ice_djinn'] },
    { level: 21, required_xp: 7000, unlockable_creatures: [] },
    { level: 22, required_xp: 7000, unlockable_creatures: [] },
    { level: 23, required_xp: 7000, unlockable_creatures: ['molten_manticore'] },
    { level: 24, required_xp: 7000, unlockable_creatures: [] },
    { level: 25, required_xp: 7000, unlockable_creatures: ['cave_drake'] },
    { level: 26, required_xp: 7000, unlockable_creatures: [] },
    { level: 27, required_xp: 7000, unlockable_creatures: [] },
    { level: 28, required_xp: 7000, unlockable_creatures: ['greyscale_dragon'] },
    { level: 29, required_xp: 7000, unlockable_creatures: [] },
    { level: 30, required_xp: 7000, unlockable_creatures: ['crystalline_behemoth'] },
    { level: 31, required_xp: 7000, unlockable_creatures: [] },
    { level: 32, required_xp: 7000, unlockable_creatures: ['unicorn'] },
    { level: 33, required_xp: 7000, unlockable_creatures: [] },
    { level: 34, required_xp: 7000, unlockable_creatures: [] },
    { level: 35, required_xp: 7000, unlockable_creatures: ['coral_wyvern', 'warp_drake'] },
    { level: 36, required_xp: 7000, unlockable_creatures: [] },
    { level: 37, required_xp: 7000, unlockable_creatures: ['storm_dragon'] },
    { level: 38, required_xp: 7000, unlockable_creatures: ['mystical_oni'] },
    { level: 39, required_xp: 7000, unlockable_creatures: [] },
    { level: 40, required_xp: 7000, unlockable_creatures: [] },
    { level: 41, required_xp: 7000, unlockable_creatures: ['sand_djinn'] },
    { level: 42, required_xp: 7000, unlockable_creatures: [] },
    { level: 43, required_xp: 7000, unlockable_creatures: [] },
    { level: 44, required_xp: 7000, unlockable_creatures: ['feral_manticore'] },
    { level: 45, required_xp: 7000, unlockable_creatures: [] },
    { level: 46, required_xp: 7000, unlockable_creatures: [] },
    { level: 47, required_xp: 7000, unlockable_creatures: ['blood_oni'] },
    { level: 48, required_xp: 7000, unlockable_creatures: [] },
    { level: 49, required_xp: 7000, unlockable_creatures: [] },
    { level: 50, required_xp: 7000, unlockable_creatures: ['vapor_drake'] },
    { level: 51, required_xp: 7000, unlockable_creatures: [] },
    { level: 52, required_xp: 7000, unlockable_creatures: [] },
    { level: 53, required_xp: 7000, unlockable_creatures: ['void_dragon'] },
    { level: 54, required_xp: 7000, unlockable_creatures: [] },
    { level: 55, required_xp: 7000, unlockable_creatures: ['kelpie'] },
    { level: 56, required_xp: 7000, unlockable_creatures: ['stone_gargoyle'] },
    { level: 57, required_xp: 7000, unlockable_creatures: ['starfire_behemoth'] },
    { level: 58, required_xp: 7000, unlockable_creatures: [] },
    { level: 59, required_xp: 7000, unlockable_creatures: ['luminous_manticore'] },
    { level: 60, required_xp: 7000, unlockable_creatures: ['gilded_dragon'] },
    { level: 61, required_xp: 7000, unlockable_creatures: [] },
    { level: 62, required_xp: 7000, unlockable_creatures: [] },
    { level: 63, required_xp: 7000, unlockable_creatures: ['necrotic_wyvern'] },
    { level: 64, required_xp: 7000, unlockable_creatures: [] },
    { level: 65, required_xp: 7000, unlockable_creatures: ['fungal_djinn'] },
    { level: 66, required_xp: 7000, unlockable_creatures: [] },
    { level: 67, required_xp: 7000, unlockable_creatures: ['regal_gargoyle'] },
    { level: 68, required_xp: 7000, unlockable_creatures: [] },
    { level: 69, required_xp: 7000, unlockable_creatures: [] },
    { level: 70, required_xp: 7000, unlockable_creatures: ['minotaur'] },
    { level: 71, required_xp: 7000, unlockable_creatures: [] },
    { level: 72, required_xp: 7000, unlockable_creatures: [] },
    { level: 73, required_xp: 7000, unlockable_creatures: ['ravager_oni'] },
    { level: 74, required_xp: 7000, unlockable_creatures: [] },
    { level: 75, required_xp: 7000, unlockable_creatures: [] },
    { level: 76, required_xp: 7000, unlockable_creatures: ['ancient_drake'] },
    { level: 77, required_xp: 7000, unlockable_creatures: [] },
    { level: 78, required_xp: 7000, unlockable_creatures: [] },
    { level: 79, required_xp: 7000, unlockable_creatures: ['netherfire_dragon'] },
    { level: 80, required_xp: 7000, unlockable_creatures: [] },
    { level: 81, required_xp: 7000, unlockable_creatures: [] },
    { level: 82, required_xp: 7000, unlockable_creatures: ['gilded_tulpar'] },
    { level: 83, required_xp: 7000, unlockable_creatures: [] },
    { level: 84, required_xp: 7000, unlockable_creatures: ['armoured_dragon'] },
    { level: 85, required_xp: 7000, unlockable_creatures: [] },
    { level: 86, required_xp: 7000, unlockable_creatures: [] },
    { level: 87, required_xp: 7000, unlockable_creatures: ['obsidian_behemoth'] },
    { level: 88, required_xp: 7000, unlockable_creatures: [] },
    { level: 89, required_xp: 7000, unlockable_creatures: [] },
    { level: 90, required_xp: 7000, unlockable_creatures: ['ash_djinn'] },
    { level: 91, required_xp: 7000, unlockable_creatures: ['abyssal_manticore'] },
    { level: 92, required_xp: 7000, unlockable_creatures: ['gale_wyvern'] },
    { level: 93, required_xp: 7000, unlockable_creatures: [] },
    { level: 94, required_xp: 7000, unlockable_creatures: [] },
    { level: 95, required_xp: 7000, unlockable_creatures: [] },
    { level: 96, required_xp: 7000, unlockable_creatures: [] },
    { level: 97, required_xp: 7000, unlockable_creatures: [] },
    { level: 98, required_xp: 7000, unlockable_creatures: [] },
    { level: 99, required_xp: 7000, unlockable_creatures: [] },
    { level: 100, required_xp: 7000, unlockable_creatures: [] }
];

async function initializeUserLevels() {
    try {
        // Connect to MongoDB using direct connection string
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Clear existing data
        await UserLevel.deleteMany({});
        console.log('Cleared existing user levels');

        // Insert all levels
        await UserLevel.insertMany(userLevels);
        console.log('Successfully initialized user levels');

        // Verify the insertion
        const insertedCount = await UserLevel.countDocuments();
        console.log(`Inserted ${insertedCount} user levels`);

    } catch (error) {
        console.error('Error initializing user levels:', error);
    } finally {
        // Close the database connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the initialization
initializeUserLevels(); 