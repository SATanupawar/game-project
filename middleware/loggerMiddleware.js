const logService = require('../service/logService');

/**
 * Middleware to log all API requests
 */
function requestLogger(req, res, next) {
    // Record request start time
    const requestStartTime = Date.now();
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override the end function to log the request after it completes
    res.end = function(chunk, encoding) {
        // Calculate response time
        const responseTime = Date.now() - requestStartTime;
        
        // Restore original end function
        res.end = originalEnd;
        
        // Call original end function
        res.end(chunk, encoding);
        
        // Log the request (async, don't wait for it)
        logService.logApiRequest(req, res, responseTime).catch(error => {
            console.error('Error logging API request:', error);
        });
    };
    
    // Continue to next middleware
    next();
}

/**
 * Middleware to handle errors and log them
 */
function errorLogger(err, req, res, next) {
    // Log the error (async, don't wait for it)
    logService.logSystemError('API Error', err, req.originalUrl).catch(error => {
        console.error('Error logging API error:', error);
    });
    
    // Pass to next error handler
    next(err);
}

module.exports = {
    requestLogger,
    errorLogger
}; 