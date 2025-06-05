const express = require('express');
const router = express.Router();
const User = require('../models/user');
const redisWrapper = require('../service/redisService');

// Helper function to process creature data consistently
function processCreatureData(creature) {
  // Simply convert the creature_id to string if it exists
  let creatureId = null;
  if (creature.creature_id) {
    creatureId = creature.creature_id.toString();
  }
  
  return {
    creature_id: creatureId,
    name: creature.name,
    level: creature.level,
    type: creature.type,
    attack: creature.attack,
    health: creature.health,
    // Add the additional requested fields
    speed: creature.speed || 0,
    armor: creature.armor || 0,
    critical_damage: creature.critical_damage || 0,
    critical_damage_percentage: creature.critical_damage_percentage || 0,
    creature_type: creature.creature_type || "Beast"
  };
}

// Update player score
router.post('/player/:userId/update-score', async (req, res) => {
  try {
    const { userId } = req.params;
    const { trophies } = req.body;
    
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
        last_trophy_update: new Date()
      } 
    });
    
    // Update Redis with new total trophies
    await redisWrapper.zAdd('leaderboard:global', [
      { score: newTotalTrophies, value: userId }
    ]);

    // Also store user data in a Redis hash for quick access
    await redisWrapper.client.hSet(`user:${userId}`, {
      userId,
      username: user.user_name || 'Unknown',
      trophies: newTotalTrophies.toString(),
      profilePicture: user.profile_picture || 'default.jpg',
      level: (user.level || 1).toString(),
      title: user.title || ''
    });
    
    // Invalidate the cached leaderboard to ensure immediate updates
    await redisWrapper.del('cached:leaderboard:top');
    console.log('Leaderboard cache invalidated after trophy update');
    
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
    
    // Parse range parameters if provided
    const start = parseInt(req.query.start) || 1;
    const end = parseInt(req.query.end) || 500;
    const limit = Math.min(end - start + 1, 500); // Cap at 500 max
    
    // Check if user is requesting data for a specific user
    const specificUserId = req.query.user_id;
    let userPosition = -1;
    
    // If specific user requested, find their position first
    if (specificUserId) {
      console.log(`Looking for position of user ${specificUserId} in leaderboard`);
      // Try to get position from Redis first
      const userRank = await redisWrapper.zRevRank('leaderboard:global', specificUserId);
      
      if (userRank !== null) {
        // Redis ranks are 0-based, add 1 for human-readable rank
        userPosition = userRank + 1;
        console.log(`Found user ${specificUserId} at position ${userPosition} in Redis`);
        
        // Adjust start/end to center on this user's position
        if (userPosition > 0) {
          const halfRange = Math.floor(limit / 2);
          const newStart = Math.max(1, userPosition - halfRange);
          const newEnd = newStart + limit - 1;
          
          console.log(`Adjusting range to include user: ${newStart}-${newEnd}`);
          req.query.start = newStart.toString();
          req.query.end = newEnd.toString();
        }
      } else {
        console.log(`User ${specificUserId} not found in Redis leaderboard, will check MongoDB`);
        // Will fall back to MongoDB query later
      }
    }
    
    // Check if we should force a cache refresh
    const forceRefresh = req.query.force_refresh === 'true';
    if (forceRefresh) {
      console.log('Forcing cache refresh for leaderboard');
      await redisWrapper.del('cached:leaderboard:top');
      
      // Also clear specific user cache if provided
      if (specificUserId) {
        await redisWrapper.client.del(`user:${specificUserId}`);
      }
    }
    
    // First check if we have a pre-built cached leaderboard
    // Skip cache if requesting battle selected creatures
    const includeBattleCreatures = req.query.include_battle_creatures !== 'false'; // Default to true
    const cacheKey = includeBattleCreatures ? null : 'cached:leaderboard:top';
    
    if (!includeBattleCreatures) {
      const cachedLeaderboard = await redisWrapper.getJson(cacheKey);
      if (cachedLeaderboard) {
        console.log('Using pre-built cached leaderboard');
        const endTime = Date.now();
        console.log(`Leaderboard request processed in ${endTime - startTime}ms`);
        
        // Apply range filtering to cached leaderboard
        const rangedLeaderboard = cachedLeaderboard.slice(start - 1, end);
        
        return res.status(200).json({
          success: true,
          range: {
            from: start,
            to: Math.min(end, start + rangedLeaderboard.length - 1),
            total: cachedLeaderboard.length
          },
          data: rangedLeaderboard
        });
      }
    }

    // First try to get from Redis directly - much faster
    const redisKey = 'leaderboard:global';
    
    // Get the user IDs with their scores from Redis based on range
    const topUserIds = await redisWrapper.zRevRange(redisKey, start - 1, end - 1, 'WITHSCORES');
    
    // Check if we have data in Redis
    if (topUserIds.length > 0) {
      console.log(`Found ${topUserIds.length / 2} users in Redis leaderboard`);
      
      const leaderboard = [];
      let currentRank = start;
      let previousScore = -1;
      
      // If we need battle creatures, we'll need to get them from MongoDB
      let userBattleCreatures = {};
      
      if (includeBattleCreatures) {
        // Extract all user IDs from the Redis result
        const userIds = [];
        for (let i = 0; i < topUserIds.length; i += 2) {
          userIds.push(topUserIds[i]);
        }
        
        // Get battle selected creatures for all users in one query with detailed creature info
        const usersWithCreatures = await User.find(
          { userId: { $in: userIds } },
          { userId: 1, battle_selected_creatures: 1, _id: 0 }
        ).populate({
          path: 'battle_selected_creatures.creature_id',
          select: '_id speed armor critical_damage critical_damage_percentage creature_type image description'
        });
        
        console.log('First user battle creatures:', JSON.stringify(usersWithCreatures[0]?.battle_selected_creatures || []));
        
        // Create a map for quick lookup
        usersWithCreatures.forEach(user => {
          // Process creature data to include additional fields
          const processedCreatures = (user.battle_selected_creatures || []).map(creature => processCreatureData(creature));
          
          userBattleCreatures[user.userId] = processedCreatures;
        });
      }
      
      // Get all user data in bulk for better performance
      const pipeline = redisWrapper.client.multi();
      
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
                await redisWrapper.client.hSet(`user:${userId}`, {
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
          currentRank = start + leaderboard.length;
          previousScore = trophies;
        }
        
        const userEntry = {
          rank: currentRank,
          userId,
          username: userData.username || 'Unknown',
          trophies,
          profilePicture: userData.profilePicture || 'default.jpg',
          level: parseInt(userData.level) || 1,
          title: userData.title || ''
        };
        
        // Add battle creatures if requested
        if (includeBattleCreatures) {
          userEntry.battle_selected_creatures = userBattleCreatures[userId] || [];
          // Add additional debug
          if (userBattleCreatures[userId] && userBattleCreatures[userId].length > 0) {
            console.log(`Battle creatures for ${userId}:`, JSON.stringify(userBattleCreatures[userId]));
          }
        }
        
        leaderboard.push(userEntry);
      }
      
      // Only cache if not including battle creatures
      if (!includeBattleCreatures) {
        // Cache the leaderboard for 5 minutes in the background
        redisWrapper.setJson('cached:leaderboard:top', leaderboard, 300)
          .catch(err => console.error('Error caching leaderboard:', err));
      }
      
      const endTime = Date.now();
      console.log(`Leaderboard request processed in ${endTime - startTime}ms`);
      
      return res.status(200).json({
        success: true,
        range: {
          from: start,
          to: Math.min(end, start + leaderboard.length - 1),
          total: await redisWrapper.zCard(redisKey)
        },
        data: leaderboard
      });
    }
    
    // If we got here, we don't have data in Redis, fall back to MongoDB
    console.log('Redis leaderboard empty, falling back to MongoDB');
    
    // If we're looking for a specific user, first find their position
    if (specificUserId && userPosition === -1) {
      console.log(`Finding position for user ${specificUserId} in MongoDB`);
      
      // Count users with higher trophy count
      const userDoc = await User.findOne({ userId: specificUserId });
      if (userDoc) {
        const higherTrophyUsers = await User.countDocuments({
          trophy_count: { $gt: userDoc.trophy_count || 0 }
        });
        
        // Position is users with higher trophies + 1
        userPosition = higherTrophyUsers + 1;
        console.log(`User ${specificUserId} is at position ${userPosition} in MongoDB`);
        
        // Adjust start/end to center on this user's position
        const halfRange = Math.floor(limit / 2);
        const newStart = Math.max(1, userPosition - halfRange);
        const newEnd = newStart + limit - 1;
        
        console.log(`Adjusting range to include user: ${newStart}-${newEnd}`);
        start = newStart;
        end = newEnd;
        // Recompute limit
        limit = Math.min(end - start + 1, 500);
      }
    }
    
    // Build the selection projection based on whether we need battle creatures
    const projection = { 
      userId: 1, 
      user_name: 1, 
      trophy_count: 1, 
      profile_picture: 1,
      level: 1,
      title: 1,
      _id: 0 
    };
    
    if (includeBattleCreatures) {
      projection.battle_selected_creatures = 1;
    }
    
    // Get users from MongoDB with trophy counts
    const users = await User.find({}, projection)
      .sort({ trophy_count: -1 })
      .skip(start - 1)
      .limit(limit);
    
    if (users.length > 0 && users[0].battle_selected_creatures) {
      console.log('First user battle creatures (MongoDB fallback):', 
        JSON.stringify(users[0].battle_selected_creatures || []));
    }
    
    console.log(`Fetched ${users.length} users from MongoDB sorted by trophy_count`);
    
    // Create leaderboard with proper ranks
    const leaderboard = [];
    let currentRank = start;
    let previousTrophies = -1;
    
    // Prepare batch Redis operations
    const redisPipeline = redisWrapper.client.multi();
    
    for (const user of users) {
      // If trophy count is different from previous user, increment rank
      if (user.trophy_count !== previousTrophies) {
        currentRank = start + leaderboard.length;
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
      
      // Add battle creatures if requested
      if (includeBattleCreatures && user.battle_selected_creatures) {
        userData.battle_selected_creatures = user.battle_selected_creatures.map(creature => processCreatureData(creature));
      }
      
      leaderboard.push(userData);
      
      // Add to Redis sorted set
      redisPipeline.sendCommand([
        'ZADD',
        redisKey,
        (user.trophy_count || 0).toString(),
        user.userId
      ]);
      
      // Also store user data in Redis hash
      redisPipeline.hSet(`user:${user.userId}`, {
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: (user.trophy_count || 0).toString(),
        profilePicture: user.profile_picture || 'default.jpg',
        level: (user.level || 1).toString(),
        title: user.title || ''
      });
    }
    
    // Execute Redis batch operations
    await redisPipeline.exec();
    
    // Only cache if not including battle creatures
    if (!includeBattleCreatures) {
      // Cache the leaderboard for 5 minutes
      await redisWrapper.setJson('cached:leaderboard:top', leaderboard, 300);
    }
    
    const endTime = Date.now();
    console.log(`Leaderboard request processed in ${endTime - startTime}ms`);
    
    // Get total count for the range metadata
    const totalUsers = await User.countDocuments({
      trophy_count: { $exists: true, $ne: null }
    });
    
    res.status(200).json({
      success: true,
      range: {
        from: start,
        to: Math.min(end, start + leaderboard.length - 1),
        total: totalUsers
      },
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
    const rank = await redisWrapper.zRevRank('leaderboard:global', userId);
    let userData = await redisWrapper.client.hGetAll(`user:${userId}`);
    
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
    await redisWrapper.zAdd('leaderboard:global', [
      { score: user.trophy_count || 0, value: userId }
    ]);
    
    // Store user data in Redis hash
    await redisWrapper.client.hSet(`user:${userId}`, {
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

// Get top players
router.get('/top', async (req, res) => {
    try {
        const topUsers = await User.find()
            .sort({ trophy_count: -1 })
            .limit(10)
            .populate({
                path: 'battle_selected_creatures.creature_id',
                select: 'speed armor critical_damage critical_damage_percentage creature_Id_reference image description'
            })
            .select('userId user_name trophy_count profile_picture level title battle_selected_creatures');
        
        const totalUsers = await User.countDocuments({
            trophy_count: { $exists: true, $ne: null }
        });
        
        res.status(200).json({
            success: true,
            range: {
                from: 1,
                to: topUsers.length,
                total: totalUsers
            },
            data: topUsers.map((user, index) => ({
                rank: index + 1,
                userId: user.userId,
                username: user.user_name || "Unknown",
                trophies: user.trophy_count || 0,
                profilePicture: user.profile_picture || "default.jpg",
                level: user.level || 1,
                title: user.title || "",
                battle_selected_creatures: (user.battle_selected_creatures || []).map(creature => processCreatureData(creature))
            }))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Get specific user rank
router.get('/rank/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Count users with more trophies to determine rank
        const higherRankedCount = await User.countDocuments({ 
            trophy_count: { $gt: user.trophy_count } 
        });
        
        const rank = higherRankedCount + 1; // Add 1 because ranks start at 1
        
        res.status(200).json({
            success: true,
            data: {
                rank,
                userId: user.userId,
                username: user.user_name || "Unknown",
                trophies: user.trophy_count || 0,
                profilePicture: user.profile_picture || "default.jpg",
                level: user.level || 1,
                title: user.title || ""
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Add a new route that supports the /top/{range} format
router.get('/top/:range', async (req, res) => {
  try {
    console.log('Getting range of players from leaderboard');
    const startTime = Date.now();
    
    // Parse range from URL param
    const range = req.params.range;
    let start = 1, end = 500;
    
    if (range && range.includes('-')) {
      const [startStr, endStr] = range.split('-');
      start = parseInt(startStr) || 1;
      end = parseInt(endStr) || 500;
    }
    
    // Force refresh cache for this new format
    console.log('Forcing cache refresh for leaderboard');
    await redisWrapper.del('cached:leaderboard:top');
    
    // Clear any cached user entries for specific users
    try {
      // Use the Redis client directly to get keys if available
      if (redisWrapper.client && typeof redisWrapper.client.keys === 'function') {
        const usersCacheKeys = await redisWrapper.client.keys('user:*');
        if (usersCacheKeys && usersCacheKeys.length > 0) {
          console.log(`Clearing ${usersCacheKeys.length} user cache entries`);
          const pipeline = redisWrapper.client.multi();
          usersCacheKeys.forEach(key => pipeline.del(key));
          await pipeline.exec();
        }
      } else {
        console.log('Redis keys function not available, skipping user cache clearing');
      }
    } catch (redisError) {
      console.error('Error clearing Redis cache:', redisError);
      // Continue with the request even if Redis cache clearing fails
    }
    
    // Directly query the database for users in this range
    const limit = end - start + 1;
    const skip = start - 1;
    
    // Get users from MongoDB with trophy counts
    const users = await User.find({})
      .sort({ trophy_count: -1 })
      .skip(skip)
      .limit(limit);
    
    // Process user data for response
    const leaderboard = [];
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const currentRank = start + i;
      
      const userData = {
        rank: currentRank,
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      };
      
      // Add battle creatures with proper creature_id
      if (user.battle_selected_creatures && user.battle_selected_creatures.length > 0) {
        userData.battle_selected_creatures = user.battle_selected_creatures.map(creature => {
          // Convert creature_id to string if it exists
          const creatureId = creature.creature_id ? creature.creature_id.toString() : null;
          
          return {
            creature_id: creatureId,
            name: creature.name,
            level: creature.level,
            type: creature.type,
            attack: creature.attack,
            health: creature.health,
            speed: creature.speed || 0,
            armor: creature.armor || 0,
            critical_damage: creature.critical_damage || 0,
            critical_damage_percentage: creature.critical_damage_percentage || 0,
            creature_type: creature.creature_type || "Beast"
          };
        });
      } else {
        userData.battle_selected_creatures = [];
      }
      
      leaderboard.push(userData);
    }
    
    // Get total count for the range metadata
    const totalUsers = await User.countDocuments({});
    
    const endTime = Date.now();
    console.log(`Range leaderboard request processed in ${endTime - startTime}ms`);
    
    res.status(200).json({
      success: true,
      range: {
        from: start,
        to: Math.min(end, start + leaderboard.length - 1),
        total: totalUsers
      },
      data: leaderboard
    });
    
  } catch (error) {
    console.error('Error handling range leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leaderboard data',
      error: error.message
    });
  }
});

// For the direct MongoDB query section, make sure we fetch the exact user by ID if requested
router.get('/user/:userId/leaderboard-data', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Fetch user with battle creatures
    const user = await User.findOne({ userId })
      .populate({
        path: 'battle_selected_creatures.creature_id',
        select: '_id speed armor critical_damage critical_damage_percentage creature_type image description'
      });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Process user data into leaderboard format
    const userData = {
      userId: user.userId,
      username: user.user_name || 'Unknown',
      trophies: user.trophy_count || 0,
      profilePicture: user.profile_picture || 'default.jpg',
      level: user.level || 1,
      title: user.title || '',
      battle_selected_creatures: (user.battle_selected_creatures || []).map(creature => processCreatureData(creature))
    };
    
    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error fetching user leaderboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
});

module.exports = router;
