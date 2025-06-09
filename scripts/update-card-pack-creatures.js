const mongoose = require('mongoose');
const CardPack = require('../models/cardPack');

async function updateCardPackCreatures() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Get all card packs
        const cardPacks = await CardPack.find({});
        console.log(`Found ${cardPacks.length} card packs to update`);

        // Update each card pack
        for (const pack of cardPacks) {
            try {
                // Check if cards array exists
                if (!pack.cards || !Array.isArray(pack.cards)) {
                    console.log(`Skipping pack ${pack.pack_id} - no cards array found`);
                    continue;
                }

                // Update each card's rewards
                for (let i = 0; i < pack.cards.length; i++) {
                    const card = pack.cards[i];
                    if (!card.rewards || !Array.isArray(card.rewards)) {
                        continue;
                    }

                    // Update each reward
                    for (let j = 0; j < card.rewards.length; j++) {
                        const reward = card.rewards[j];
                        if (reward.reward_type === 'creature') {
                            // Convert name to snake_case for creature_Id
                            const creatureId = reward.creature_name
                                .toLowerCase()
                                .replace(/\s+/g, '_')
                                .replace(/[^a-z0-9_]/g, '');

                            console.log(`Updating creature: ${reward.creature_name} with creature_Id: ${creatureId}`);

                            // Update the reward directly in the database
                            await CardPack.updateOne(
                                { 
                                    _id: pack._id,
                                    'cards.rewards._id': reward._id 
                                },
                                { 
                                    $set: { 
                                        'cards.$[card].rewards.$[reward].creature_Id': creatureId,
                                        'cards.$[card].rewards.$[reward].creature_type': creatureId,
                                        'cards.$[card].rewards.$[reward].base_attack': 50,
                                        'cards.$[card].rewards.$[reward].base_health': 300,
                                        'cards.$[card].rewards.$[reward].gold_coins': 50,
                                        'cards.$[card].rewards.$[reward].arcane_energy': 99,
                                        'cards.$[card].rewards.$[reward].critical_damage': 100,
                                        'cards.$[card].rewards.$[reward].critical_damage_percentage': 25,
                                        'cards.$[card].rewards.$[reward].armor': 0,
                                        'cards.$[card].rewards.$[reward].speed': 100
                                    }
                                },
                                {
                                    arrayFilters: [
                                        { 'card.card_number': card.card_number },
                                        { 'reward._id': reward._id }
                                    ]
                                }
                            );
                        }
                    }
                }

                // Get updated pack to verify changes
                const updatedPack = await CardPack.findById(pack._id);
                if (updatedPack.cards && updatedPack.cards[3] && updatedPack.cards[3].rewards) {
                    const updatedCreatures = updatedPack.cards[3].rewards
                        .filter(r => r.reward_type === 'creature')
                        .map(r => ({
                            name: r.creature_name,
                            id: r.creature_Id
                        }));

                    console.log(`Updated card pack: ${pack.pack_id}`);
                    console.log('Updated creatures:', updatedCreatures);
                }
            } catch (packError) {
                console.error(`Error updating pack ${pack.pack_id}:`, packError);
                continue;
            }
        }

        console.log('Successfully updated all card packs');
    } catch (error) {
        console.error('Error updating card packs:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the update script
updateCardPackCreatures(); 