const User = require('../models/user');
const Building = require('../models/building');
const Creature = require('../models/creature');
const mongoose = require('mongoose');

async function getUserWithDetails(userIdParam) {
    try {
        // Try to find by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'buildings',
            populate: { path: 'creature_id' }
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'buildings',
                populate: { path: 'creature_id' }
            });
        }

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    } catch (error) {
        throw error;
    }
}

async function updateUserGold(userIdParam) {
    try {
        // Try to find by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'buildings',
            populate: { path: 'creature_id' }
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'buildings',
                populate: { path: 'creature_id' }
            });
        }

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
                goldGenerated: goldGenerated.toFixed(2) // Show two decimal places
            });
        });

        const previousGold = user.gold_coins;
        const addedGold = totalGoldGenerated.toFixed(2); // Show two decimal places
        const totalGold = previousGold + parseFloat(addedGold);

        user.gold_coins = totalGold;
        user.logout_time = currentTime; // Update logout time to current time
        await user.save();

        return { previousGold, addedGold, totalGold, buildingContributions };
    } catch (error) {
        throw error;
    }
}

async function getBuildingGoldDetails(userIdParam, buildingId) {
    try {
        // Try to find by userId first
        let user = await User.findOne({ userId: userIdParam }).populate({
            path: 'buildings',
            populate: { path: 'creature_id' }
        });

        // If not found, try to find by MongoDB _id
        if (!user && mongoose.Types.ObjectId.isValid(userIdParam)) {
            user = await User.findById(userIdParam).populate({
                path: 'buildings',
                populate: { path: 'creature_id' }
            });
        }

        if (!user) {
            throw new Error('User not found');
        }

        // Try to find by buildingId or _id
        let building = user.buildings.find(b => b.buildingId === buildingId);
        
        // If not found and valid ObjectId, try by _id
        if (!building && mongoose.Types.ObjectId.isValid(buildingId)) {
            building = user.buildings.find(b => b._id.toString() === buildingId);
        }

        if (!building) {
            throw new Error('Building not found');
        }

        const currentTime = new Date();
        const timeDifference = (currentTime - user.logout_time) / (1000 * 60 * 60); // Convert to hours

        let goldGenerated = 0;
        if (building.creature_id) {
            // Calculate gold from creatures
            const creature = building.creature_id;
            const goldPerHour = creature.gold_coins; // Ensure this field exists and is correct
            goldGenerated = goldPerHour * timeDifference;
        } else {
            // Calculate gold from building itself
            const buildingGoldPerHour = building.gold_coins; // Use the building's gold_coins
            goldGenerated = buildingGoldPerHour * timeDifference;
        }

        const previousGold = user.gold_coins;
        const addedGold = goldGenerated.toFixed(2); // Show two decimal places
        const totalGold = previousGold + parseFloat(addedGold);

        // Update user's gold coins and logout time
        user.gold_coins = totalGold;
        user.logout_time = currentTime;
        await user.save();

        return {
            buildingId: building.buildingId,
            name: building.name,
            position: building.position,
            previousGold,
            addedGold,
            totalGold
        };
    } catch (error) {
        throw error;
    }
}

module.exports = {
    getUserWithDetails,
    updateUserGold,
    getBuildingGoldDetails
};
