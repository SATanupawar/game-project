const express = require('express');
const router = express.Router();
const cardPackService = require('../service/cardPackService');
const User = require('../models/user');
const mongoose = require('mongoose');

// Helper function to find a user by ID or username
async function findUserByIdOrUsername(userIdentifier) {
    // Check if the identifier is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(userIdentifier)) {
        const userById = await User.findById(userIdentifier);
        if (userById) return userById;
    }

    // Try finding by userId field
    let user = await User.findOne({ userId: userIdentifier });
    if (user) return user;

    // Try finding by username field
    user = await User.findOne({ username: userIdentifier });
    if (user) return user;

    // Try finding by user_name field
    user = await User.findOne({ user_name: userIdentifier });
    if (user) return user;

    // No user found with any of the identifier fields
    return null;
}

// Helper function to get or create a test user
async function getOrCreateTestUser() {
    try {
        // Try to find an existing user
        let testUser = await User.findOne({});

        // If no user exists, create one
        if (!testUser) {
            console.log('Creating test user...');
            testUser = new User({
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123',
                gems: 1000,
                gold: 50000,
                anima: 100,
                arcane_energy: 200,
                buildings: [],
                creatures: []
            });
            await testUser.save();
            console.log('Test user created with ID:', testUser._id);
        }

        return testUser;
    } catch (error) {
        console.error('Error getting/creating test user:', error);
        throw error;
    }
}

/**
 * @route GET /api/card-packs
 * @description Get all available card packs
 * @access Public
 */
router.get('/', async (req, res) => {
    try {
        // Check if user ID is provided in the query parameters
        const userId = req.query.userId;
        let userToUse;

        if (userId) {
            // Try to find the user with the provided ID or username
            userToUse = await findUserByIdOrUsername(userId);
            if (!userToUse) {
                return res.status(404).json({
                    success: false,
                    message: `User with identifier "${userId}" not found`
                });
            }
        } else {
            // Use test user if no ID provided
            userToUse = await getOrCreateTestUser();
        }

        const result = await cardPackService.getAvailableCardPacks(userToUse._id);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json({
            ...result,
            userId: userToUse._id,
            username: userToUse.username
        });
    } catch (error) {
        console.error('Error getting card packs:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * @route GET /api/users/:userId/card-packs
 * @description Get all available card packs for a specific user
 * @access Public
 */
router.get('/users/:userId/card-packs', async (req, res) => {
    try {
        const { userId } = req.params;

        // Try to find the user with the provided ID or username
        const user = await findUserByIdOrUsername(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `User with identifier "${userId}" not found`
            });
        }

        const result = await cardPackService.getAvailableCardPacks(user._id);

        if (!result.success) {
            return res.status(400).json(result);
        }

        return res.status(200).json({
            ...result,
            userId: user._id,
            username: user.username
        });
    } catch (error) {
        console.error('Error getting card packs for user:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * @route GET /api/card-packs/:packId
 * @description Get details of a specific card pack
 * @access Public
 */
router.get('/:packId', async (req, res) => {
    try {
        const { packId } = req.params;

        const result = await cardPackService.getCardPackDetails(packId);

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error getting card pack details:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * @route POST /api/card-packs/open
 * @description Open a card pack and get rewards
 * @access Public
 */
router.post('/open', async (req, res) => {
    try {
        const { packId, userId } = req.body;
        
        if (!packId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Pack ID is required' 
            });
        }
        
        let userToUse;
        
        if (userId) {
            // Try to find the user with the provided ID or username
            userToUse = await findUserByIdOrUsername(userId);
            if (!userToUse) {
                return res.status(404).json({
                    success: false,
                    message: `User with identifier "${userId}" not found`
                });
            }
        } else {
            // Use test user if no ID provided
            userToUse = await getOrCreateTestUser();
        }
        
        const result = await cardPackService.openCardPack(userToUse._id, packId);
        
        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Track quest progress for opening card pack
        try {
            // Import quest service
            const questService = require('../service/questService');
            
            // Update quest progress for opening card pack
            await questService.trackQuestProgress(userToUse.userId || userToUse._id.toString(), 'open_card_pack', {
                pack_id: packId,
                pack_type: result.data?.packType || 'unknown',
                rewards: result.data?.rewards || []
            });
        } catch (questError) {
            console.error('Error updating quest progress for card pack opening:', questError);
            // Continue with response even if quest update fails
        }
        
        return res.status(200).json({
            ...result,
            userId: userToUse._id,
            username: userToUse.username
        });
    } catch (error) {
        console.error('Error opening card pack:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error', 
            error: error.message 
        });
    }
});

/**
 * @route POST /api/users/:userId/card-packs/open
 * @description Open a card pack for a specific user
 * @access Public
 */
router.post('/users/:userId/card-packs/open', async (req, res) => {
    try {
        const { userId } = req.params;
        const { packId } = req.body;

        if (!packId) {
            return res.status(400).json({
                success: false,
                message: 'Pack ID is required'
            });
        }

        // Try to find the user with the provided ID or username
        const user = await findUserByIdOrUsername(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `User with identifier "${userId}" not found`
            });
        }

        const result = await cardPackService.openCardPack(user._id, packId);

        if (!result.success) {
            return res.status(400).json(result);
        }
        
        // Track quest progress for opening card pack
        try {
            // Import quest service
            const questService = require('../service/questService');
            
            // Update quest progress for opening card pack
            await questService.trackQuestProgress(userId, 'open_card_pack', {
                pack_id: packId,
                pack_type: result.data?.packType || 'unknown',
                rewards: result.data?.rewards || []
            });
        } catch (questError) {
            console.error('Error updating quest progress for card pack opening:', questError);
            // Continue with response even if quest update fails
        }

        // Remove unwanted fields from result
        const { message, unlock_instructions, userId: _uid, ...cleanedResult } = result;
        return res.status(200).json(cleanedResult);
    } catch (error) {
        console.error('Error opening card pack for user:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router; 