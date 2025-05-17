const User = require('../models/user');
const logService = require('./logService');

/**
 * Log in a user, creating a new user if they don't exist
 * @param {string} userId - The unique user ID
 * @param {string} userName - The user's display name
 * @param {object} additionalData - Additional user data to update on login
 * @returns {Promise<object>} Login response with user data
 */
async function login(userId, userName, additionalData = {}) {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Find user by userId
        let user = await User.findOne({ userId });
        const isNewUser = !user;

        if (isNewUser) {
            // Create new user if they don't exist
            user = new User({
                userId,
                user_name: userName || 'Player',
                gold_coins: 500, // Default starting gold
                buildings: [],
                creatures: [],
                creating_creatures: [],
                // Set initial login time
                login_time: new Date()
            });
            
            // Log user registration
            await logService.logAuthEvent('USER_REGISTERED', userId, {
                userName: user.user_name,
                initialGoldCoins: user.gold_coins,
                deviceInfo: additionalData.deviceInfo || null
            });
        } else {
            // Update existing user's login time
            user.login_time = new Date();
            
            // Update username if provided
            if (userName) {
                user.user_name = userName;
            }
            
            // Update any additional fields
            if (additionalData && typeof additionalData === 'object') {
                Object.keys(additionalData).forEach(key => {
                    user[key] = additionalData[key];
                });
            }
        }
        
        // Save the user
        await user.save();
        
        // Log the login event
        await logService.logAuthEvent('USER_LOGIN', userId, {
            userName: user.user_name,
            isNewUser,
            level: user.level,
            xp: user.xp,
            goldCoins: user.gold_coins,
            deviceInfo: additionalData.deviceInfo || null
        });
        
        return {
            success: true,
            message: isNewUser ? 'New user created and logged in' : 'User logged in successfully',
            isNewUser,
            userData: {
                userId: user.userId,
                userName: user.user_name,
                level: user.level,
                xp: user.xp,
                goldCoins: user.gold_coins,
                login_time: user.login_time
            }
        };
    } catch (error) {
        console.error('Error in login service:', error);
        // Log the error
        await logService.logSystemError('Login failed', error, 'authService.login');
        throw error;
    }
}

/**
 * Log out a user
 * @param {string} userId - The unique user ID
 * @returns {Promise<object>} Logout response
 */
async function logout(userId) {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Find user by userId
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Update logout time
        user.logout_time = new Date();

        // Calculate session duration
        let sessionDurationSeconds = null;
        let sessionDurationMinutes = null;
        
        if (user.login_time) {
            const sessionMs = user.logout_time - user.login_time;
            sessionDurationSeconds = Math.floor(sessionMs / 1000); // Duration in seconds
            sessionDurationMinutes = Math.round(sessionDurationSeconds / 60 * 10) / 10; // Minutes with 1 decimal place
            
            // Add to session history
            if (!user.sessionHistory) {
                user.sessionHistory = [];
            }
            
            user.sessionHistory.push({
                startTime: user.login_time,
                endTime: user.logout_time,
                duration: sessionDurationMinutes, // Store as minutes in the database
                deviceInfo: user.deviceInfo || null
            });
        }
        
        // Mark session history as modified
        user.markModified('sessionHistory');
        
        // Save user
        await user.save();
        
        // Log the logout event
        await logService.logAuthEvent('USER_LOGOUT', userId, {
            userName: user.user_name,
            sessionDurationMinutes,
            login_time: user.login_time,
            logout_time: user.logout_time
        });

        return {
            success: true,
            message: 'User logged out successfully',
            userId: user.userId,
            logoutTime: user.logout_time,
            sessionDuration: sessionDurationMinutes // Return minutes
        };
    } catch (error) {
        console.error('Error in logout service:', error);
        // Log the error
        await logService.logSystemError('Logout failed', error, 'authService.logout');
        throw error;
    }
}

/**
 * Check if a user is logged in
 * @param {string} userId - The unique user ID
 * @returns {Promise<object>} User status
 */
async function checkStatus(userId) {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Find user by userId
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found',
                isLoggedIn: false
            };
        }

        // A user is considered logged in if login_time is more recent than logout_time
        const isLoggedIn = user.login_time && (!user.logout_time || user.login_time > user.logout_time);

        return {
            success: true,
            userId: user.userId,
            userName: user.user_name,
            isLoggedIn,
            lastLogin: user.login_time,
            lastLogout: user.logout_time
        };
    } catch (error) {
        console.error('Error in check status service:', error);
        throw error;
    }
}

/**
 * Get user's session history
 * @param {string} userId - The unique user ID
 * @returns {Promise<object>} Session history
 */
async function getSessionHistory(userId) {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Find user by userId
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Calculate session statistics
        const sessionHistory = user.sessionHistory || [];
        let totalSessionTime = 0;
        let averageSessionTime = 0;
        let longestSession = 0;
        
        if (sessionHistory.length > 0) {
            totalSessionTime = sessionHistory.reduce((sum, session) => sum + session.duration, 0);
            averageSessionTime = Math.round(totalSessionTime / sessionHistory.length * 10) / 10; // 1 decimal place
            longestSession = Math.max(...sessionHistory.map(session => session.duration));
        }

        return {
            success: true,
            userId: user.userId,
            userName: user.user_name,
            sessionCount: sessionHistory.length,
            totalSessionTimeMinutes: totalSessionTime,
            averageSessionTimeMinutes: averageSessionTime,
            longestSessionMinutes: longestSession,
            sessionHistory: sessionHistory.map(session => ({
                startTime: session.startTime,
                endTime: session.endTime,
                durationMinutes: session.duration,
                deviceInfo: session.deviceInfo
            }))
        };
    } catch (error) {
        console.error('Error in get session history service:', error);
        throw error;
    }
}

module.exports = {
    login,
    logout,
    checkStatus,
    getSessionHistory
}; 