const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const express = require('express');

// Redis client configuration
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    enableOfflineQueue: false,
    retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
});

// Error handling for Redis connection
redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

// Different rate limiters for different endpoints
const rateLimiters = {
    // General API rate limiter
    general: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'game_api_general',
        points: 100,        // 100 requests
        duration: 60,       // per minute
        blockDuration: 60   // block for 1 minute if limit exceeded
    }),

    // Authentication endpoints rate limiter (stricter)
    auth: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'game_api_auth',
        points: 5,         // 5 requests
        duration: 60,      // per minute
        blockDuration: 300 // block for 5 minutes if limit exceeded
    }),

    // Game actions rate limiter
    gameActions: new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'game_api_actions',
        points: 30,        // 30 requests
        duration: 60,      // per minute
        blockDuration: 60  // block for 1 minute if limit exceeded
    })
};

// Middleware factory function
const createRateLimiter = (type = 'general') => {
    return async (req, res, next) => {
        try {
            // Get client IP
            const ip = req.ip || req.connection.remoteAddress;
            
            // Get user ID if authenticated
            const userId = req.user ? req.user.userId : ip;
            
            // Use appropriate rate limiter
            const limiter = rateLimiters[type];
            
            // Consume 1 point
            await limiter.consume(userId);
            
            // Add rate limit info to response headers
            res.setHeader('X-RateLimit-Limit', limiter.points);
            res.setHeader('X-RateLimit-Remaining', await limiter.get(userId));
            
            next();
        } catch (error) {
            if (error.remainingPoints !== undefined) {
                // Rate limit exceeded
                res.setHeader('X-RateLimit-Remaining', error.remainingPoints);
                res.setHeader('X-RateLimit-Reset', new Date(Date.now() + error.msBeforeNext));
                
                return res.status(429).json({
                    success: false,
                    message: 'Too many requests. Please try again later.',
                    retryAfter: Math.ceil(error.msBeforeNext / 1000)
                });
            }
            
            // Other errors
            console.error('Rate limiter error:', error);
            next(error);
        }
    };
};

module.exports = {
    createRateLimiter,
    rateLimiters
}; 