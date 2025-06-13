const mongoose = require('mongoose');
const Offer = require('../models/offer');

const MONGO_URI = 'mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function createTemplateOffers() {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB Atlas');

    // 1. Beginner's Bundle
    await Offer.create({
        offer_type: 'beginner_bundle',
        offer_data: {
            price: 599,
            items: [
                { type: 'gems', amount: 500 },
                { type: 'arcane_energy', amount: 75000 },
                { type: 'gold', amount: 50000 },
                { type: 'anima', amount: 500 }
            ]
        },
        status: 'active',
        expires_at: null // template offers don't expire
    });

    // 2. Resource Offers
    await Offer.create({ offer_type: 'resource', offer_data: { resourceType: 'gems', price: 199, gems: 200 }, status: 'active' });
    await Offer.create({ offer_type: 'resource', offer_data: { resourceType: 'gems', price: 499, gems: 560 }, status: 'active' });
    await Offer.create({ offer_type: 'resource', offer_data: { resourceType: 'arcane_energy', gems: 500, arcane_energy: 112444 }, status: 'active' });
    await Offer.create({ offer_type: 'resource', offer_data: { resourceType: 'arcane_energy', gems: 1000, arcane_energy: 255689 }, status: 'active' });
    await Offer.create({ offer_type: 'resource', offer_data: { resourceType: 'gold', gems: 500, gold: 231150 }, status: 'active' });
    await Offer.create({ offer_type: 'resource', offer_data: { resourceType: 'gold', gems: 1000, gold: 474777 }, status: 'active' });

    // 3. Battle Loss Offers
    await Offer.create({ offer_type: 'battle_loss', offer_data: { packs: ['Magical Pack', 'Common Pack'], rarity: 'common' }, status: 'active' });
    await Offer.create({ offer_type: 'battle_loss', offer_data: { packs: ['Magical Pack', 'Rare Pack'], rarity: 'rare' }, status: 'active' });
    await Offer.create({ offer_type: 'battle_loss', offer_data: { packs: ['Magical Pack', 'Epic Pack'], rarity: 'epic' }, status: 'active' });
    await Offer.create({ offer_type: 'battle_loss', offer_data: { packs: ['Magical Pack', 'Legendary Pack'], rarity: 'legendary' }, status: 'active' });

    // 4. Evolution Fail Offers
    await Offer.create({ offer_type: 'evolution_fail', offer_data: { packs: ['Magical Pack', 'Common Pack'], rarity: 'common' }, status: 'active' });
    await Offer.create({ offer_type: 'evolution_fail', offer_data: { packs: ['Magical Pack', 'Rare Pack'], rarity: 'rare' }, status: 'active' });
    await Offer.create({ offer_type: 'evolution_fail', offer_data: { packs: ['Magical Pack', 'Epic Pack'], rarity: 'epic' }, status: 'active' });
    await Offer.create({ offer_type: 'evolution_fail', offer_data: { packs: ['Magical Pack', 'Legendary Pack'], rarity: 'legendary' }, status: 'active' });

    console.log('All template offers created!');
    await mongoose.disconnect();
    console.log('Database connection closed');
}

createTemplateOffers().catch(err => {
    console.error('Error creating template offers:', err);
    mongoose.disconnect();
}); 