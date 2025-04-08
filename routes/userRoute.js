const express = require('express');
const router = express.Router();
const { updateUserGold, getBuildingGoldDetails } = require('../service/userService');
const userService = require('../service/userService');

// Get a user with buildings and creatures
router.get('/:userId', async (req, res) => {
    try {
        const user = await userService.getUserWithDetails(req.params.userId);
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/update-gold/:userId', async (req, res) => {
    try {
        const { previousGold, addedGold, totalGold, buildingContributions } = await updateUserGold(req.params.userId);
        res.json({ previousGold, addedGold, totalGold, buildingContributions });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get gold details for a specific building
router.get('/:userId/building/:buildingId', async (req, res) => {
    try {
        const { userId, buildingId } = req.params;
        const buildingDetails = await getBuildingGoldDetails(userId, buildingId);
        res.json(buildingDetails);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 
