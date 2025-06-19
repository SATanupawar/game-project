const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');
const redis = require('redis');
const { createClient } = require('ioredis');
const os = require('os');

/**
 * @route   POST /api/paths/add/:userId
 * @desc    Add paths to a user's placed_paths array
 * @access  Private
 */
router.post('/add/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { paths } = req.body;

        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Paths array is required' 
            });
        }

        // Validate each path has x and y coordinates
        for (const path of paths) {
            if (path.x === undefined || path.y === undefined) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Each path must have x and y coordinates' 
                });
            }
        }

        // Find user by userId
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Initialize placed_paths array if it doesn't exist
        if (!user.placed_paths) {
            user.placed_paths = [];
        }

        // Create a set of existing coordinates
        const existingCoords = new Set();
        for (const path of user.placed_paths) {
            existingCoords.add(`${path.x},${path.y}`);
        }

        // Add only paths that don't already exist
        const addedPaths = [];
        for (const path of paths) {
            const coordKey = `${path.x},${path.y}`;
            if (!existingCoords.has(coordKey)) {
                const newPath = {
                    x: path.x,
                    y: path.y,
                    created_at: new Date()
                };
                user.placed_paths.push(newPath);
                addedPaths.push(newPath);
                existingCoords.add(coordKey); // Add to set to prevent duplicates within the same request
            }
        }

        await user.save();

        return res.status(200).json({
            success: true,
            message: `${addedPaths.length} paths added successfully`,
            placed_paths: user.placed_paths
        });
    } catch (err) {
        console.error('Error adding paths:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

/**
 * @route   POST /api/paths/remove/:userId
 * @desc    Remove paths from a user's placed_paths array
 * @access  Private
 */
router.post('/remove/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { paths } = req.body;

        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Paths array is required' 
            });
        }

        // Validate each path has x and y coordinates
        for (const path of paths) {
            if (path.x === undefined || path.y === undefined) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Each path must have x and y coordinates' 
                });
            }
        }

        // Find user by userId
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Initialize placed_paths array if it doesn't exist
        if (!user.placed_paths) {
            user.placed_paths = [];
            return res.status(200).json({
                success: true,
                message: 'No paths to remove',
                placed_paths: []
            });
        }

        // Create a map of coordinates for quick lookup
        const pathsToRemove = new Set();
        for (const path of paths) {
            pathsToRemove.add(`${path.x},${path.y}`);
        }

        // Filter out paths that match coordinates in the removal list
        const initialCount = user.placed_paths.length;
        user.placed_paths = user.placed_paths.filter(
            path => !pathsToRemove.has(`${path.x},${path.y}`)
        );

        const removedCount = initialCount - user.placed_paths.length;
        
        await user.save();

        return res.status(200).json({
            success: true,
            message: `${removedCount} paths removed successfully`,
            placed_paths: user.placed_paths
        });
    } catch (err) {
        console.error('Error removing paths:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

/**
 * @route   GET /api/paths/:userId
 * @desc    Get all paths for a user
 * @access  Private
 */
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Find user by userId
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        return res.status(200).json({
            success: true,
            placed_paths: user.placed_paths || []
        });
    } catch (err) {
        console.error('Error getting paths:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

/**
 * @route   DELETE /api/paths/:userId
 * @desc    Delete all placed_paths for a user
 * @access  Private
 */
router.delete('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        user.placed_paths = [];
        await user.save();
        return res.status(200).json({
            success: true,
            message: 'All placed paths deleted successfully',
            placed_paths: []
        });
    } catch (err) {
        console.error('Error deleting all placed paths:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Health check endpoint for Kubernetes
router.get('/health', async (req, res) => {
  try {
    const healthCheck = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      message: 'OK',
      mongodb_connected: mongoose.connection.readyState === 1,
      hostname: os.hostname(),
      service: 'game-backend'
    };
    
    // Add Redis check if Redis is configured
    if (process.env.REDIS_URL) {
      try {
        const redisClient = createClient({
          url: process.env.REDIS_URL
        });
        await redisClient.connect();
        const pong = await redisClient.ping();
        healthCheck.redis_connected = pong === 'PONG';
        await redisClient.disconnect();
      } catch (redisError) {
        console.error('Redis health check failed:', redisError);
        healthCheck.redis_connected = false;
      }
    } else {
      healthCheck.redis_connected = 'not_configured';
    }

    res.status(200).json(healthCheck);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      uptime: process.uptime(),
      message: 'Service Unavailable',
      error: error.message
    });
  }
});

module.exports = router; 