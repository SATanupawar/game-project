// Script to rebuild leaderboard from MongoDB
const mongoose = require('mongoose');
const User = require('../models/user');
const redis = require('redis');
require('dotenv').config();

async function rebuildLeaderboardFromDB() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/game-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Create and connect Redis client
    const redisClient = redis.createClient();
    await redisClient.connect();
    console.log('Connected to Redis');
    
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
      
      // Add to leaderboard sorted set using direct command
      await redisClient.sendCommand([
        'ZADD', 
        'leaderboard:global', 
        (user.trophy_count || 0).toString(), 
        user.userId
      ]);
      
      // Store user data in Redis hash
      await redisClient.hSet(`user:${user.userId}`, {
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: (user.trophy_count || 0).toString(),
        profilePicture: user.profile_picture || 'default.jpg',
        level: (user.level || 1).toString(),
        title: user.title || ''
      });
    }
    
    // Now prebuild the cached leaderboard
    console.log('Prebuilding cached leaderboard...');
    
    // Get the top users for the leaderboard
    const topUserIds = await redisClient.sendCommand([
      'ZREVRANGE', 
      'leaderboard:global', 
      '0', 
      '499', // Get top 500 users
      'WITHSCORES'
    ]);
    
    if (topUserIds && topUserIds.length > 0) {
      console.log(`Found ${topUserIds.length / 2} users in Redis leaderboard`);
      
      const leaderboard = [];
      let currentRank = 1;
      let previousScore = -1;
      
      // Process the Redis results (comes as [userId1, score1, userId2, score2, ...])
      for (let i = 0; i < topUserIds.length; i += 2) {
        const userId = topUserIds[i];
        const trophies = parseInt(topUserIds[i + 1]);
        
        // Get user data from Redis hash
        const userData = await redisClient.hGetAll(`user:${userId}`);
        
        // If trophy count is different from previous user, increment rank
        if (trophies !== previousScore) {
          currentRank = leaderboard.length + 1;
          previousScore = trophies;
        }
        
        if (userData && Object.keys(userData).length > 0) {
          leaderboard.push({
            rank: currentRank,
            userId,
            username: userData.username || 'Unknown',
            trophies,
            profilePicture: userData.profilePicture || 'default.jpg',
            level: parseInt(userData.level) || 1,
            title: userData.title || ''
          });
        } else {
          // If user data not in Redis, add basic entry
          leaderboard.push({
            rank: currentRank,
            userId,
            username: 'Unknown',
            trophies,
            profilePicture: 'default.jpg',
            level: 1,
            title: ''
          });
        }
      }
      
      // Cache the built leaderboard for 5 minutes
      await redisClient.setEx('cached:leaderboard:top', 300, JSON.stringify(leaderboard));
      
      console.log('Leaderboard rebuild successful!');
    } else {
      console.log('Leaderboard prebuild skipped - no data available');
    }
    
    // Verify by getting top entries
    const topEntries = await redisClient.sendCommand([
      'ZREVRANGE', 
      'leaderboard:global', 
      '0', 
      '10', 
      'WITHSCORES'
    ]);
    
    console.log('Top entries in leaderboard:');
    for (let i = 0; i < topEntries.length; i += 2) {
      console.log(`Rank ${Math.floor(i/2) + 1}: User ${topEntries[i]} - ${topEntries[i+1]} trophies`);
    }
    
    console.log('Done!');
    
    // Close connections
    await redisClient.quit();
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error rebuilding leaderboard:', error);
  }
}

// Run the function
rebuildLeaderboardFromDB(); 