const Log = require('../models/log');

/**
 * Create a new log entry
 * @param {string} eventType - Type of event from predefined list in Log model
 * @param {string|null} userId - User ID (optional for system logs)
 * @param {object} details - Additional event details
 * @param {object} requestInfo - Request information (optional)
 * @returns {Promise<object>} Created log entry
 */
async function createLog(eventType, userId = null, details = {}, requestInfo = {}) {
    try {
        // Create the log object
        const logData = {
            eventType,
            userId,
            timestamp: new Date(),
            details: details || {},
            ...requestInfo
        };
        
        // If userId is provided, try to get the username
        if (userId) {
            try {
                const User = require('../models/user');
                const user = await User.findOne({ userId });
                if (user) {
                    logData.userName = user.user_name;
                }
            } catch (err) {
                // If user lookup fails, continue without username
                console.error('Error getting username for logs:', err);
            }
        }

        // Create log entry
        const log = new Log(logData);
        await log.save();
        
        return log;
    } catch (error) {
        console.error('Error creating log:', error);
        // Even if logging fails, don't throw to avoid affecting application flow
        return null;
    }
}

/**
 * Create a log for user authentication events
 * @param {string} eventType - Type of auth event (USER_LOGIN, USER_LOGOUT, etc)
 * @param {string} userId - User ID
 * @param {object} details - Additional event details
 * @param {object} requestInfo - Request information (optional)
 * @returns {Promise<object>} Created log entry
 */
async function logAuthEvent(eventType, userId, details = {}, requestInfo = {}) {
    return createLog(eventType, userId, details, requestInfo);
}

/**
 * Create a log for game progression events
 * @param {string} eventType - Type of progression event
 * @param {string} userId - User ID
 * @param {object} details - Additional event details
 * @returns {Promise<object>} Created log entry
 */
async function logProgressionEvent(eventType, userId, details = {}) {
    return createLog(eventType, userId, details);
}

/**
 * Create a log for API requests
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {number} responseTime - Response time in ms
 * @returns {Promise<object>} Created log entry
 */
async function logApiRequest(req, res, responseTime) {
    try {
        if (!req || !res) {
            console.error('Invalid request or response objects in logApiRequest');
            return null;
        }

        // Extract userId from either params, query, or body
        const userId = (req.params && req.params.userId) || 
                       (req.query && req.query.userId) || 
                       (req.body && req.body.userId) ||
                       null;
        
        // Extract IP address
        const ipAddress = (req.headers && req.headers['x-forwarded-for']) || 
                          (req.connection && req.connection.remoteAddress) ||
                          null;
        
        // Create request info object
        const requestInfo = {
            requestPath: req.originalUrl || '',
            requestMethod: req.method || '',
            responseStatus: res.statusCode || 0,
            ipAddress,
            deviceInfo: req.body && req.body.deviceInfo
        };
        
        // Create log details
        const details = {
            responseTime,
            query: req.query || {},
            params: req.params || {},
            // Don't log entire request body for privacy/size reasons
            // but include essential, non-sensitive fields
            bodyFields: req.body ? Object.keys(req.body) : []
        };
        
        return createLog('API_REQUEST', userId, details, requestInfo);
    } catch (error) {
        console.error('Error in logApiRequest:', error);
        return null; // Don't throw to avoid affecting application flow
    }
}

/**
 * Create a log for system errors
 * @param {string} message - Error message
 * @param {object} error - Error object
 * @param {string} source - Source of error (component/module name)
 * @returns {Promise<object>} Created log entry
 */
async function logSystemError(message, error, source) {
    const details = {
        message,
        source,
        stack: error ? error.stack : null,
        errorMessage: error ? error.message : null
    };
    
    return createLog('SYSTEM_ERROR', null, details);
}

/**
 * Query logs based on criteria
 * @param {object} criteria - Query criteria like userId, eventType, date range
 * @param {object} options - Options like limit, skip, sort
 * @returns {Promise<Array>} Array of log entries
 */
async function queryLogs(criteria = {}, options = {}) {
    try {
        // Create query based on criteria
        const query = {};
        
        // Filter by userId if provided
        if (criteria.userId) {
            query.userId = criteria.userId;
        }
        
        // Filter by eventType if provided
        if (criteria.eventType) {
            query.eventType = criteria.eventType;
        }
        
        // Filter by date range if provided
        if (criteria.startDate || criteria.endDate) {
            query.timestamp = {};
            if (criteria.startDate) {
                query.timestamp.$gte = new Date(criteria.startDate);
            }
            if (criteria.endDate) {
                query.timestamp.$lte = new Date(criteria.endDate);
            }
        }
        
        // Set up query options
        const queryOptions = {
            limit: options.limit || 100,
            skip: options.skip || 0,
            sort: options.sort || { timestamp: -1 } // Default to newest first
        };
        
        // Execute query
        const logs = await Log.find(query)
            .limit(queryOptions.limit)
            .skip(queryOptions.skip)
            .sort(queryOptions.sort);
            
        // Get total count for pagination
        const totalCount = await Log.countDocuments(query);
        
        return {
            logs,
            totalCount,
            page: Math.floor(queryOptions.skip / queryOptions.limit) + 1,
            totalPages: Math.ceil(totalCount / queryOptions.limit),
            pageSize: queryOptions.limit
        };
    } catch (error) {
        console.error('Error querying logs:', error);
        throw error;
    }
}

module.exports = {
    createLog,
    logAuthEvent,
    logProgressionEvent,
    logApiRequest,
    logSystemError,
    queryLogs
}; 