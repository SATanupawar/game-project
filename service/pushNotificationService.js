const admin = require('firebase-admin');
const User = require('../models/user');

// Debug environment variables
console.log('Firebase Configuration:');
console.log('firebase_type:', process.env.firebase_type);
console.log('firebase_project_id:', process.env.firebase_project_id);
console.log('firebase_private_key_id:', process.env.firebase_private_key_id);
console.log('firebase_client_email:', process.env.firebase_client_email);

// Check if required environment variables are present
const requiredEnvVars = [
    'firebase_type',
    'firebase_project_id',
    'firebase_private_key_id',
    'firebase_private_key',
    'firebase_client_email',
    'firebase_client_id',
    'firebase_auth_uri',
    'firebase_auth_provider_x509_cert_url',
    'firebase_client_x509_cert_url'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('Missing required environment variables:', missingEnvVars);
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Initialize Firebase Admin
const serviceAccount = {
    type: process.env.firebase_type,
    project_id: process.env.firebase_project_id,
    private_key_id: process.env.firebase_private_key_id,
    private_key: process.env.firebase_private_key?.replace(/\\n/g, '\n').replace(/"/g, ''),
    client_email: process.env.firebase_client_email,
    client_id: process.env.firebase_client_id,
    auth_uri: process.env.firebase_auth_uri,
    token_uri: process.env.firebase_token_uri,
    auth_provider_x509_cert_url: process.env.firebase_auth_provider_cert_url,
    client_x509_cert_url: process.env.firebase_client_cert_url
};

// Initialize Firebase Admin with proper error handling
try {
    // Log the private key format for debugging (first 50 chars only)
    console.log('Private key format check:', serviceAccount.private_key?.substring(0, 50));
    
    // Verify private key format
    if (!serviceAccount.private_key?.includes('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('Private key is missing BEGIN marker');
    }
    if (!serviceAccount.private_key?.includes('-----END PRIVATE KEY-----')) {
        throw new Error('Private key is missing END marker');
    }
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    console.error('Private key length:', serviceAccount.private_key?.length);
    console.error('Private key contains newlines:', serviceAccount.private_key?.includes('\n'));
    throw error;
}

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