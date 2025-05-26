const User = require('../models/user');
const redisClient = require('./redisService');

/**
 * Leaderboard service to handle high-volume trophy updates efficiently
 */
class LeaderboardService {
  /**
   * Update a player's trophy count atomically
   * @param {string} userId - The user ID
   * @param {number} trophyChange - The change in trophies (positive or negative)
   * @param {Object} userData - Optional additional user data to update
   * @returns {Promise<Object>} Updated trophy information
   */
  async updatePlayerTrophies(userId, trophyChange, userData = {}) {
    if (!userId || typeof trophyChange !== 'number') {
      throw new Error('User ID and trophy change are required');
    }
    
    console.log(`Updating trophies for ${userId} by ${trophyChange}`);
    
    // Use Redis for atomic operations with Lua script to ensure consistency
    const luaScript = `
      local userId = ARGV[1]
      local trophyChange = tonumber(ARGV[2])
      
      -- First get the current score/trophies
      local currentTrophies = tonumber(redis.call('ZSCORE', 'leaderboard:global', userId)) or 0
      
      -- Calculate new trophy count
      local newTrophies = currentTrophies + trophyChange
      if newTrophies < 0 then newTrophies = 0 end
      
      -- Update the sorted set
      redis.call('ZADD', 'leaderboard:global', newTrophies, userId)
      
      -- Return the values for app use
      return {currentTrophies, newTrophies}
    `;
    
    try {
      // Execute atomic trophy update in Redis
      const result = await redisClient.client.eval(
        luaScript,
        {
          keys: [], // No keys needed for this script
          arguments: [userId, trophyChange.toString()]
        }
      );
      
      const currentTrophies = parseInt(result[0]);
      const newTrophies = parseInt(result[1]);
      
      console.log(`User ${userId}: ${currentTrophies} -> ${newTrophies} trophies`);
      
      // Update MongoDB in the background (non-blocking)
      this._updateMongoDBInBackground(userId, newTrophies, userData);
      
      // Update user data in Redis hash
      const userDataToStore = {
        trophies: newTrophies,
        ...userData
      };
      
      if (Object.keys(userDataToStore).length > 0) {
        await redisClient.client.hSet(`user:${userId}`, userDataToStore);
      }
      
      // Invalidate cached leaderboard if trophy change is significant
      if (Math.abs(trophyChange) >= 100) {
        redisClient.del('cached:leaderboard:top')
          .catch(err => console.error('Error invalidating leaderboard cache:', err));
      }
      
      return {
        userId,
        previousTrophies: currentTrophies,
        trophyChange,
        newTrophies
      };
    } catch (error) {
      console.error('Error updating player trophies:', error);
      throw error;
    }
  }
  
  /**
   * Get player rank with efficient caching
   * @param {string} userId - The user ID
   * @returns {Promise<Object>} Player rank info
   */
  async getPlayerRank(userId) {
    try {
      // Try to get rank from Redis first (much faster)
      const rank = await redisClient.zRevRank('leaderboard:global', userId);
      const userTrophies = await redisClient.zScore('leaderboard:global', userId);
      let userData = await redisClient.client.hGetAll(`user:${userId}`);
      
      // If we have data in Redis
      if (rank !== null && userTrophies !== null) {
        console.log(`Found user ${userId} in Redis with rank ${rank + 1}`);
        
        // If we don't have full user data, fetch it from MongoDB
        if (!userData || Object.keys(userData).length === 0) {
          try {
            const user = await User.findOne({ userId }, { 
              user_name: 1, profile_picture: 1, level: 1, title: 1, _id: 0 
            });
            
            if (user) {
              userData = {
                username: user.user_name || 'Unknown',
                profilePicture: user.profile_picture || 'default.jpg',
                level: user.level || 1,
                title: user.title || ''
              };
              
              // Store for next time
              await redisClient.client.hSet(`user:${userId}`, {
                ...userData,
                trophies: userTrophies
              });
            }
          } catch (error) {
            console.error(`Error fetching MongoDB data for ${userId}:`, error);
            // Continue with default values
            userData = {
              username: 'Unknown',
              profilePicture: 'default.jpg',
              level: 1,
              title: ''
            };
          }
        }
        
        return {
          rank: rank + 1, // +1 because Redis ranks are 0-based
          userId,
          username: userData.username || 'Unknown',
          trophies: parseInt(userTrophies),
          profilePicture: userData.profilePicture || 'default.jpg',
          level: parseInt(userData.level || 1),
          title: userData.title || ''
        };
      }
      
      // Fall back to MongoDB
      console.log(`User ${userId} not found in Redis, falling back to MongoDB`);
      const user = await User.findOne({ userId });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get rank by counting users with higher trophy count
      const higherRankedCount = await User.countDocuments({
        trophy_count: { $gt: user.trophy_count || 0 }
      });
      
      const calculatedRank = higherRankedCount + 1;
      const trophies = user.trophy_count || 0;
      
      // Update Redis for next time
      await redisClient.zAdd('leaderboard:global', [
        { score: trophies, value: userId }
      ]);
      
      await redisClient.client.hSet(`user:${userId}`, {
        userId,
        username: user.user_name || 'Unknown',
        trophies,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      });
      
      return {
        rank: calculatedRank,
        userId,
        username: user.user_name || 'Unknown',
        trophies,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      };
    } catch (error) {
      console.error('Error getting player rank:', error);
      throw error;
    }
  }
  
  /**
   * Get the top leaderboard players
   * @param {number} limit - Number of players to return
   * @returns {Promise<Array>} Leaderboard entries
   */
  async getTopPlayers(limit = 500) {
    try {
      // First check if we have a pre-built cached leaderboard
      const cachedLeaderboard = await redisClient.getJson('cached:leaderboard:top');
      if (cachedLeaderboard) {
        console.log('Using pre-built cached leaderboard');
        return cachedLeaderboard.slice(0, limit);
      }
      
      // Try to rebuild the leaderboard and return it
      await redisClient.prebuildLeaderboard(limit);
      
      // Try again to get the cached leaderboard
      const rebuiltLeaderboard = await redisClient.getJson('cached:leaderboard:top');
      if (rebuiltLeaderboard) {
        return rebuiltLeaderboard.slice(0, limit);
      }
      
      // Fall back to direct Redis/MongoDB as a last resort
      const topUserIds = await redisClient.zRevRange('leaderboard:global', 0, limit - 1, 'WITHSCORES');
      
      if (topUserIds.length === 0) {
        // Completely fall back to MongoDB
        const users = await User.find({})
          .sort({ trophy_count: -1 })
          .limit(limit)
          .select('userId user_name trophy_count profile_picture level title');
        
        let currentRank = 1;
        let previousTrophies = -1;
        const leaderboard = [];
        
        for (const user of users) {
          if (user.trophy_count !== previousTrophies) {
            currentRank = leaderboard.length + 1;
            previousTrophies = user.trophy_count;
          }
          
          leaderboard.push({
            rank: currentRank,
            userId: user.userId,
            username: user.user_name || 'Unknown',
            trophies: user.trophy_count || 0,
            profilePicture: user.profile_picture || 'default.jpg',
            level: user.level || 1,
            title: user.title || ''
          });
          
          // Update Redis in background
          redisClient.zAdd('leaderboard:global', [{ 
            score: user.trophy_count || 0, 
            value: user.userId 
          }]).catch(err => console.error('Redis update error:', err));
        }
        
        return leaderboard;
      }
      
      // Process data from Redis
      const leaderboard = [];
      let currentRank = 1;
      let previousScore = -1;
      
      for (let i = 0; i < topUserIds.length; i += 2) {
        const userId = topUserIds[i];
        const trophies = parseInt(topUserIds[i + 1]);
        
        // If trophy count is different from previous user, increment rank
        if (trophies !== previousScore) {
          currentRank = leaderboard.length + 1;
          previousScore = trophies;
        }
        
        // Default data if we can't get user details
        let userData = {
          username: 'Unknown',
          profilePicture: 'default.jpg',
          level: 1,
          title: ''
        };
        
        // Try to get user data from Redis
        const redisUserData = await redisClient.client.hGetAll(`user:${userId}`);
        if (redisUserData && Object.keys(redisUserData).length > 0) {
          userData = {
            username: redisUserData.username || 'Unknown',
            profilePicture: redisUserData.profilePicture || 'default.jpg',
            level: parseInt(redisUserData.level) || 1,
            title: redisUserData.title || ''
          };
        }
        
        leaderboard.push({
          rank: currentRank,
          userId,
          username: userData.username,
          trophies,
          profilePicture: userData.profilePicture,
          level: userData.level,
          title: userData.title
        });
      }
      
      return leaderboard;
    } catch (error) {
      console.error('Error getting top players:', error);
      throw error;
    }
  }
  
  /**
   * Update MongoDB with new trophy count (non-blocking background update)
   * @private
   */
  _updateMongoDBInBackground(userId, newTrophies, userData = {}) {
    // Fire and forget - we don't wait for this promise
    (async () => {
      try {
        const updateData = {
          trophy_count: newTrophies,
          last_trophy_update: new Date()
        };
        
        // Add any additional user data that was passed
        if (userData.username) updateData.user_name = userData.username;
        if (userData.profilePicture) updateData.profile_picture = userData.profilePicture;
        if (userData.level) updateData.level = userData.level;
        if (userData.title) updateData.title = userData.title;
        
        await User.findOneAndUpdate(
          { userId },
          { $set: updateData },
          { upsert: false }
        );
        
        console.log(`MongoDB updated for user ${userId} with ${newTrophies} trophies`);
      } catch (error) {
        console.error(`Error updating MongoDB for user ${userId}:`, error);
        // We don't rethrow since this is a background operation
      }
    })();
  }
}

module.exports = new LeaderboardService(); 