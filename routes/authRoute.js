const express = require('express');
const router = express.Router();
const authService = require('../service/authService');
const logService = require('../service/logService');

/**
 * @route POST /api/auth/login/:userId
 * @desc Login a user, creating them if they don't exist
 * @access Public
 */
router.post('/login/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { userName, fcmToken, deviceInfo, additionalData } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        // Get IP address for logging
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Call the auth service login function
        const result = await authService.login(userId, userName, {
            fcmToken,
            deviceInfo,
            ip,
            ...additionalData
        });
        
        // If the login was successful, check for elite pass and get quests
        if (result.success) {
            // The authService now handles elite quest assignment
            
            // Log login for analytics
            await logService.logAuthEvent('USER_LOGIN', userId, {
                userName: result.userData.userName,
                isNewUser: result.isNewUser,
                hasElitePass: result.userData.has_elite_pass
            });
        }
        
        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
});

/**
 * @route POST /api/auth/login
 * @desc Login a user with userId in request body
 * @access Public
 */
router.post('/login', async (req, res) => {
    try {
        const { userId, userName, fcmToken, deviceInfo, additionalData } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        // Get IP address for logging
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Call the auth service login function
        const result = await authService.login(userId, userName, {
            fcmToken,
            deviceInfo,
            ip,
            ...additionalData
        });
        
        // If the login was successful, check for elite pass and get quests
        if (result.success) {
            // The authService now handles elite quest assignment
            
            // Log login for analytics
            await logService.logAuthEvent('USER_LOGIN', userId, {
                userName: result.userData.userName,
                isNewUser: result.isNewUser,
                hasElitePass: result.userData.has_elite_pass
            });
        }
        
        res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
        console.error('Error in login route:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
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