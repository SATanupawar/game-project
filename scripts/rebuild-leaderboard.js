// Script to rebuild leaderboard from MongoDB
const mongoose = require('mongoose');
const User = require('../models/user');
const redisWrapper = require('../service/redisService');
require('dotenv').config();

async function rebuildLeaderboardFromDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/game-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB, fetching all users...');
    
    // First, clear the existing leaderboard
    await redisWrapper.del('leaderboard:global');
    console.log('Cleared existing leaderboard');
    
    // Get all users with trophy_count
    const users = await User.find({}, { 
      userId: 1, 
      user_name: 1, 
      trophy_count: 1,
      profile_picture: 1,
      level: 1,
      title: 1
    });
    
    console.log(`Found ${users.length} users in MongoDB`);
    
    // Add all users to Redis leaderboard
    const pipeline = redisWrapper.client.multi();
    
    // Log trophy counts for debugging
    for (const user of users) {
      console.log(`User ${user.userId} (${user.user_name}): ${user.trophy_count || 0} trophies`);
      
      // Add to leaderboard sorted set with correct format for Redis v5.1.0
      pipeline.zAdd('leaderboard:global', [
        user.trophy_count || 0,  // score
        user.userId              // value
      ]);
      
      // Store user data in Redis hash
      pipeline.hSet(`user:${user.userId}`, {
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      });
    }
    
    // Execute all Redis commands at once
    console.log('Executing Redis commands...');
    await pipeline.exec();
    
    // Now prebuild the cached leaderboard
    console.log('Prebuilding cached leaderboard...');
    const success = await redisWrapper.prebuildLeaderboard(500);
    
    if (success) {
      console.log('Leaderboard rebuild successful!');
    } else {
      console.log('Leaderboard prebuild skipped - no data available');
    }
    
    // Verify by getting top entries
    const topEntries = await redisWrapper.zRevRange('leaderboard:global', 0, 10, 'WITHSCORES');
    console.log('Top entries in leaderboard:');
    for (let i = 0; i < topEntries.length; i += 2) {
      console.log(`Rank ${i/2 + 1}: User ${topEntries[i]} - ${topEntries[i+1]} trophies`);
    }
    
    console.log('Done!');
    
  } catch (error) {
    console.error('Error rebuilding leaderboard:', error);
  } finally {
    // Close connections
    try {
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    } catch (err) {
      console.error('Error disconnecting from MongoDB:', err);
    }
  }
}

// Run the function
rebuildLeaderboardFromDB(); 