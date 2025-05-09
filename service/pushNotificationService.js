const admin = require('firebase-admin');
const User = require('../models/user');

// Initialize Firebase Admin
const serviceAccount = require('../config/my-game-b2f9d-firebase-adminsdk-fbsvc-2c76088d90.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Send push notification to all users
async function sendPushNotificationToAllUsers(title, body, data = {}) {
    try {
        // Get all users with FCM tokens
        const users = await User.find({ fcmToken: { $exists: true } }, { fcmToken: 1 });
        
        if (users.length === 0) {
            return {
                success: false,
                message: 'No users with FCM tokens found'
            };
        }

        // Filter out any null/undefined tokens
        const tokens = users.map(user => user.fcmToken).filter(token => token);
        
        let successCount = 0;
        let failureCount = 0;

        // Convert all data values to strings
        const stringifiedData = Object.entries(data).reduce((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
        }, {});

        // Send notifications to each token individually
        for (const token of tokens) {
            try {
                const message = {
                    token,
                    notification: {
                        title,
                        body
                    },
                    data: {
                        ...stringifiedData,
                        click_action: 'FLUTTER_NOTIFICATION_CLICK'
                    }
                };

                await admin.messaging().send(message);
                successCount++;
            } catch (error) {
                console.error(`Error sending notification to token ${token}:`, error);
                failureCount++;
            }
        }

        return {
            success: true,
            message: 'Push notifications sent successfully',
            results: {
                successCount,
                failureCount,
                totalCount: tokens.length
            }
        };
    } catch (error) {
        console.error('Error sending push notifications:', error);
        throw error;
    }
}

// Send push notification to specific user
async function sendPushNotificationToUser(userId, title, body, data = {}) {
    try {
        const user = await User.findOne({ userId });
        
        if (!user || !user.fcmToken) {
            return {
                success: false,
                message: 'User not found or no FCM token available'
            };
        }

        const message = {
            notification: {
                title,
                body
            },
            data: {
                ...data,
                click_action: 'FLUTTER_NOTIFICATION_CLICK'
            },
            token: user.fcmToken
        };

        const response = await admin.messaging().send(message);

        return {
            success: true,
            message: 'Push notification sent successfully',
            messageId: response
        };
    } catch (error) {
        console.error('Error sending push notification:', error);
        throw error;
    }
}

// Update user's FCM token
async function updateUserFCMToken(userId, fcmToken) {
    try {
        const user = await User.findOneAndUpdate(
            { userId },
            { fcmToken },
            { new: true }
        );

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        return {
            success: true,
            message: 'FCM token updated successfully'
        };
    } catch (error) {
        console.error('Error updating FCM token:', error);
        throw error;
    }
}

module.exports = {
    sendPushNotificationToAllUsers,
    sendPushNotificationToUser,
    updateUserFCMToken
}; 