const mongoose = require('mongoose');
const CardPack = require('../models/cardPack');

async function populateCardPacks() {
    try {
        // Connect to MongoDB Atlas
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('Connected to MongoDB Atlas');

        // Clear existing card packs
        await CardPack.deleteMany({});
        console.log('Cleared existing card packs');

        // Create Free Pack
        const freePack = new CardPack({
            pack_id: 'free_pack_01',
            pack_type: 'Free Pack',
            description: 'Free pack with basic rewards',
            cost: 0,
            currency_type: 'gems',
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
        });
        await freePack.save();
        console.log('Free Pack added');
        
        // Create Common Pack
        const commonPack = new CardPack({
            pack_id: 'common_pack_01',
            pack_type: 'Common Pack',
            description: 'Common pack with better rewards',
            cost: 50,
            currency_type: 'gems',
            cards: [
                // Card 1
                {
                    card_number: 1,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 50,
                            chance: 50,
                            probability_range: { min: 0, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 100,
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
                            amount: 12430,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 50,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 50,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 9760,
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
                            amount: 12430,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 50,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 50,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 9760,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 4 (Monsters)
                {
                    card_number: 4,
                    rewards: [
                        {
                            reward_type: 'creature',
                            creature_name: 'Ironscale Wyvern',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Blood Oni',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Feral Manticore',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ice Djinn',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Cave Drake',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Savage Gargoyle',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Stoneborn Behemoth',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Greyscale Dragon',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Azurescale Dragon',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Tulpar',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 90, max: 100 }
                        }
                    ]
                }
            ]
        });
        await commonPack.save();
        console.log('Common Pack added');
        
        // Create Rare Pack
        const rarePack = new CardPack({
            pack_id: 'rare_pack_01',
            pack_type: 'Rare Pack',
            description: 'Rare pack with superior rewards',
            cost: 150,
            currency_type: 'gems',
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
                // Card 4 (Monsters)
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
        });
        await rarePack.save();
        console.log('Rare Pack added');
        
        // Create Epic Pack
        const epicPack = new CardPack({
            pack_id: 'epic_pack_01',
            pack_type: 'Epic Pack',
            description: 'Epic pack with exceptional rewards',
            cost: 300,
            currency_type: 'gems',
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
                // Card 4 (Monsters)
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
        });
        await epicPack.save();
        console.log('Epic Pack added');
        
        // Create Legendary Pack
        const legendaryPack = new CardPack({
            pack_id: 'legendary_pack_01',
            pack_type: 'Legendary Pack',
            description: 'Legendary pack with the most powerful rewards',
            cost: 500,
            currency_type: 'gems',
            cards: [
                // Card 1
                {
                    card_number: 1,
                    rewards: [
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 500,
                            chance: 50,
                            probability_range: { min: 0, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 800,
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
                            amount: 99440,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 400,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 500,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 78080,
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
                            amount: 99440,
                            chance: 25,
                            probability_range: { min: 0, max: 25 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'anima',
                            amount: 400,
                            chance: 25,
                            probability_range: { min: 25, max: 50 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'gems',
                            amount: 500,
                            chance: 25,
                            probability_range: { min: 50, max: 75 }
                        },
                        {
                            reward_type: 'resource',
                            resource_type: 'arcane_energy',
                            amount: 78080,
                            chance: 25,
                            probability_range: { min: 75, max: 100 }
                        }
                    ]
                },
                // Card 4 (Monsters)
                {
                    card_number: 4,
                    rewards: [
                        {
                            reward_type: 'creature',
                            creature_name: 'Necrotic Wyvern',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ravager Oni',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Abyssal Manticore',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ash Djinn',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ancient Drake',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Minotaur',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Obsidian Behemoth',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Fire Dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Netherfire Dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Unicorn',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 90, max: 100 }
                        }
                    ]
                }
            ]
        });
        await legendaryPack.save();
        console.log('Legendary Pack added');

        // Create Magical Pack
        const magicalPack = new CardPack({
            pack_id: 'magical_pack_01',
            pack_type: 'Magical Pack',
            description: 'Magical pack with creatures of all rarities',
            cost: 400,
            currency_type: 'gems',
            cards: [
                // Card 1 - Common Monsters (Each has 15% chance)
                {
                    card_number: 1,
                    rewards: [
                        {
                            reward_type: 'creature',
                            creature_name: 'Ironscale Wyvern',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Blood Oni',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Feral Manticore',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ice Djinn',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Cave Drake',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Savage Gargoyle',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Stoneborn Behemoth',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Greyscale Dragon',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Azurescale Dragon',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Tulpar',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 90, max: 100 }
                        }
                    ]
                },
                // Card 2 - Rare Monsters (Each has 10% chance)
                {
                    card_number: 2,
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
                            creature_name: 'Fungal Djinn',
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
                },
                // Card 3 - Epic Monsters (Each has 7% chance)
                {
                    card_number: 3,
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
                            creature_name: 'Sand Djinn',
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
                },
                // Card 4 - Legendary Monsters (Each has 4% chance)
                {
                    card_number: 4,
                    rewards: [
                        {
                            reward_type: 'creature',
                            creature_name: 'Necrotic Wyvern',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ravager Oni',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Abyssal Manticore',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ash Djinn',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ancient Drake',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Minotaur',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Obsidian Behemoth',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Fire Dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Netherfire Dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Unicorn',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 90, max: 100 }
                        }
                    ]
                }
            ]
        });
        await magicalPack.save();
        console.log('Magical Pack added');

        console.log('All card packs have been populated successfully');

    } catch (error) {
        console.error('Error populating card packs:', error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the population script
populateCardPacks(); 