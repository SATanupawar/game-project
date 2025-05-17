const express = require('express');
const router = express.Router();
const logService = require('../service/logService');

/**
 * @route GET /api/logs
 * @desc Get all logs with filtering options
 */
router.get('/', async (req, res) => {
    try {
        // Extract query parameters for filtering
        const {
            userId,
            eventType,
            startDate,
            endDate,
            page = 1,
            limit = 100,
            sortField = 'timestamp',
            sortOrder = 'desc'
        } = req.query;
        
        // Build criteria object for filtering
        const criteria = {};
        if (userId) criteria.userId = userId;
        if (eventType) criteria.eventType = eventType;
        if (startDate) criteria.startDate = startDate;
        if (endDate) criteria.endDate = endDate;
        
        // Build options object for pagination and sorting
        const options = {
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            sort: { [sortField]: sortOrder === 'asc' ? 1 : -1 }
        };
        
        // Query the logs
        const result = await logService.queryLogs(criteria, options);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error retrieving logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving logs',
            error: error.message
        });
    }
});

/**
 * @route GET /api/logs/user/:userId
 * @desc Get logs for a specific user
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            eventType,
            startDate,
            endDate,
            page = 1,
            limit = 100
        } = req.query;
        
        // Build criteria object
        const criteria = { userId };
        if (eventType) criteria.eventType = eventType;
        if (startDate) criteria.startDate = startDate;
        if (endDate) criteria.endDate = endDate;
        
        // Build options object
        const options = {
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            sort: { timestamp: -1 }
        };
        
        // Query user logs
        const result = await logService.queryLogs(criteria, options);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error retrieving user logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving user logs',
            error: error.message
        });
    }
});

/**
 * @route GET /api/logs/events/:eventType
 * @desc Get logs for a specific event type
 */
router.get('/events/:eventType', async (req, res) => {
    try {
        const { eventType } = req.params;
        const {
            startDate,
            endDate,
            page = 1,
            limit = 100
        } = req.query;
        
        // Build criteria object
        const criteria = { eventType };
        if (startDate) criteria.startDate = startDate;
        if (endDate) criteria.endDate = endDate;
        
        // Build options object
        const options = {
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            sort: { timestamp: -1 }
        };
        
        // Query event logs
        const result = await logService.queryLogs(criteria, options);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error retrieving event logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving event logs',
            error: error.message
        });
    }
});

/**
 * @route GET /api/logs/errors
 * @desc Get all system error logs
 */
router.get('/errors', async (req, res) => {
    try {
        const { page = 1, limit = 100 } = req.query;
        
        // Build criteria object
        const criteria = { eventType: 'SYSTEM_ERROR' };
        
        // Build options object
        const options = {
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            sort: { timestamp: -1 }
        };
        
        // Query error logs
        const result = await logService.queryLogs(criteria, options);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error retrieving error logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving error logs',
            error: error.message
        });
    }
});

module.exports = router; 