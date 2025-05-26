// scripts/rebuildLeaderboard.js
const mongoose = require('mongoose');
const User = require('../models/user');
const redisWrapper = require('../service/redisService');
require('dotenv').config();

async function rebuildLeaderboard() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    
    console.log('MongoDB connected');
    
    // Redis client is already connected in the service module
    
    // Delete existing leaderboard
    await redisWrapper.del('leaderboard:global');
    
    // Fetch all users with trophies
    const users = await User.find({}, { userId: 1, trophy_count: 1 });
    console.log(`Found ${users.length} users to add to leaderboard`);
    
    // Prepare data for Redis
    const leaderboardEntries = users.map(user => ({
      score: user.trophy_count || 0,
      value: user.userId
    }));
    
    // Add to Redis in batches of 1000
    const batchSize = 1000;
    for (let i = 0; i < leaderboardEntries.length; i += batchSize) {
      const batch = leaderboardEntries.slice(i, i + batchSize);
      await redisWrapper.zAdd('leaderboard:global', batch);
      console.log(`Added batch ${i/batchSize + 1}/${Math.ceil(leaderboardEntries.length/batchSize)}`);
    }
    
    console.log('Leaderboard rebuilt successfully');
    
    // Close connections
    await redisWrapper.client.quit();
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error rebuilding leaderboard:', error);
  }
}

// Run the function
rebuildLeaderboard();