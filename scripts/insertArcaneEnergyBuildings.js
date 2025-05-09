require('dotenv').config();
const mongoose = require('mongoose');
const ArcaneEnergyBuilding = require('../models/arcaneEnergyBuilding');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected...'))
.catch(err => console.error('MongoDB connection error:', err));

// Arcane Energy Building Levels data
const arcaneEnergyLevels = [
    {
        level: 1,
        upgrade_cost: 0, // No cost for the first level
        upgrade_currency: 'gold',
        production_time_minutes: 5,
        arcane_energy_production: 4000,
        activation_gold_cost: 1600,
    },
    {
        level: 2,
        upgrade_cost: 1000,
        upgrade_currency: 'gold',
        production_time_minutes: 10,
        arcane_energy_production: 44000,
        activation_gold_cost: 22000,
    },
    {
        level: 3,
        upgrade_cost: 4000,
        upgrade_currency: 'gold',
        production_time_minutes: 20,
        arcane_energy_production: 68000,
        activation_gold_cost: 34000,
    },
    {
        level: 4,
        upgrade_cost: 10000,
        upgrade_currency: 'gold',
        production_time_minutes: 30,
        arcane_energy_production: 142000,
        activation_gold_cost: 71000,
    },
    {
        level: 5,
        upgrade_cost: 21500,
        upgrade_currency: 'gold',
        production_time_minutes: 60,
        arcane_energy_production: 260000,
        activation_gold_cost: 130000,
    },
    {
        level: 6,
        upgrade_cost: 55000,
        upgrade_currency: 'gold',
        production_time_minutes: 120,
        arcane_energy_production: 400000,
        activation_gold_cost: 200000,
    },
    {
        level: 7,
        upgrade_cost: 100000,
        upgrade_currency: 'gold',
        production_time_minutes: 480,
        arcane_energy_production: 800000,
        activation_gold_cost: 400000,
    },
    {
        level: 8,
        upgrade_cost: 2000,
        upgrade_currency: 'gems',
        production_time_minutes: 720,
        arcane_energy_production: 2400000,
        activation_gold_cost: 1200000,
    }
];

async function insertArcaneEnergyBuildings() {
    try {
        // Clear existing data
        await ArcaneEnergyBuilding.deleteMany({});
        console.log('Cleared existing arcane energy building data');
        
        // Insert new data
        const result = await ArcaneEnergyBuilding.insertMany(arcaneEnergyLevels);
        console.log(`Inserted ${result.length} arcane energy building levels`);
        
        // Disconnect from MongoDB
        mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    } catch (error) {
        console.error('Error inserting arcane energy buildings:', error);
        mongoose.disconnect();
    }
}

// Run the function
insertArcaneEnergyBuildings(); 