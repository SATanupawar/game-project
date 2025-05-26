// A minimal script to rebuild the leaderboard
const mongoose = require('mongoose');
const User = require('../models/user');
const redis = require('redis');
require('dotenv').config();

async function rebuildLeaderboard() {
  // Create a Redis client with default options
  const redisClient = redis.createClient();
  
  try {
    console.log('Connecting to MongoDB and Redis...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/game-db', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    // Connect to Redis
    await redisClient.connect();
    console.log('Connected successfully');
    
    // Clear existing leaderboard
    await redisClient.del('leaderboard:global');
    console.log('Cleared existing leaderboard');
    
    // Get all users from MongoDB
    const users = await User.find({}, { 
      userId: 1, 
      user_name: 1, 
      trophy_count: 1,
      profile_picture: 1,
      level: 1,
      title: 1
    });
    
    console.log(`Found ${users.length} users in MongoDB`);
    
    // Use a simple loop to add users to the leaderboard
    for (const user of users) {
      console.log(`User ${user.userId} (${user.user_name}): ${user.trophy_count || 0} trophies`);
      
      // Add the user to the leaderboard
      try {
        // Raw Redis command
        await redisClient.sendCommand([
          'ZADD', 
          'leaderboard:global', 
          (user.trophy_count || 0).toString(), 
          user.userId
        ]);
        
        // Store user data in a hash
        await redisClient.hSet(`user:${user.userId}`, {
          userId: user.userId,
          username: user.user_name || 'Unknown',
          trophies: (user.trophy_count || 0).toString(),
          profilePicture: user.profile_picture || 'default.jpg',
          level: (user.level || 1).toString(),
          title: user.title || ''
        });
      } catch (err) {
        console.error(`Error adding user ${user.userId} to leaderboard:`, err);
      }
    }
    
    // Get top users
    try {
      // Try with ZREVRANGE instead which is more compatible
      const topUsers = await redisClient.sendCommand([
        'ZREVRANGE', 
        'leaderboard:global', 
        '0', 
        '10', 
        'WITHSCORES'
      ]);
      
      console.log('\nTop leaderboard entries:');
      for (let i = 0; i < topUsers.length; i += 2) {
        console.log(`Rank ${Math.floor(i/2) + 1}: User ${topUsers[i]} - ${topUsers[i+1]} trophies`);
      }
    } catch (err) {
      console.error('Error getting top users:', err);
    }
    
    console.log('\nLeaderboard rebuild completed successfully!');
    
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