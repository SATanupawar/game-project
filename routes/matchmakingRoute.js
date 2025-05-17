const express = require('express');
const router = express.Router();
const gameLiftService = require('../service/gameLiftService');

/**
 * @route POST /api/matchmaking/ticket
 * @desc Create a new matchmaking ticket
 * @access Public
 */
router.post('/ticket', async (req, res) => {
    try {
        const { userId, playerAttributes, playerIds } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        // Validate player attributes
        if (!playerAttributes || typeof playerAttributes !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Player attributes are required'
            });
        }

        // Create matchmaking ticket
        const result = await gameLiftService.createMatchmakingTicket(
            userId, 
            playerAttributes, 
            playerIds || []
        );

        console.log('Matchmaking ticket created:', JSON.stringify(result, null, 2));
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Error creating matchmaking ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating matchmaking ticket',
            error: error.message
        });
    }
});

/**
 * @route GET /api/matchmaking/ticket/:ticketId
 * @desc Check the status of a matchmaking ticket
 * @access Public
 */
router.get('/ticket/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!ticketId) {
            return res.status(400).json({
                success: false,
                message: 'Ticket ID is required'
            });
        }

        // Detect placeholder ticket IDs
        if (ticketId === ':ticketId' || ticketId === '{ticketId}' || 
            ticketId.includes(':') || ticketId.includes('{')) {
            console.error(`ERROR: Placeholder ticketId detected: ${ticketId}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid ticket ID format - using a placeholder',
                ticketId
            });
        }

        // Check if ticket ID looks truncated (UUID pattern has 5 sections with dashes)
        const isTruncated = ticketId.startsWith('ticket-') && ticketId.split('-').length < 6;
        if (isTruncated) {
            console.warn(`WARNING: Likely truncated ticket ID detected: ${ticketId}`);
            res.set('X-Warning', 'Truncated ticket ID detected');
            res.set('X-Recommendation', 'Use the full ticket ID for reliable results');
        }

        // Check matchmaking ticket
        const result = await gameLiftService.checkMatchmakingTicket(userId, ticketId);

        console.log('Matchmaking ticket checked:', JSON.stringify(result, null, 2));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error checking matchmaking ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking matchmaking ticket',
            error: error.message
        });
    }
});

/**
 * @route DELETE /api/matchmaking/ticket/:ticketId
 * @desc Cancel a matchmaking ticket
 * @access Public
 */
router.delete('/ticket/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!ticketId) {
            return res.status(400).json({
                success: false,
                message: 'Ticket ID is required'
            });
        }

        // Detect placeholder ticket IDs
        if (ticketId === ':ticketId' || ticketId === '{ticketId}' || 
            ticketId.includes(':') || ticketId.includes('{')) {
            console.error(`ERROR: Placeholder ticketId detected in cancel request: ${ticketId}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid ticket ID format - using a placeholder',
                ticketId
            });
        }

        // Cancel matchmaking ticket
        const result = await gameLiftService.cancelMatchmakingTicket(userId, ticketId);

        console.log('Matchmaking ticket cancelled:', JSON.stringify(result, null, 2));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error cancelling matchmaking ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling matchmaking ticket',
            error: error.message
        });
    }
});

/**
 * @route POST /api/matchmaking/match/accept
 * @desc Accept or reject a match
 * @access Public
 */
router.post('/match/accept', async (req, res) => {
    try {
        const { userId, ticketId, matchId, acceptanceStatus } = req.body;

        if (!userId || !ticketId || !matchId) {
            return res.status(400).json({
                success: false,
                message: 'User ID, Ticket ID, and Match ID are required'
            });
        }

        // Accept or reject match
        const result = await gameLiftService.acceptMatch(
            userId, 
            ticketId, 
            matchId, 
            acceptanceStatus || 'ACCEPT'
        );

        console.log('Match acceptance response:', JSON.stringify(result, null, 2));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error accepting match:', error);
        res.status(500).json({
            success: false,
            message: 'Error accepting match',
            error: error.message
        });
    }
});

/**
 * @route GET /api/matchmaking/match/:matchId
 * @desc Get match details
 * @access Public
 */
router.get('/match/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        if (!matchId) {
            return res.status(400).json({
                success: false,
                message: 'Match ID is required'
            });
        }

        // Detect placeholder match IDs
        if (matchId === ':matchId' || matchId === '{matchId}' || 
            matchId.includes(':') || matchId.includes('{')) {
            console.error(`ERROR: Placeholder matchId detected: ${matchId}`);
            return res.status(400).json({
                success: false,
                message: 'Invalid match ID format - using a placeholder',
                matchId
            });
        }

        // Get match details
        const result = await gameLiftService.getMatchDetails(userId, matchId);

        console.log('Match details retrieved:', JSON.stringify(result, null, 2));

        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting match details:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting match details',
            error: error.message
        });
    }
});

module.exports = router; 