const express = require('express');
const router = express.Router();
const gameLiftService = require('../service/gameLiftService');

/**
 * @route GET /api/game-logs
 * @description Get pre-signed URL for game session logs
 * @access Private
 */
router.get('/game-logs', async (req, res) => {
  try {
    const { userId, sessionId } = req.query;
    
    if (!userId || !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Session ID are required'
      });
    }
    
    // Get log URL from GameLift service
    const result = await gameLiftService.getGameSessionLogUrl(userId, sessionId);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting game logs:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error retrieving game session logs',
      error: error.message
    });
  }
});

module.exports = router; 