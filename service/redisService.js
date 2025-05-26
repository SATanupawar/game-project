// In a new file: service/redisService.js
const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Handle connection events
redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('error', (err) => console.error('Redis error:', err));

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

// Create wrapper functions with proper method names for Redis v5.1.0
const redisWrapper = {
  // Original client for direct access if needed
  client: redisClient,
  
  // Wrapper methods that maintain compatibility
  zAdd: async (key, members) => {
    // Convert array format to what redis v5.1.0 expects
    return await redisClient.zAdd(key, members);
  },
  
  zRevRange: async (key, start, stop) => {
    // For Redis v5.1.0, we need to use zRange with REV option
    try {
      const result = await redisClient.zRange(key, start, stop, { REV: true });
      return result;
    } catch (err) {
      console.error('Error in zRevRange:', err);
      return [];
    }
  },
  
  zRevRank: async (key, member) => {
    // For Redis v5.1.0, zRevRank is implemented differently
    try {
      const rank = await redisClient.zRank(key, member, { REV: true });
      return rank;
    } catch (err) {
      console.error('Error in zRevRank:', err);
      return null;
    }
  },
  
  zScore: async (key, member) => {
    return await redisClient.zScore(key, member);
  },
  
  del: async (key) => {
    return await redisClient.del(key);
  }
};

module.exports = redisWrapper;