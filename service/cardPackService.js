const mongoose = require('mongoose');
const CardPack = require('../models/cardPack');
const User = require('../models/user');
const Creature = require('../models/creature');

/**
 * Opens a card pack for a user based on pack type
 * @param {string} userId - The ID of the user opening the pack
 * @param {string} packId - The ID of the pack to open
 * @returns {Promise<Object>} - The rewards from opening the pack
 */
async function openCardPack(userId, packId) {
    try {
        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Initialize currency if it doesn't exist
        if (!user.currency) {
            user.currency = {
                gems: 0,
                arcane_energy: 0,
                anima: 0,
                gold: user.gold_coins || 0,
                last_updated: new Date()
            };
        }

        // Find the card pack
        const cardPack = await CardPack.findOne({ pack_id: packId });
        if (!cardPack) {
            return { success: false, message: 'Card pack not found' };
        }

        // Remove currency validation - allow opening any pack regardless of cost
        // Just log that we would normally deduct currency
        if (cardPack.cost > 0) {
            console.log(`Opening ${cardPack.pack_type} would normally cost ${cardPack.cost} ${cardPack.currency_type}, but validation is disabled`);
        }

        // Process each card in the pack
        const rewards = [];
        
        for (const card of cardPack.cards) {
            // Generate a random number between 0 and 100
            const randomNum = Math.random() * 100;
            
            // Find the reward based on probability range
            let selectedReward = null;
            
            for (const reward of card.rewards) {
                if (
                    randomNum >= reward.probability_range.min && 
                    randomNum < reward.probability_range.max
                ) {
                    selectedReward = reward;
                    break;
                }
            }
            
            if (selectedReward) {
                // Process the reward
                if (selectedReward.reward_type === 'resource') {
                    console.log(`Adding ${selectedReward.amount} ${selectedReward.resource_type} to user`);
                    
                    // Add resources to user
                    switch (selectedReward.resource_type) {
                        case 'gems':
                            if (!user.currency) user.currency = {};
                            user.currency.gems = (user.currency.gems || 0) + selectedReward.amount;
                            break;
                        case 'gold':
                            user.gold_coins = (user.gold_coins || 0) + selectedReward.amount;
                            if (!user.currency) user.currency = {};
                            user.currency.gold = (user.currency.gold || 0) + selectedReward.amount;
                            break;
                        case 'anima':
                            if (!user.currency) user.currency = {};
                            user.currency.anima = (user.currency.anima || 0) + selectedReward.amount;
                            break;
                        case 'arcane_energy':
                            if (!user.currency) user.currency = {};
                            user.currency.arcane_energy = (user.currency.arcane_energy || 0) + selectedReward.amount;
                            break;
                    }
                    
                    rewards.push({
                        type: 'resource',
                        resource_type: selectedReward.resource_type,
                        amount: selectedReward.amount,
                        card_number: card.card_number
                    });
                } else if (selectedReward.reward_type === 'creature') {
                    // Fetch complete creature data from the database
                    console.log(`Adding creature ${selectedReward.creature_name} to user's creatures array`);
                    
                    // Find the creature in the database by name (case insensitive)
                    const creatureTemplate = await Creature.findOne({
                        name: { $regex: new RegExp('^' + selectedReward.creature_name + '$', 'i') }
                    });
                    
                    if (!creatureTemplate) {
                        console.log(`Warning: Creature template not found for ${selectedReward.creature_name}`);
                    }
                    
                    const creatureId = new mongoose.Types.ObjectId();
                    
                    // Create creature with complete data from template if found
                    const newCreature = {
                        _id: creatureId,
                        creature_id: creatureId,
                        name: selectedReward.creature_name,
                        creature_type: creatureTemplate ? creatureTemplate.creature_Id : 
                                      (selectedReward.creature_type || selectedReward.creature_name.toLowerCase().replace(/\s+/g, '_')),
                        type: creatureTemplate ? creatureTemplate.type : (selectedReward.rarity || 'common'),
                        level: 1,
                        building_index: 0, // Default building index
                        base_attack: creatureTemplate ? creatureTemplate.base_attack : (selectedReward.base_attack || 50),
                        base_health: creatureTemplate ? creatureTemplate.base_health : (selectedReward.base_health || 300),
                        attack: creatureTemplate ? creatureTemplate.base_attack : (selectedReward.base_attack || 50),
                        health: creatureTemplate ? creatureTemplate.base_health : (selectedReward.base_health || 300),
                        gold_coins: creatureTemplate ? creatureTemplate.gold_coins : 0,
                        arcane_energy: creatureTemplate ? creatureTemplate.arcane_energy : 0,
                        image: creatureTemplate ? creatureTemplate.image : null,
                        description: creatureTemplate ? creatureTemplate.description : `A mysterious ${selectedReward.creature_name}`,
                        unlock_level: creatureTemplate ? creatureTemplate.unlock_level : 1,
                        count: 1
                    };
                    
                    // If we have level stats from the template, add the level 1 stats
                    if (creatureTemplate && creatureTemplate.level_stats && creatureTemplate.level_stats.length > 0) {
                        const level1Stats = creatureTemplate.level_stats.find(stat => stat.level === 1);
                        if (level1Stats) {
                            newCreature.attack = level1Stats.attack;
                            newCreature.health = level1Stats.health;
                            newCreature.gold_coins = level1Stats.gold || creatureTemplate.gold_coins;
                            newCreature.arcane_energy = level1Stats.arcane_energy || creatureTemplate.arcane_energy;
                        }
                    }
                    
                    // Add to creatures array
                    if (!user.creatures) {
                        user.creatures = [];
                    }
                    user.creatures.push(newCreature);
                    
                    // Increment creatures_obtained counter
                    if (user.card_stats && user.card_stats.creatures_obtained !== undefined) {
                        user.card_stats.creatures_obtained += 1;
                    }
                    
                    rewards.push({
                        type: 'creature',
                        creature_name: selectedReward.creature_name,
                        creature_id: creatureId.toString(),
                        rarity: selectedReward.rarity,
                        card_number: card.card_number,
                        complete_data: !!creatureTemplate // Flag indicating if we got complete data
                    });
                }
            }
        }
        
        // Update card stats
        if (!user.card_stats) {
            user.card_stats = {
                total_packs_opened: 0,
                free_packs_opened: 0,
                common_packs_opened: 0,
                rare_packs_opened: 0,
                epic_packs_opened: 0,
                legendary_packs_opened: 0,
                creatures_obtained: 0
            };
        }
        
        // Increment total packs opened
        user.card_stats.total_packs_opened = (user.card_stats.total_packs_opened || 0) + 1;
        
        // Increment specific pack type counter
        const packTypeKey = cardPack.pack_type.toLowerCase().replace(' ', '_') + '_packs_opened';
        if (user.card_stats[packTypeKey] !== undefined) {
            user.card_stats[packTypeKey] += 1;
        }
        
        // Update last opened timestamp
        if (!user.last_opened_packs) {
            user.last_opened_packs = {};
        }
        user.last_opened_packs[cardPack.pack_id] = new Date();
        
        // Mark modified nested objects
        user.markModified('currency');
        user.markModified('card_stats');
        user.markModified('last_opened_packs');
        user.markModified('creatures');
        
        // Remove locked_creatures to ensure we aren't using it anymore
        if (user.locked_creatures && user.locked_creatures.length > 0) {
            console.log(`Removing ${user.locked_creatures.length} locked creatures and adding them to main creatures array`);
            
            // Migrate any existing locked creatures to the main creatures array
            for (const lockedCreature of user.locked_creatures) {
                const migratedCreatureId = new mongoose.Types.ObjectId();
                
                // Try to find the creature template for this locked creature
                const creatureTemplate = await Creature.findOne({
                    name: { $regex: new RegExp('^' + lockedCreature.name + '$', 'i') }
                });
                
                const migratedCreature = {
                    _id: migratedCreatureId,
                    creature_id: migratedCreatureId,
                    name: lockedCreature.name,
                    creature_type: creatureTemplate ? creatureTemplate.creature_Id : 
                                 (lockedCreature.creature_type || lockedCreature.name.toLowerCase().replace(/\s+/g, '_')),
                    type: creatureTemplate ? creatureTemplate.type : 'common',
                    level: lockedCreature.level || 1,
                    building_index: 0, // Default building index
                    base_attack: creatureTemplate ? creatureTemplate.base_attack : 50,
                    base_health: creatureTemplate ? creatureTemplate.base_health : 300,
                    attack: creatureTemplate ? creatureTemplate.base_attack : 50,
                    health: creatureTemplate ? creatureTemplate.base_health : 300,
                    gold_coins: creatureTemplate ? creatureTemplate.gold_coins : 0,
                    arcane_energy: creatureTemplate ? creatureTemplate.arcane_energy : 0,
                    image: creatureTemplate ? creatureTemplate.image : null,
                    description: creatureTemplate ? creatureTemplate.description : `A mysterious ${lockedCreature.name}`,
                    unlock_level: creatureTemplate ? creatureTemplate.unlock_level : 1,
                    count: 1
                };
                
                // Add to creatures array
                user.creatures.push(migratedCreature);
            }
            
            // Clear locked_creatures array
            user.locked_creatures = [];
            user.markModified('locked_creatures');
        }
        
        // IMPORTANT: Force the locked_creatures array to be empty
        // This ensures no new creatures can be added to it
        user.locked_creatures = [];
        user.markModified('locked_creatures');
        
        // Save the updated user
        await user.save();
        
        return {
            success: true,
            pack_type: cardPack.pack_type,
            rewards: rewards,
            message: `Successfully opened ${cardPack.pack_type}`
        };
    } catch (error) {
        console.error('Error opening card pack:', error);
        return { success: false, message: 'Error opening card pack', error: error.message };
    }
}

/**
 * Get available card packs for a user
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object>} - Available card packs
 */
async function getAvailableCardPacks(userId) {
    try {
        // Find the user to check their currency
        const user = await User.findById(userId);
        if (!user) {
            return { success: false, message: 'User not found' };
        }

        // Initialize currency if it doesn't exist
        if (!user.currency) {
            user.currency = {
                gems: 0,
                arcane_energy: 0,
                anima: 0,
                gold: user.gold_coins || 0,
                last_updated: new Date()
            };
        }

        // Get all available card packs
        const cardPacks = await CardPack.find({ available: true });
        
        // Mark all packs as affordable (currency validation disabled)
        const packsWithAffordability = cardPacks.map(pack => {
            return {
                pack_id: pack.pack_id,
                pack_type: pack.pack_type,
                description: pack.description,
                cost: pack.cost,
                currency_type: pack.currency_type,
                can_afford: true // Always allow packs to be purchased
            };
        });
        
        return {
            success: true,
            user_currency: {
                gems: user.currency.gems || 0,
                gold: user.gold_coins || 0,
                anima: user.currency.anima || 0,
                arcane_energy: user.currency.arcane_energy || 0
            },
            available_packs: packsWithAffordability
        };
    } catch (error) {
        console.error('Error getting available card packs:', error);
        return { success: false, message: 'Error getting available card packs', error: error.message };
    }
}

/**
 * Get a specific card pack details
 * @param {string} packId - The ID of the pack
 * @returns {Promise<Object>} - Card pack details
 */
async function getCardPackDetails(packId) {
    try {
        const cardPack = await CardPack.findOne({ pack_id: packId });
        
        if (!cardPack) {
            return { success: false, message: 'Card pack not found' };
        }
        
        // Format the response to show only the necessary information
        const formattedPack = {
            pack_id: cardPack.pack_id,
            pack_type: cardPack.pack_type,
            description: cardPack.description,
            cost: cardPack.cost,
            currency_type: cardPack.currency_type,
            possible_rewards: {
                resources: [],
                creatures: []
            }
        };
        
        // Extract unique resources and creatures from all cards
        if (cardPack.cards && cardPack.cards.length > 0) {
            for (const card of cardPack.cards) {
                if (card.rewards && card.rewards.length > 0) {
                    for (const reward of card.rewards) {
                        if (reward.reward_type === 'resource') {
                            // Check if this resource type is already in the array
                            const existingResource = formattedPack.possible_rewards.resources.find(
                                r => r.resource_type === reward.resource_type
                            );
                            
                            if (!existingResource) {
                                formattedPack.possible_rewards.resources.push({
                                    resource_type: reward.resource_type,
                                    min_amount: reward.amount,
                                    max_amount: reward.amount
                                });
                            } else {
                                // Update min/max values
                                if (reward.amount < existingResource.min_amount) {
                                    existingResource.min_amount = reward.amount;
                                }
                                if (reward.amount > existingResource.max_amount) {
                                    existingResource.max_amount = reward.amount;
                                }
                            }
                        } else if (reward.reward_type === 'creature') {
                            // Add unique creatures by name and rarity
                            const existingCreature = formattedPack.possible_rewards.creatures.find(
                                c => c.creature_name === reward.creature_name
                            );
                            
                            if (!existingCreature) {
                                formattedPack.possible_rewards.creatures.push({
                                    creature_name: reward.creature_name,
                                    rarity: reward.rarity
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return { success: true, pack_details: formattedPack };
    } catch (error) {
        console.error('Error getting card pack details:', error);
        return { success: false, message: 'Error getting card pack details', error: error.message };
    }
}

module.exports = {
    openCardPack,
    getAvailableCardPacks,
    getCardPackDetails
}; 