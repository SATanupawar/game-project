const express = require('express');
const router = express.Router();
const { updateUserGold } = require('../service/userService');
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

module.exports = router;
