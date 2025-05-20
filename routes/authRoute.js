const express = require('express');
const router = express.Router();
const authService = require('../service/authService');

/**
 * @route POST /api/auth/login/:userId
 * @desc Log in a user or create a new account
 * @access Public
 */
router.post('/login/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { userName, deviceInfo, fcmToken } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const result = await authService.login(userId, userName, {
            deviceInfo,
            fcmToken
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({
            success: false,
            message: 'Error during login process',
            error: error.message
        });
    }
});

/**
 * @route POST /api/auth/logout/:userId
 * @desc Log out a user and update their logout time
 * @access Public
 */
router.post('/logout/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const result = await authService.logout(userId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in logout route:', error);
        res.status(500).json({
            success: false,
            message: 'Error during logout process',
            error: error.message
        });
    }
});

/**
 * @route GET /api/auth/status/:userId
 * @desc Check if a user is logged in
 * @access Public
 */
router.get('/status/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const result = await authService.checkStatus(userId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in status check route:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking user status',
            error: error.message
        });
    }
});

/**
 * @route GET /api/auth/session-history/:userId
 * @desc Get user's session history and statistics
 * @access Public
 */
router.get('/session-history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const result = await authService.getSessionHistory(userId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in get session history route:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving session history',
            error: error.message
        });
    }
});

module.exports = router; 