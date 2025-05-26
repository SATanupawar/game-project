const express = require('express');
const router = express.Router();
const User = require('../models/user');
const redisClient = require('../service/redisService');

// Update player score
router.post('/player/update-score', async (req, res) => {
  try {
    const { userId, username, trophies } = req.body;
    
    if (!userId || typeof trophies !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'User ID and trophies are required'
      });
    }
    
    console.log(`Updating score for ${userId} with additional ${trophies} trophies`);
    
    // Find current user to get existing trophies
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add new trophies to existing ones
    const currentTrophies = user.trophy_count || 0;
    const newTotalTrophies = currentTrophies + trophies;
    
    console.log(`Current trophies: ${currentTrophies}, New total: ${newTotalTrophies}`);
    
    // Update MongoDB with total trophies
    await User.findOneAndUpdate({ userId }, { 
      $set: { 
        trophy_count: newTotalTrophies,
        // Store these extra fields for quicker leaderboard retrieval
        user_name: username || user.user_name,
        last_trophy_update: new Date()
      } 
    });
    
    // Update Redis with new total trophies
    await redisClient.zAdd('leaderboard:global', [
      { score: newTotalTrophies, value: userId }
    ]);

    // Also store user data in a Redis hash for quick access
    await redisClient.client.hSet(`user:${userId}`, {
      userId,
      username: username || user.user_name,
      trophies: newTotalTrophies,
      profilePicture: user.profile_picture || 'default.jpg',
      level: user.level || 1,
      title: user.title || ''
    });
    
    res.status(200).json({ 
      success: true,
      data: {
        userId,
        previousTrophies: currentTrophies,
        addedTrophies: trophies,
        newTotalTrophies: newTotalTrophies
      }
    });
  } catch (error) {
    console.error('Error updating player score:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating player score',
      error: error.message
    });
  }
});

// Get top 500 players - OPTIMIZED VERSION USING REDIS
router.get('/leaderboard/top', async (req, res) => {
  try {
    console.log('Getting top players from leaderboard');
    const startTime = Date.now();
    
    // First check if we have a pre-built cached leaderboard
    const cachedLeaderboard = await redisClient.getJson('cached:leaderboard:top');
    if (cachedLeaderboard) {
      console.log('Using pre-built cached leaderboard');
      const endTime = Date.now();
      console.log(`Leaderboard request processed in ${endTime - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: cachedLeaderboard
      });
    }

    // First try to get from Redis directly - much faster
    const redisKey = 'leaderboard:global';
    const limit = 500;
    
    // Get the top 500 user IDs with their scores from Redis
    const topUserIds = await redisClient.zRevRange(redisKey, 0, limit - 1, 'WITHSCORES');
    
    // Check if we have data in Redis
    if (topUserIds.length > 0) {
      console.log(`Found ${topUserIds.length / 2} users in Redis leaderboard`);
      
      const leaderboard = [];
      let currentRank = 1;
      let previousScore = -1;
      
      // Get all user data in bulk for better performance
      const pipeline = redisClient.client.multi();
      
      for (let i = 0; i < topUserIds.length; i += 2) {
        const userId = topUserIds[i];
        pipeline.hGetAll(`user:${userId}`);
      }
      
      // Execute all hGetAll commands in one go
      const userDataResults = await pipeline.exec();
      
      // Process the Redis results (comes as [userId1, score1, userId2, score2, ...])
      for (let i = 0; i < topUserIds.length; i += 2) {
        const idx = i / 2;  // Calculate the index in the userDataResults array
        const userId = topUserIds[i];
        const trophies = parseInt(topUserIds[i + 1]);
        
        // Get user data from Redis hash
        let userData = userDataResults[idx];
        
        // If not in Redis, fall back to local defaults
        if (!userData || Object.keys(userData).length === 0) {
          userData = {
            username: 'Unknown',
            profilePicture: 'default.jpg',
            level: 1,
            title: ''
          };
          
          // In background, fetch from MongoDB for next time
          (async () => {
            try {
              const user = await User.findOne({ userId }, {
                user_name: 1, profile_picture: 1, level: 1, title: 1, _id: 0
              });
              
              if (user) {
                await redisClient.client.hSet(`user:${userId}`, {
                  userId,
                  username: user.user_name || 'Unknown',
                  trophies,
                  profilePicture: user.profile_picture || 'default.jpg',
                  level: user.level || 1,
                  title: user.title || ''
                });
              }
            } catch (error) {
              console.error(`Background fetch error for ${userId}:`, error);
            }
          })();
        }
        
        // If trophy count is different from previous user, increment rank
        if (trophies !== previousScore) {
          currentRank = leaderboard.length + 1;
          previousScore = trophies;
        }
        
        leaderboard.push({
          rank: currentRank,
          userId,
          username: userData.username || 'Unknown',
          trophies,
          profilePicture: userData.profilePicture || 'default.jpg',
          level: parseInt(userData.level) || 1,
          title: userData.title || ''
        });
      }
      
      // Cache the leaderboard for 5 minutes in the background
      redisClient.setJson('cached:leaderboard:top', leaderboard, 300)
        .catch(err => console.error('Error caching leaderboard:', err));
      
      const endTime = Date.now();
      console.log(`Leaderboard request processed in ${endTime - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: leaderboard
      });
    }
    
    // If we got here, we don't have data in Redis, fall back to MongoDB
    console.log('Redis leaderboard empty, falling back to MongoDB');
    
    // Get all users from MongoDB with trophy counts
    const users = await User.find({}, { 
      userId: 1, 
      user_name: 1, 
      trophy_count: 1, 
      profile_picture: 1,
      level: 1,
      title: 1,
      _id: 0 
    }).sort({ trophy_count: -1 }).limit(limit);
    
    console.log(`Fetched ${users.length} users from MongoDB sorted by trophy_count`);
    
    // Create leaderboard with proper ranks
    const leaderboard = [];
    let currentRank = 1;
    let previousTrophies = -1;
    
    // Prepare batch Redis operations
    const redisPipeline = redisClient.client.multi();
    
    for (const user of users) {
      // If trophy count is different from previous user, increment rank
      if (user.trophy_count !== previousTrophies) {
        currentRank = leaderboard.length + 1;
        previousTrophies = user.trophy_count;
      }
      
      const userData = {
        rank: currentRank,
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      };
      
      leaderboard.push(userData);
      
      // Add to Redis sorted set
      redisPipeline.zAdd(redisKey, [{
        score: user.trophy_count || 0,
        value: user.userId
      }]);
      
      // Also store user data in Redis hash
      redisPipeline.hSet(`user:${user.userId}`, {
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      });
    }
    
    // Execute Redis batch operations
    await redisPipeline.exec();
    
    // Cache the leaderboard for 5 minutes
    await redisClient.setJson('cached:leaderboard:top', leaderboard, 300);
    
    const endTime = Date.now();
    console.log(`Leaderboard request processed in ${endTime - startTime}ms`);
    
    res.status(200).json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Error getting top players:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting top players',
      error: error.message
    });
  }
});

// Get player rank - OPTIMIZED VERSION
router.get('/leaderboard/rank/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Getting rank for user: ${userId}`);
    const startTime = Date.now();
    
    // Try to get rank from Redis first (much faster)
    const rank = await redisClient.zRevRank('leaderboard:global', userId);
    let userData = await redisClient.client.hGetAll(`user:${userId}`);
    
    // If we have both rank and user data in Redis
    if (rank !== null && userData && Object.keys(userData).length > 0) {
      console.log(`Found user ${userId} in Redis with rank ${rank + 1}`); // +1 because Redis ranks are 0-based
      
      const endTime = Date.now();
      console.log(`Rank request processed in ${endTime - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        data: {
          rank: rank + 1, // +1 because Redis ranks are 0-based
          userId,
          username: userData.username || 'Unknown',
          trophies: parseInt(userData.trophies) || 0,
          profilePicture: userData.profilePicture || 'default.jpg',
          level: parseInt(userData.level) || 1,
          title: userData.title || ''
        }
      });
    }
    
    // Fall back to MongoDB if not in Redis
    console.log(`User ${userId} not found in Redis, falling back to MongoDB`);
    
    // Get player data from MongoDB
    const user = await User.findOne({ userId }, {
      userId: 1,
      user_name: 1,
      trophy_count: 1,
      profile_picture: 1,
      level: 1,
      title: 1,
      _id: 0
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }
    
    // Get all users with higher or equal trophy count
    const higherRankedCount = await User.countDocuments({
      trophy_count: { $gt: user.trophy_count }
    });
    
    // Calculate rank (1-based)
    const calculatedRank = higherRankedCount + 1;
    
    console.log(`User: ${userId}, Calculated Rank: ${calculatedRank}, Trophies: ${user.trophy_count}`);
    
    // Update Redis to ensure consistency
    await redisClient.zAdd('leaderboard:global', [
      { score: user.trophy_count || 0, value: userId }
    ]);
    
    // Store user data in Redis hash
    await redisClient.client.hSet(`user:${userId}`, {
      userId,
      username: user.user_name || 'Unknown',
      trophies: user.trophy_count || 0,
      profilePicture: user.profile_picture || 'default.jpg',
      level: user.level || 1,
      title: user.title || ''
    });
    
    const endTime = Date.now();
    console.log(`Rank request processed in ${endTime - startTime}ms`);
    
    res.status(200).json({
      success: true,
      data: {
        rank: calculatedRank,
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      }
    });
  } catch (error) {
    console.error('Error getting player rank:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting player rank',
      error: error.message
    });
  }
});

module.exports = router;
