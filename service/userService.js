const User = require('../models/User');
const Building = require('../models/building');
const Creature = require('../models/creature');

async function getUserWithDetails(userId) {
    try {
        const user = await User.findOne({ userId }).populate({
            path: 'buildings',
            populate: { path: 'creature_id' }
        });

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    } catch (error) {
        throw error;
    }
}

async function updateUserGold(userId) {
    try {
        const user = await User.findOne({ userId }).populate({
            path: 'buildings',
            populate: { path: 'creature_id' }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const currentTime = new Date();
        const timeDifference = (currentTime - user.logout_time) / (1000 * 60 * 60); // Convert to hours

        let totalGoldGenerated = 0;
        const buildingContributions = [];

        user.buildings.forEach(building => {
            let goldGenerated = 0;
            if (building.creature_id) {
                // Calculate gold from creatures
                const creature = building.creature_id;
                console.log('Creature:', creature); // Debugging log
                const goldPerHour = creature.gold_coins; // Ensure this field exists and is correct
                goldGenerated = goldPerHour * timeDifference;
            } else {
                // Calculate gold from building itself
                const buildingGoldPerHour = building.gold_coins; // Use the building's gold_coins
                goldGenerated = buildingGoldPerHour * timeDifference;
            }
            totalGoldGenerated += goldGenerated;
            buildingContributions.push({
                buildingId: building.buildingId,
                name: building.name,
                goldGenerated: Math.floor(goldGenerated)
            });
        });

        const previousGold = user.gold_coins;
        const addedGold = Math.floor(totalGoldGenerated);
        const totalGold = previousGold + addedGold;

        user.gold_coins = totalGold;
        user.logout_time = currentTime; // Update logout time to current time
        await user.save();

        return { previousGold, addedGold, totalGold, buildingContributions };
    } catch (error) {
        throw error;
    }
}

module.exports = {
    getUserWithDetails,
    updateUserGold
};
