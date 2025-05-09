const mongoose = require('mongoose');
const UserLevel = require('../models/userLevel');
require('dotenv').config();

const userLevels = [
    { level: 1, required_xp: 0 },
    { level: 2, required_xp: 30 },
    { level: 3, required_xp: 65 },
    { level: 4, required_xp: 105 },
    { level: 5, required_xp: 150 },
    { level: 6, required_xp: 200 },
    { level: 7, required_xp: 255 },
    { level: 8, required_xp: 315 },
    { level: 9, required_xp: 380 },
    { level: 10, required_xp: 450 },
    { level: 11, required_xp: 525 },
    { level: 12, required_xp: 605 },
    { level: 13, required_xp: 690 },
    { level: 14, required_xp: 780 },
    { level: 15, required_xp: 875 },
    { level: 16, required_xp: 975 },
    { level: 17, required_xp: 1080 },
    { level: 18, required_xp: 1190 },
    { level: 19, required_xp: 1305 },
    { level: 20, required_xp: 1425 },
    { level: 21, required_xp: 1550 },
    { level: 22, required_xp: 1680 },
    { level: 23, required_xp: 1815 },
    { level: 24, required_xp: 1955 },
    { level: 25, required_xp: 2100 },
    { level: 26, required_xp: 2250 },
    { level: 27, required_xp: 2405 },
    { level: 28, required_xp: 2565 },
    { level: 29, required_xp: 2730 },
    { level: 30, required_xp: 2900 },
    { level: 31, required_xp: 3075 },
    { level: 32, required_xp: 3255 },
    { level: 33, required_xp: 3440 },
    { level: 34, required_xp: 3630 },
    { level: 35, required_xp: 3825 },
    { level: 36, required_xp: 4025 },
    { level: 37, required_xp: 4230 },
    { level: 38, required_xp: 4440 },
    { level: 39, required_xp: 4655 },
    { level: 40, required_xp: 4875 }
];

async function initializeUserLevels() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Check if levels already exist
        const count = await UserLevel.countDocuments();
        if (count > 0) {
            console.log('User levels already exist in the database');
            return;
        }

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