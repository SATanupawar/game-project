// In a new file: service/redisService.js
const redis = require('redis');

// Create Redis client with better retry strategy
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      // Exponential backoff with cap
      if (retries > 10) {
        console.log('Redis reconnection attempts exceeded 10, stopping reconnects');
        return new Error('Redis connection attempts exceeded');
      }
      const delay = Math.min(Math.pow(2, retries) * 100, 3000);
      console.log(`Redis reconnecting in ${delay}ms...`);
      return delay;
    }
  }
});

// Handle connection events
redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('ready', () => console.log('Redis ready for commands'));
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));
redisClient.on('end', () => console.log('Redis connection closed'));

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// Create wrapper functions using raw commands for Redis v5.1.0 compatibility
const redisWrapper = {
  // Original client for direct access if needed
  client: redisClient,
  
  // Wrapper methods that maintain compatibility
  zAdd: async (key, members) => {
    try {
      // Use the raw sendCommand method for compatibility
      if (Array.isArray(members)) {
        const args = ['ZADD', key];
        
        // Format each member as score, value pairs
        for (const member of members) {
          if (member.score !== undefined && member.value !== undefined) {
            args.push(member.score.toString());
            args.push(member.value);
          }
        }
        
        return await redisClient.sendCommand(args);
      } else {
        // Handle single member case
        return await redisClient.sendCommand([
          'ZADD', 
          key, 
          members.score.toString(), 
          members.value
        ]);
      }
    } catch (err) {
      console.error('Error in zAdd:', err);
      return 0;
    }
  },
  
  zRevRange: async (key, start, stop, options = {}) => {
    // Use the sendCommand method with ZREVRANGE which is more compatible
    try {
      // Build args for ZREVRANGE command
      const args = ['ZREVRANGE', key, start.toString(), stop.toString()];
      
      // Check if options include WITHSCORES
      if (options === 'WITHSCORES') {
        args.push('WITHSCORES');
      }
      
      // Execute the command
      return await redisClient.sendCommand(args);
    } catch (err) {
      console.error('Error in zRevRange:', err);
      return [];
    }
  },
  
  zRevRank: async (key, member) => {
    // For Redis v5.1.0, use ZREVRANK directly
    try {
      const rank = await redisClient.sendCommand(['ZREVRANK', key, member]);
      return rank;
    } catch (err) {
      console.error('Error in zRevRank:', err);
      return null;
    }
  },
  
  zScore: async (key, member) => {
    try {
      return await redisClient.sendCommand(['ZSCORE', key, member]);
    } catch (err) {
      console.error('Error in zScore:', err);
      return null;
    }
  },
  
  del: async (key) => {
    try {
      return await redisClient.del(key);
    } catch (err) {
      console.error('Error in del:', err);
      return 0;
    }
  },

  // Cache with expiration
  setEx: async (key, seconds, value) => {
    try {
      return await redisClient.setEx(key, seconds, value);
    } catch (err) {
      console.error('Error in setEx:', err);
      return null;
    }
  },

  // Get cached value
  get: async (key) => {
    try {
      return await redisClient.get(key);
    } catch (err) {
      console.error('Error in get:', err);
      return null;
    }
  },

  // Cache JSON data with expiration
  setJson: async (key, data, expireSeconds = 3600) => {
    try {
      const jsonString = JSON.stringify(data);
      return await redisClient.setEx(key, expireSeconds, jsonString);
    } catch (err) {
      console.error('Error in setJson:', err);
      return null;
    }
  },

  // Get cached JSON data
  getJson: async (key) => {
    try {
      const jsonString = await redisClient.get(key);
      if (!jsonString) return null;
      return JSON.parse(jsonString);
    } catch (err) {
      console.error('Error in getJson:', err);
      return null;
    }
  },

  // Function to prebuild and cache leaderboard data
  prebuildLeaderboard: async (limit = 500) => {
    try {
      console.log(`Pre-building top ${limit} leaderboard...`);
      const startTime = Date.now();
      
      // Use the sendCommand method directly with ZREVRANGE
      const topUserIds = await redisClient.sendCommand([
        'ZREVRANGE', 
        'leaderboard:global', 
        '0', 
        (limit - 1).toString(), 
        'WITHSCORES'
      ]);
      
      if (!topUserIds || topUserIds.length === 0) {
        console.log('No data in leaderboard, skipping prebuild');
        return false;
      }
      
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
      await redisWrapper.setJson('cached:leaderboard:top', leaderboard, 300);
      
      const endTime = Date.now();
      console.log(`Leaderboard prebuild completed in ${endTime - startTime}ms`);
      return true;
    } catch (err) {
      console.error('Error in prebuildLeaderboard:', err);
      return false;
    }
  },

  // Get count of members in a sorted set
  zCard: async (key) => {
    try {
      return await redisClient.sendCommand(['ZCARD', key]);
    } catch (err) {
      console.error('Error in zCard:', err);
      return 0;
    }
  }
};

module.exports = redisWrapper;