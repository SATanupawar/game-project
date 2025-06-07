const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');
const SpinWheelReward = require('../models/spinTheWheel');
const CardPack = require('../models/cardPack');
const Creature = require('../models/creature');
const cardPackService = require('../service/cardPackService');

/**
 * @route   POST /api/spin-wheel/spin/:userId
 * @desc    Spin the wheel and get reward immediately
 * @access  Private
 */
router.post('/spin/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        // Generate a weighted random spin value (favoring 40-100)
        const spinValue = SpinWheelReward.generateWeightedSpin();
        
        // Get the reward based on the spin value
        const reward = await SpinWheelReward.getRewardBySpinValue(spinValue);
        
        if (!reward) {
            return res.status(500).json({
                success: false,
                message: 'Failed to determine reward for spin value'
            });
        }
        
        // Process reward based on type
        let updatedFields = {};
        let rewardDetails = null;
        
        switch(reward.reward_type) {
            case 'card_pack':
                // Instead of just adding card pack to inventory, open it immediately
                try {
                    console.log(`Opening card pack ${reward.reward_value} directly from spin wheel`);
                    
                    // Get card pack opening results
                    const openResult = await cardPackService.openCardPack(user._id, reward.reward_value);
                    
                    if (!openResult.success) {
                        console.error(`Failed to open card pack: ${openResult.message}`);
                        // Instead of returning an error response, fall back to adding the card pack to inventory
                        if (!user.card_packs) {
                            user.card_packs = [];
                        }
                        
                        user.card_packs.push({
                            pack_id: reward.reward_value,
                            name: reward.reward_value,
                            obtained_at: new Date(),
                            source: 'spin_wheel',
                            is_opened: false
                        });
                        
                        updatedFields = { card_packs: user.card_packs };
                        rewardDetails = { 
                            type: 'card_pack', 
                            pack_id: reward.reward_value,
                            added_to_inventory: true
                        };
                        
                        await user.save();
                        break;
                    }
                    
                    // Return the card pack opening results
                    rewardDetails = {
                        type: 'card_pack',
                        pack_id: reward.reward_value,
                        rewards: openResult.rewards || []
                    };
                    
                    // Update fields based on rewards received
                    updatedFields = {
                        gold_coins: user.gold_coins,
                        'currency.gems': user.currency?.gems,
                        'currency.anima': user.currency?.anima,
                        'currency.arcane_energy': user.currency?.arcane_energy
                    };
                    
                } catch (error) {
                    console.error('Error opening card pack:', error);
                    // Instead of returning an error response, fall back to adding the card pack to inventory
                    if (!user.card_packs) {
                        user.card_packs = [];
                    }
                    
                    user.card_packs.push({
                        pack_id: reward.reward_value,
                        name: reward.reward_value,
                        obtained_at: new Date(),
                        source: 'spin_wheel',
                        is_opened: false
                    });
                    
                    updatedFields = { card_packs: user.card_packs };
                    rewardDetails = { 
                        type: 'card_pack', 
                        pack_id: reward.reward_value,
                        added_to_inventory: true
                    };
                }
                break;
                
            case 'gold':
                // Add gold to user
                user.gold_coins = (user.gold_coins || 0) + reward.reward_value;
                updatedFields = { gold_coins: user.gold_coins };
                rewardDetails = { type: 'gold', amount: reward.reward_value };
                break;
                
            case 'arcane_energy':
                // Add arcane energy to user
                if (!user.currency) {
                    user.currency = {};
                }
                
                if (user.currency.arcane_energy === undefined) {
                    user.currency.arcane_energy = 0;
                }
                
                user.currency.arcane_energy += reward.reward_value;
                updatedFields = { 'currency.arcane_energy': user.currency.arcane_energy };
                rewardDetails = { type: 'arcane_energy', amount: reward.reward_value };
                break;
                
            case 'gems':
                // Add gems to user
                if (!user.currency) {
                    user.currency = {};
                }
                
                if (user.currency.gems === undefined) {
                    user.currency.gems = 0;
                }
                
                user.currency.gems += reward.reward_value;
                updatedFields = { 'currency.gems': user.currency.gems };
                rewardDetails = { type: 'gems', amount: reward.reward_value };
                break;
                
            case 'anima':
                // Add anima to user
                if (!user.currency) {
                    user.currency = {};
                }
                
                if (user.currency.anima === undefined) {
                    user.currency.anima = 0;
                }
                
                user.currency.anima += reward.reward_value;
                updatedFields = { 'currency.anima': user.currency.anima };
                rewardDetails = { type: 'anima', amount: reward.reward_value };
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid reward type'
                });
        }
        
        // Save user with updated rewards
        await user.save();
        
        // Generate a pure random number between 1-100 for display
        const displayNumber = Math.floor(Math.random() * 100) + 1;
        
        return res.status(200).json({
            success: true,
            message: 'Spin successful',
            reward: rewardDetails,
            user_updates: updatedFields
        });
    } catch (err) {
        console.error('Error in spin wheel:', err);
        return res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

/**
 * @route   GET /api/spin-wheel/rewards
 * @desc    Get all spin wheel rewards
 * @access  Private (or public, as needed)
 */
router.get('/rewards', async (req, res) => {
    try {
        const rewards = await SpinWheelReward.find({});
        res.status(200).json({
            success: true,
            rewards
        });
    } catch (err) {
        console.error('Error fetching spin wheel rewards:', err);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: err.message
        });
    }
});

module.exports = router; 