const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');

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

        // Check for duplicates first
        const duplicates = [];
        for (const path of paths) {
            const coordKey = `${path.x},${path.y}`;
            if (existingCoords.has(coordKey)) {
                duplicates.push(path);
            }
        }

        // If duplicates found, return 400 error
        if (duplicates.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate paths detected',
                duplicates: duplicates,
                existing_paths: user.placed_paths
            });
        }

        // Add only paths that don't already exist
        const addedPaths = [];
        for (const path of paths) {
            const newPath = {
                x: path.x,
                y: path.y,
                created_at: new Date()
            };
            user.placed_paths.push(newPath);
            addedPaths.push(newPath);
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

module.exports = router; 