// Simple rebuild script for the leaderboard
const mongoose = require('mongoose');
const User = require('../models/user');
const redis = require('redis');
require('dotenv').config();

async function rebuildLeaderboard() {
  // Create a direct Redis client
  const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  try {
    console.log('Connecting to MongoDB and Redis...');
    
    // Connect to both databases
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/game-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    await redisClient.connect();
    
    console.log('Connected to databases, fetching all users...');
    
    // First, clear the existing leaderboard
    await redisClient.del('leaderboard:global');
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
    
    // Process each user individually
    for (const user of users) {
      console.log(`User ${user.userId} (${user.user_name}): ${user.trophy_count || 0} trophies`);
      
      // Add to leaderboard sorted set using direct command for Redis v5
      await redisClient.sendCommand(['ZADD', 'leaderboard:global', 
        (user.trophy_count || 0).toString(), 
        user.userId
      ]);
      
      // Store user data in Redis hash
      await redisClient.hSet(`user:${user.userId}`, {
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      });
    }
    
    // Verify leaderboard by getting top entries using direct command
    const topEntries = await redisClient.sendCommand(['ZRANGE', 'leaderboard:global', '0', '10', 'REV', 'WITHSCORES']);
    console.log('Top entries in leaderboard:');
    
    // Display the results
    for (let i = 0; i < topEntries.length; i += 2) {
      console.log(`Rank ${i/2 + 1}: User ${topEntries[i]} - ${topEntries[i+1]} trophies`);
    }
    
    console.log('Leaderboard rebuild completed successfully!');
    
  } catch (error) {
    console.error('Error rebuilding leaderboard:', error);
  } finally {
    // Close connections
    try {
      await redisClient.quit();
      await mongoose.disconnect();
      console.log('Connections closed');
    } catch (err) {
      console.error('Error closing connections:', err);
    }
  }
}

// Run the function
rebuildLeaderboard(); 