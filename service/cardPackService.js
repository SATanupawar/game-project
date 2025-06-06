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
                    console.log(`Adding creature ${selectedReward.creature_name} to user's creature inventory`);
                    
                    // Find the creature in the database by name (case insensitive)
                    const creatureTemplate = await Creature.findOne({
                        name: { $regex: new RegExp('^' + selectedReward.creature_name + '$', 'i') }
                    });
                    
                    if (!creatureTemplate) {
                        console.log(`Warning: Creature template not found for ${selectedReward.creature_name}`);
                    }
                    
                    // Initialize creature_inventory array if it doesn't exist
                    if (!user.creature_inventory) {
                        user.creature_inventory = [];
                    }
                    
                    // Check if the creature already exists in the inventory
                    const creatureInInventory = user.creature_inventory.find(c => {
                        // First check for undefined creature_id
                        if (!c.creature_id) {
                            return c.name && c.name.toLowerCase() === selectedReward.creature_name.toLowerCase();
                        }
                        
                        // Safe toString comparison with nullish checks
                        if (creatureTemplate && creatureTemplate._id) {
                            return c.creature_id.toString() === creatureTemplate._id.toString();
                        }
                        
                        // Fallback to name comparison
                        return c.name && c.name.toLowerCase() === selectedReward.creature_name.toLowerCase();
                    });
                    
                    if (creatureInInventory) {
                        // Increment the count for existing creature
                        creatureInInventory.count += 1;
                        console.log(`Incremented count for ${selectedReward.creature_name} in inventory to ${creatureInInventory.count}`);
                    } else {
                        // Add new creature to inventory with all stats
                        const newInventoryItem = {
                            creature_id: creatureTemplate ? creatureTemplate._id : new mongoose.Types.ObjectId(),
                        creature_type: creatureTemplate ? creatureTemplate.creature_Id : 
                                      (selectedReward.creature_type || selectedReward.creature_name.toLowerCase().replace(/\s+/g, '_')),
                            name: selectedReward.creature_name,
                            count: 1,
                            rarity: creatureTemplate ? creatureTemplate.type : (selectedReward.rarity || 'common'),
                        image: creatureTemplate ? creatureTemplate.image : null,
                            // Add important stats
                            base_attack: creatureTemplate ? creatureTemplate.base_attack : 50,
                            base_health: creatureTemplate ? creatureTemplate.base_health : 300,
                            gold_coins: creatureTemplate ? creatureTemplate.gold_coins : 50,
                            arcane_energy: creatureTemplate ? creatureTemplate.arcane_energy : 99,
                            critical_damage: creatureTemplate ? creatureTemplate.critical_damage : 100,
                            critical_damage_percentage: creatureTemplate ? creatureTemplate.critical_damage_percentage : 25,
                            armor: creatureTemplate ? creatureTemplate.armor : 0,
                            speed: creatureTemplate ? creatureTemplate.speed : 100
                        };
                        
                        user.creature_inventory.push(newInventoryItem);
                        console.log(`Added new creature ${selectedReward.creature_name} to inventory with count 1`);
                    }
                    
                    // Mark the creature_inventory as modified
                    user.markModified('creature_inventory');
                    
                    // Increment creatures_obtained counter
                    if (user.card_stats && user.card_stats.creatures_obtained !== undefined) {
                        user.card_stats.creatures_obtained += 1;
                    }
                    
                    rewards.push({
                        type: 'creature',
                        creature_name: selectedReward.creature_name,
                        creature_id: creatureTemplate ? creatureTemplate._id.toString() : null,
                        creature_type: creatureTemplate ? creatureTemplate.creature_Id : selectedReward.creature_type,
                        rarity: creatureTemplate ? creatureTemplate.type : selectedReward.rarity,
                        card_number: card.card_number,
                        added_to_inventory: true,
                        // Add important stats to the response
                        base_attack: creatureTemplate ? creatureTemplate.base_attack : 50,
                        base_health: creatureTemplate ? creatureTemplate.base_health : 300,
                        gold_coins: creatureTemplate ? creatureTemplate.gold_coins : 50,
                        arcane_energy: creatureTemplate ? creatureTemplate.arcane_energy : 99
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
        user.markModified('creature_inventory'); // Mark creature_inventory as modified instead of creating_creatures
        
        // Remove locked_creatures to ensure we aren't using it anymore
        if (user.locked_creatures && user.locked_creatures.length > 0) {
            console.log(`Removing ${user.locked_creatures.length} locked creatures and adding them to creating_creatures array`);
            
            // Migrate any existing locked creatures to the creating_creatures array
            for (const lockedCreature of user.locked_creatures) {
                const migratedCreatureId = new mongoose.Types.ObjectId();
                
                // Try to find the creature template for this locked creature
                const creatureTemplate = await Creature.findOne({
                    name: { $regex: new RegExp('^' + lockedCreature.name + '$', 'i') }
                });
                
                // Set unlock time from creature template or use default
                const unlockTimeMinutes = creatureTemplate ? creatureTemplate.unlock_time : 10;
                const currentTime = new Date();
                const finishedTime = new Date(currentTime.getTime() + (unlockTimeMinutes * 60000));
                
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
                    count: 1,
                    // Add additional stats
                    critical_damage: creatureTemplate ? creatureTemplate.critical_damage : 100,
                    critical_damage_percentage: creatureTemplate ? creatureTemplate.critical_damage_percentage : 25,
                    armor: creatureTemplate ? creatureTemplate.armor : 0,
                    speed: creatureTemplate ? creatureTemplate.speed : 100,
                    // Add unlock-related fields
                    unlock_time: unlockTimeMinutes,
                    unlock_started: false, // Don't auto-start the unlock for card pack creatures
                    // Set placeholder future date - will be updated when unlock starts
                    started_time: new Date(currentTime.getTime() + 365 * 24 * 60 * 60 * 1000),
                    // Set a placeholder future date (1 year from now) - will be updated when unlock starts
                    finished_time: new Date(currentTime.getTime() + 365 * 24 * 60 * 60 * 1000),
                    anima_cost: creatureTemplate ? creatureTemplate.anima_cost : 80,
                    slot_number: null, // No slot for card pack creatures
                    building_index: 0 // Explicitly set building_index to 0 for card pack creatures
                };
                
                // Add to creating_creatures array
                if (!user.creating_creatures) {
                    user.creating_creatures = [];
                }
                user.creating_creatures.push(migratedCreature);
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
            message: `Successfully opened ${cardPack.pack_type}. Any creatures obtained need to have their unlock timer started and then unlocked.`,
            unlock_instructions: "Any creatures obtained from this card pack have been added to your creating_creatures array. Use startCreatureUnlock API to start the timer, then unlockCreature API when the timer finishes."
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