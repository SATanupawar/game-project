const mongoose = require('mongoose');
const ChestCard = require('../models/chestCard');

// MongoDB connection
mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Connected');
    initializeChests();
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});

async function initializeChests() {
    try {
        // Check if we should recreate all chests
        const RECREATE_CHESTS = process.env.RECREATE_CHESTS === 'true';

        if (RECREATE_CHESTS) {
            // Delete all existing chests
            await ChestCard.deleteMany({});
            console.log('Deleted all existing chests');
        } else {
            console.log('Adding chests without deleting existing ones');
            console.log('To recreate all chests, set RECREATE_CHESTS=true');
        }

        // Define common chest card
        const commonChest = {
            chest_id: 'common_chest',
            type: 'common',
            chance: 85,
            probability_range: { min: 16, max: 100 },
            image_url: '/images/chests/default.png',
            drop_chance: 10,
            unlock_time_minutes: 10, // 10 minutes
            cards: [
                // Card 1
                {
                    card_number: 1,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 10,
                            chance: 50,
                            probability_range: { min: 0, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 45,
                            chance: 50,
                            probability_range: { min: 50, max: 100 }
                        }
                    ]
                },
                // Card 2
                {
                    card_number: 2,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gold',
                            amount: 10110,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 45,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 10,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 8210,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 3
                {
                    card_number: 3,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gold',
                            amount: 10110,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 45,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 10,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 8210,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 4
                {
                    card_number: 4,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gold',
                            amount: 10110,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 45,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 10,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 8210,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                }
            ]
        };

        // Define rare chest card
        const rareChest = {
            chest_id: 'rare_chest',
            type: 'rare',
            chance: 10,
            probability_range: { min: 6, max: 15 },
            image_url: '/images/chests/default.png',
            drop_chance: 10,
            unlock_time_minutes: 60, // 1 hour
            cards: [
                // Card 1
                {
                    card_number: 1,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 100,
                            chance: 50,
                            probability_range: { min: 0, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 200,
                            chance: 50,
                            probability_range: { min: 50, max: 100 }
                        }
                    ]
                },
                // Card 2
                {
                    card_number: 2,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gold',
                            amount: 24860,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 100,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 100,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 19520,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 3
                {
                    card_number: 3,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gold',
                            amount: 24860,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 100,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 100,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 19520,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 4 (Creatures)
                {
                    card_number: 4,
                    rewards: [
                        {
                            reward_type: 'creature',
                            creature_name: 'Coral Wyvern',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Corrupted Oni',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Luminous Manticore',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Sand Djinn',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Vapor Drake',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Stone Gargoyle',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Crystalline Behemoth',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Void Dragon',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Storm Dragon',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Gilded Tulpar',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 90, max: 100 }
                        }
                    ]
                }
            ]
        };

        // Define epic chest card
        const epicChest = {
            chest_id: 'epic_chest',
            type: 'epic',
            chance: 5,
            probability_range: { min: 1, max: 5 },
            image_url: '/images/chests/default.png',
            drop_chance: 10,
            unlock_time_minutes: 480, // 8 hours
            cards: [
                // Card 1
                {
                    card_number: 1,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 250,
                            chance: 50,
                            probability_range: { min: 0, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 450,
                            chance: 50,
                            probability_range: { min: 50, max: 100 }
                        }
                    ]
                },
                // Card 2
                {
                    card_number: 2,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gold',
                            amount: 49720,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 200,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 250,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 39040,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 3
                {
                    card_number: 3,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gold',
                            amount: 49720,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 200,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 250,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 39040,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 4 (Creatures)
                {
                    card_number: 4,
                    rewards: [
                        {
                            reward_type: 'creature',
                            creature_name: 'Gale Wyvern',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Mystical Oni',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Molten Manticore',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Fungal Djinn',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Warp Drake',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Regal Gargoyle',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Starfire Behemoth',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Armoured Dragon',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Gilded Dragon',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Kelpie',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 90, max: 100 }
                        }
                    ]
                }
            ]
        };

        // Insert chest cards to database
        await ChestCard.insertMany([commonChest, rareChest, epicChest]);

        console.log('Successfully added chest cards to the database!');
        console.log('Added: Common Chest, Rare Chest, Epic Chest');
        
        // Display summary of added chest types
        const summary = [
            {
                type: 'Common Chest',
                chance: '85%',
                unlock_time: '10 minutes',
                probability_range: '16-100'
            },
            {
                type: 'Rare Chest',
                chance: '10%',
                unlock_time: '1 hour',
                probability_range: '6-15'
            },
            {
                type: 'Epic Chest',
                chance: '5%',
                unlock_time: '8 hours',
                probability_range: '1-5'
            }
        ];

        console.table(summary);
        
        // Exit process
        process.exit();
    } catch (error) {
        console.error('Error adding chest cards:', error);
        process.exit(1);
    }
} 