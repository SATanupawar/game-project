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
                            creature_Id: 'ironscale_wyvern',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Blood Oni',
                            creature_Id: 'blood_oni',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Feral Manticore',
                            creature_Id: 'feral_manticore',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ice Djinn',
                            creature_Id: 'ice_djinn',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Cave Drake',
                            creature_Id: 'cave_drake',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Savage Gargoyle',
                            creature_Id: 'savage_gargoyle',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Stoneborn Behemoth',
                            creature_Id: 'stoneborn_behemoth',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Greyscale Dragon',
                            creature_Id: 'greyscale_dragon',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Azurescale Dragon',
                            creature_Id: 'azurescale_dragon',
                            rarity: 'common',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Tulpar',
                            creature_Id: 'tulpar',
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
                            creature_name: 'Crystal Wyvern',
                            creature_Id: 'crystal_wyvern',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Void Oni',
                            creature_Id: 'void_oni',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Thunder Manticore',
                            creature_Id: 'thunder_manticore',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Desert Djinn',
                            creature_Id: 'desert_djinn',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Cloud Drake',
                            creature_Id: 'cloud_drake',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Crystal Gargoyle',
                            creature_Id: 'crystal_gargoyle',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Frost Behemoth',
                            creature_Id: 'frost_behemoth',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Shadow Dragon',
                            creature_Id: 'shadow_dragon',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Thunder Dragon',
                            creature_Id: 'thunder_dragon',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Golden Tulpar',
                            creature_Id: 'golden_tulpar',
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
                            creature_name: 'Storm Wyvern',
                            creature_Id: 'storm_wyvern',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Mystic Oni',
                            creature_Id: 'mystic_oni',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Magma Manticore',
                            creature_Id: 'magma_manticore',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Forest Djinn',
                            creature_Id: 'forest_djinn',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Void Drake',
                            creature_Id: 'void_drake',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Royal Gargoyle',
                            creature_Id: 'royal_gargoyle',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Star Behemoth',
                            creature_Id: 'star_behemoth',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Armor Dragon',
                            creature_Id: 'armor_dragon',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Gold Dragon',
                            creature_Id: 'gold_dragon',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Mystic Kelpie',
                            creature_Id: 'mystic_kelpie',
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
                            creature_name: 'Death Wyvern',
                            creature_Id: 'death_wyvern',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Rage Oni',
                            creature_Id: 'rage_oni',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Abyss Manticore',
                            creature_Id: 'abyss_manticore',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ember Djinn',
                            creature_Id: 'ember_djinn',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Elder Drake',
                            creature_Id: 'elder_drake',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'War Minotaur',
                            creature_Id: 'war_minotaur',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Dark Behemoth',
                            creature_Id: 'dark_behemoth',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Flame Dragon',
                            creature_Id: 'flame_dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Nether Dragon',
                            creature_Id: 'nether_dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Celestial Unicorn',
                            creature_Id: 'celestial_unicorn',
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
                            creature_name: 'Iron Wyvern',
                            creature_Id: 'iron_wyvern',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Shadow Oni',
                            creature_Id: 'shadow_oni',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Forest Manticore',
                            creature_Id: 'forest_manticore',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Frost Djinn',
                            creature_Id: 'frost_djinn',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Mountain Drake',
                            creature_Id: 'mountain_drake',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ancient Gargoyle',
                            creature_Id: 'ancient_gargoyle',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Earth Behemoth',
                            creature_Id: 'earth_behemoth',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Storm Dragon',
                            creature_Id: 'storm_dragon',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Azure Dragon',
                            creature_Id: 'azure_dragon',
                            rarity: 'common',
                            chance: 15,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Swift Tulpar',
                            creature_Id: 'swift_tulpar',
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
                            creature_name: 'Crystal Wyvern',
                            creature_Id: 'crystal_wyvern',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Void Oni',
                            creature_Id: 'void_oni',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Thunder Manticore',
                            creature_Id: 'thunder_manticore',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Desert Djinn',
                            creature_Id: 'desert_djinn',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Cloud Drake',
                            creature_Id: 'cloud_drake',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Crystal Gargoyle',
                            creature_Id: 'crystal_gargoyle',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Frost Behemoth',
                            creature_Id: 'frost_behemoth',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Shadow Dragon',
                            creature_Id: 'shadow_dragon',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Thunder Dragon',
                            creature_Id: 'thunder_dragon',
                            rarity: 'rare',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Golden Tulpar',
                            creature_Id: 'golden_tulpar',
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
                            creature_name: 'Storm Wyvern',
                            creature_Id: 'storm_wyvern',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Mystic Oni',
                            creature_Id: 'mystic_oni',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Magma Manticore',
                            creature_Id: 'magma_manticore',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Forest Djinn',
                            creature_Id: 'forest_djinn',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Void Drake',
                            creature_Id: 'void_drake',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Royal Gargoyle',
                            creature_Id: 'royal_gargoyle',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Star Behemoth',
                            creature_Id: 'star_behemoth',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Armor Dragon',
                            creature_Id: 'armor_dragon',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Gold Dragon',
                            creature_Id: 'gold_dragon',
                            rarity: 'epic',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Mystic Kelpie',
                            creature_Id: 'mystic_kelpie',
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
                            creature_name: 'Death Wyvern',
                            creature_Id: 'death_wyvern',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 0, max: 10 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Rage Oni',
                            creature_Id: 'rage_oni',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 10, max: 20 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Abyss Manticore',
                            creature_Id: 'abyss_manticore',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 20, max: 30 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Ember Djinn',
                            creature_Id: 'ember_djinn',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 30, max: 40 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Elder Drake',
                            creature_Id: 'elder_drake',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 40, max: 50 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'War Minotaur',
                            creature_Id: 'war_minotaur',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 50, max: 60 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Dark Behemoth',
                            creature_Id: 'dark_behemoth',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 60, max: 70 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Flame Dragon',
                            creature_Id: 'flame_dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 70, max: 80 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Nether Dragon',
                            creature_Id: 'nether_dragon',
                            rarity: 'legendary',
                            chance: 10,
                            probability_range: { min: 80, max: 90 }
                        },
                        {
                            reward_type: 'creature',
                            creature_name: 'Celestial Unicorn',
                            creature_Id: 'celestial_unicorn',
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