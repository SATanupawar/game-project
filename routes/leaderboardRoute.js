const express = require('express');
const router = express.Router();
const User = require('../models/user');
const redisClient = require('../service/redisService');

// Update player score
router.post('/player/update-score', async (req, res) => {
  try {
    const { userId, username, trophies } = req.body;
    
    if (!userId || typeof trophies !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'User ID and trophies are required'
      });
    }
    
    console.log(`Updating score for ${userId} with additional ${trophies} trophies`);
    
    // Find current user to get existing trophies
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Add new trophies to existing ones
    const currentTrophies = user.trophy_count || 0;
    const newTotalTrophies = currentTrophies + trophies;
    
    console.log(`Current trophies: ${currentTrophies}, New total: ${newTotalTrophies}`);
    
    // Update MongoDB with total trophies
    await User.findOneAndUpdate({ userId }, { 
      $set: { trophy_count: newTotalTrophies } 
    });
    
    // Update Redis with new total trophies
    await redisClient.zAdd('leaderboard:global', [
      { score: newTotalTrophies, value: userId }
    ]);
    
    res.status(200).json({ 
      success: true,
      data: {
        userId,
        previousTrophies: currentTrophies,
        addedTrophies: trophies,
        newTotalTrophies: newTotalTrophies
      }
    });
  } catch (error) {
    console.error('Error updating player score:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating player score',
      error: error.message
    });
  }
});

// Get top 500 players
router.get('/leaderboard/top', async (req, res) => {
  try {
    console.log('Getting top players from leaderboard');
    
    // Get all users from MongoDB with trophy counts
    const users = await User.find({}, { 
      userId: 1, 
      user_name: 1, 
      trophy_count: 1, 
      profile_picture: 1,
      level: 1,
      title: 1,
      _id: 0 
    }).sort({ trophy_count: -1 }).limit(500);
    
    console.log(`Fetched ${users.length} users from MongoDB sorted by trophy_count`);
    
    // Create leaderboard with proper ranks
    const leaderboard = [];
    let currentRank = 1;
    let previousTrophies = -1;
    
    for (const user of users) {
      // If trophy count is different from previous user, increment rank
      if (user.trophy_count !== previousTrophies) {
        currentRank = leaderboard.length + 1;
        previousTrophies = user.trophy_count;
      }
      
      leaderboard.push({
        rank: currentRank,
        userId: user.userId,
        username: user.user_name,
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      });
    }
    
    // Update Redis leaderboard to ensure it matches MongoDB
    for (const user of users) {
      await redisClient.zAdd('leaderboard:global', [
        { score: user.trophy_count || 0, value: user.userId }
      ]);
    }
    
    res.status(200).json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Error getting top players:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting top players',
      error: error.message
    });
  }
});

// Get player rank
router.get('/leaderboard/rank/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Getting rank for user: ${userId}`);
    
    // Get player data from MongoDB
    const user = await User.findOne({ userId }, {
      userId: 1,
      user_name: 1,
      trophy_count: 1,
      profile_picture: 1,
      level: 1,
      title: 1,
      _id: 0
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }
    
    // Get all users with higher or equal trophy count
    const higherRankedCount = await User.countDocuments({
      trophy_count: { $gt: user.trophy_count }
    });
    
    // Calculate rank (1-based)
    const rank = higherRankedCount + 1;
    
    console.log(`User: ${userId}, Calculated Rank: ${rank}, Trophies: ${user.trophy_count}`);
    
    // Update Redis to ensure consistency
    await redisClient.zAdd('leaderboard:global', [
      { score: user.trophy_count || 0, value: userId }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        rank: rank,
        userId: user.userId,
        username: user.user_name || 'Unknown',
        trophies: user.trophy_count || 0,
        profilePicture: user.profile_picture || 'default.jpg',
        level: user.level || 1,
        title: user.title || ''
      }
    });
  } catch (error) {
    console.error('Error getting player rank:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting player rank',
      error: error.message
    });
  }
});

module.exports = router;
