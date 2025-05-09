const express = require('express');
const router = express.Router();
const pushNotificationService = require('../service/pushNotificationService');

// Send push notification to all users
router.post('/send-to-all', async (req, res) => {
    try {
        const { title, body, data } = req.body;

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'Title and body are required'
            });
        }

        const result = await pushNotificationService.sendPushNotificationToAllUsers(title, body, data);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in send-to-all push notification route:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending push notifications',
            error: error.message
        });
    }
});

// Send push notification to specific user
router.post('/send-to-user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { title, body, data } = req.body;

        if (!title || !body) {
            return res.status(400).json({
                success: false,
                message: 'Title and body are required'
            });
        }

        const result = await pushNotificationService.sendPushNotificationToUser(userId, title, body, data);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in send-to-user push notification route:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending push notification',
            error: error.message
        });
    }
});

// Update user's FCM token
router.post('/update-token/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { fcmToken } = req.body;

        if (!fcmToken) {
            return res.status(400).json({
                success: false,
                message: 'FCM token is required'
            });
        }

        const result = await pushNotificationService.updateUserFCMToken(userId, fcmToken);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in update FCM token route:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating FCM token',
            error: error.message
        });
    }
});

module.exports = router; 