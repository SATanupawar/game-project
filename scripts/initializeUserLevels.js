const mongoose = require('mongoose');
const UserLevel = require('../models/userLevel');
require('dotenv').config();

// Create user levels array with all 100 levels hardcoded
const userLevels = [
    { level: 1, required_xp: 0 },
    { level: 2, required_xp: 600 },
    { level: 3, required_xp: 1000 },
    { level: 4, required_xp: 1500 },
    { level: 5, required_xp: 2000 },
    { level: 6, required_xp: 2500 },
    { level: 7, required_xp: 3000 },
    { level: 8, required_xp: 3500 },
    { level: 9, required_xp: 4000 },
    { level: 10, required_xp: 4500 },
    { level: 11, required_xp: 7000 },
    { level: 12, required_xp: 7000 },
    { level: 13, required_xp: 7000 },
    { level: 14, required_xp: 7000 },
    { level: 15, required_xp: 7000 },
    { level: 16, required_xp: 7000 },
    { level: 17, required_xp: 7000 },
    { level: 18, required_xp: 7000 },
    { level: 19, required_xp: 7000 },
    { level: 20, required_xp: 7000 },
    { level: 21, required_xp: 7000 },
    { level: 22, required_xp: 7000 },
    { level: 23, required_xp: 7000 },
    { level: 24, required_xp: 7000 },
    { level: 25, required_xp: 7000 },
    { level: 26, required_xp: 7000 },
    { level: 27, required_xp: 7000 },
    { level: 28, required_xp: 7000 },
    { level: 29, required_xp: 7000 },
    { level: 30, required_xp: 7000 },
    { level: 31, required_xp: 7000 },
    { level: 32, required_xp: 7000 },
    { level: 33, required_xp: 7000 },
    { level: 34, required_xp: 7000 },
    { level: 35, required_xp: 7000 },
    { level: 36, required_xp: 7000 },
    { level: 37, required_xp: 7000 },
    { level: 38, required_xp: 7000 },
    { level: 39, required_xp: 7000 },
    { level: 40, required_xp: 7000 },
    { level: 41, required_xp: 7000 },
    { level: 42, required_xp: 7000 },
    { level: 43, required_xp: 7000 },
    { level: 44, required_xp: 7000 },
    { level: 45, required_xp: 7000 },
    { level: 46, required_xp: 7000 },
    { level: 47, required_xp: 7000 },
    { level: 48, required_xp: 7000 },
    { level: 49, required_xp: 7000 },
    { level: 50, required_xp: 7000 },
    { level: 51, required_xp: 7000 },
    { level: 52, required_xp: 7000 },
    { level: 53, required_xp: 7000 },
    { level: 54, required_xp: 7000 },
    { level: 55, required_xp: 7000 },
    { level: 56, required_xp: 7000 },
    { level: 57, required_xp: 7000 },
    { level: 58, required_xp: 7000 },
    { level: 59, required_xp: 7000 },
    { level: 60, required_xp: 7000 },
    { level: 61, required_xp: 7000 },
    { level: 62, required_xp: 7000 },
    { level: 63, required_xp: 7000 },
    { level: 64, required_xp: 7000 },
    { level: 65, required_xp: 7000 },
    { level: 66, required_xp: 7000 },
    { level: 67, required_xp: 7000 },
    { level: 68, required_xp: 7000 },
    { level: 69, required_xp: 7000 },
    { level: 70, required_xp: 7000 },
    { level: 71, required_xp: 7000 },
    { level: 72, required_xp: 7000 },
    { level: 73, required_xp: 7000 },
    { level: 74, required_xp: 7000 },
    { level: 75, required_xp: 7000 },
    { level: 76, required_xp: 7000 },
    { level: 77, required_xp: 7000 },
    { level: 78, required_xp: 7000 },
    { level: 79, required_xp: 7000 },
    { level: 80, required_xp: 7000 },
    { level: 81, required_xp: 7000 },
    { level: 82, required_xp: 7000 },
    { level: 83, required_xp: 7000 },
    { level: 84, required_xp: 7000 },
    { level: 85, required_xp: 7000 },
    { level: 86, required_xp: 7000 },
    { level: 87, required_xp: 7000 },
    { level: 88, required_xp: 7000 },
    { level: 89, required_xp: 7000 },
    { level: 90, required_xp: 7000 },
    { level: 91, required_xp: 7000 },
    { level: 92, required_xp: 7000 },
    { level: 93, required_xp: 7000 },
    { level: 94, required_xp: 7000 },
    { level: 95, required_xp: 7000 },
    { level: 96, required_xp: 7000 },
    { level: 97, required_xp: 7000 },
    { level: 98, required_xp: 7000 },
    { level: 99, required_xp: 7000 },
    { level: 100, required_xp: 7000 }
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