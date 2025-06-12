const mongoose = require('mongoose');
const User = require('./models/user');
const Building = require('./models/building');
const Boost = require('./models/boost');
const Currency = require('./models/currency');
const UserLevel = require('./models/userLevel');
const Creature = require('./models/creature');
require('dotenv').config();

async function createBuildings() {
    try {
        // Create buildings with updated data
        const buildings = [
            {
                buildingId: 'outpost',
                name: 'Outpost',
                cost: 3000,
                gold_coins: 180,
                generation_interval: 5,
                size: { x: 2, y: 2 },
                constructionTime: 6, // 6 minutes
                unlockLevel: 2
            },
            {
                buildingId: 'heros_tomb',
                name: 'Hero\'s Tomb',
                cost: 7000,
                gold_coins: 600,
                generation_interval: 30,
                size: { x: 3, y: 2 },
                constructionTime: 30, // 30 minutes
                unlockLevel: 5
            },
            {
                buildingId: 'bell_tower',
                name: 'Bell Tower',
                cost: 50000,
                gold_coins: 3600,
                generation_interval: 120,
                size: { x: 2, y: 3 },
                constructionTime: 120, // 120 minutes (2 hours)
                unlockLevel: 8
            },
            {
                buildingId: 'warg_pen',
                name: 'Warg Pen',
                cost: 15000,
                gold_coins: 2400,
                generation_interval: 120,
                size: { x: 3, y: 2 },
                constructionTime: 120, // 120 minutes (2 hours)
                unlockLevel: 11
            },
            {
                buildingId: 'mausoleum',
                name: 'Mausoleum',
                cost: 75000,
                gold_coins: 1200,
                generation_interval: 60,
                size: { x: 2, y: 3 },
                constructionTime: 120,
                unlockLevel: 13
            },
            {
                buildingId: 'crystal_tower',
                name: 'Crystal Tower',
                cost: 20000,
                gold_coins: 1080,
                generation_interval: 60,
                size: { x: 2, y: 2 },
                constructionTime: 60,
                unlockLevel: 16
            },
            {
                buildingId: 'potion_works',
                name: 'Potion-Works',
                cost: 150000,
                gold_coins: 3600,
                generation_interval: 120,
                size: { x: 3, y: 3 },
                constructionTime: 120,
                unlockLevel: 18
            },
            {
                buildingId: 'botanical_garden',
                name: 'Botanical Garden',
                cost: 40000,
                gold_coins: 2400,
                generation_interval: 120,
                size: { x: 3, y: 3 },
                constructionTime: 240,
                unlockLevel: 22
            },
            {
                buildingId: 'dark_library',
                name: 'Dark Library',
                cost: 160000,
                gold_coins: 4500,
                generation_interval: 180,
                size: { x: 3, y: 3 },
                constructionTime: 240,
                unlockLevel: 25
            },
            {
                buildingId: 'magical_arena',
                name: 'Magical Arena',
                cost: 47000,
                gold_coins: 2400,
                generation_interval: 240,
                size: { x: 3, y: 3 },
                constructionTime: 240,
                unlockLevel: 28
            },
            {
                buildingId: 'serene_pond',
                name: 'Serene Pond',
                cost: 60000,
                gold_coins: 1880,
                generation_interval: 120,
                size: { x: 2, y: 2 },
                constructionTime: 120,
                unlockLevel: 31
            },
            {
                buildingId: 'draconic_cathedral',
                name: 'Draconic Cathedral',
                cost: 170000,
                gold_coins: 3120,
                generation_interval: 120,
                size: { x: 3, y: 3 },
                constructionTime: 480,
                unlockLevel: 34
            },
            {
                buildingId: 'gloomy_pond',
                name: 'Gloomy Pond',
                cost: 67000,
                gold_coins: 2160,
                generation_interval: 180,
                size: { x: 2, y: 2 },
                constructionTime: 180,
                unlockLevel: 37
            },
            {
                buildingId: 'water_wheel',
                name: 'Water Wheel',
                cost: 175000,
                gold_coins: 12000,
                generation_interval: 120,
                size: { x: 3, y: 3 },
                constructionTime: 120,
                unlockLevel: 40
            },
            {
                buildingId: 'fortress',
                name: 'Fortress',
                cost: 82000,
                gold_coins: 2880,
                generation_interval: 240,
                size: { x: 4, y: 3 },
                constructionTime: 360,
                unlockLevel: 43
            },
            {
                buildingId: 'dark_pyramid',
                name: 'Dark Pyramid',
                cost: 184000,
                gold_coins: 2800,
                generation_interval: 120,
                size: { x: 4, y: 3 },
                constructionTime: 720,
                unlockLevel: 46
            },
            {
                buildingId: 'spectral_ruins',
                name: 'Spectral Ruins',
                cost: 91150,
                gold_coins: 2160,
                generation_interval: 120,
                size: { x: 3, y: 3 },
                constructionTime: 180,
                unlockLevel: 50
            },
            {
                buildingId: 'void_gate',
                name: 'Void Gate',
                cost: 196760,
                gold_coins: 840,
                generation_interval: 120,
                size: { x: 3, y: 2 },
                constructionTime: 360,
                unlockLevel: 53
            },
            {
                buildingId: 'bestial_temple',
                name: 'Bestial Temple',
                cost: 101520,
                gold_coins: 1200,
                generation_interval: 120,
                size: { x: 3, y: 3 },
                constructionTime: 120,
                unlockLevel: 56
            },
            {
                buildingId: 'ancient_spire',
                name: 'Ancient Spire',
                cost: 205330,
                gold_coins: 3360,
                generation_interval: 240,
                size: { x: 2, y: 2 },
                constructionTime: 120,
                unlockLevel: 60
            },
            {
                buildingId: 'tavern',
                name: 'Tavern',
                cost: 108550,
                gold_coins: 14400,
                generation_interval: 120,
                size: { x: 3, y: 2 },
                constructionTime: 120,
                unlockLevel: 65
            },
            {
                buildingId: 'dual_bell_tower',
                name: 'Dual Bell Tower',
                cost: 216110,
                gold_coins: 2520,
                generation_interval: 180,
                size: { x: 2, y: 3 },
                constructionTime: 180,
                unlockLevel: 70
            },
            {
                buildingId: 'void_pyramid',
                name: 'Void Pyramid',
                cost: 150000,
                gold_coins: 21600,
                generation_interval: 720,
                size: { x: 4, y: 3 },
                constructionTime: 720,
                unlockLevel: 75
            }
        ];

        // Check if buildings already exist
        const buildingCount = await Building.countDocuments();
        if (buildingCount > 0) {
            console.log(`${buildingCount} buildings already exist in the database.`);
            
            // Option to delete existing buildings and recreate them
            const deleteExisting = process.env.RECREATE_BUILDINGS === 'true';
            if (deleteExisting) {
                console.log('Deleting existing buildings to recreate them...');
                await Building.deleteMany({});
                console.log('Existing buildings deleted.');
                
                // Create all buildings from scratch
                const savedBuildings = [];
                for (const buildingData of buildings) {
                    const building = new Building(buildingData);
                    await building.save();
                    savedBuildings.push(building);
                    console.log(`Created building: ${building.name} (Level ${building.unlockLevel})`);
                }
                console.log(`Created ${savedBuildings.length} buildings successfully.`);
            } else {
                // Display information about existing buildings
                const existingBuildings = await Building.find().sort('unlockLevel');
                console.log('\nExisting buildings:');
                console.log('ID | Name | Level | Cost | Size | Gold/hr');
                console.log('----------------------------------------');
                existingBuildings.forEach(building => {
                    console.log(`${building.buildingId} | ${building.name} | ${building.unlockLevel} | ${building.cost} | ${building.size.x}x${building.size.y} | ${building.gold_coins}`);
                });
            }
        } else {
            // Create all buildings from scratch
            const savedBuildings = [];
            for (const buildingData of buildings) {
                const building = new Building(buildingData);
                await building.save();
                savedBuildings.push(building);
                console.log(`Created building: ${building.name} (Level ${building.unlockLevel})`);
            }
            console.log(`Created ${savedBuildings.length} buildings successfully.`);
        }

        // Create one user without any buildings if it doesn't exist
        const userExists = await User.findOne({ userId: 'user1' });
        if (userExists) {
            console.log('User already exists. Skipping user creation.');
        } else {
            const user = new User({
                userId: 'user1',
                user_name: 'Player1',
                level: 1,
                gold_coins: 1000,
                profile_picture: 'player1.jpg',
                title: 'Game Master',
                trophies: [
                    { name: 'Gold Cup', count: 3 },
                    { name: 'First Victory', count: 1 }
                ],
                trophy_count: 4,
                buildings: [],
                boosts: [],
                currency: {
                    gems: 0,
                    arcane_energy: 0,
                    gold: 1000, 
                    anima: 0,
                    last_updated: new Date()
                },
                logout_time: new Date()
            });
            await user.save();
            console.log('Created user with default currency values');
        }

        console.log('\nAll data created successfully!');

    } catch (error) {
        console.error('Error:', error);
    }
}

async function createBoosts() {
    try {
        // Check if boosts already exist
        const boostCount = await Boost.countDocuments();
        if (boostCount > 0) {
            console.log(`${boostCount} boosts already exist in the database.`);
            
            // Option to delete existing boosts and recreate them
            const deleteExisting = process.env.RECREATE_BOOSTS === 'true';
            if (deleteExisting) {
                console.log('Deleting existing boosts to recreate them...');
                await Boost.deleteMany({});
                console.log('Existing boosts deleted.');
                
                // Create boost table with 17 boost types
                const boostTypes = [
                    { boost_id: 'siphon', name: 'Siphon', path: '', description: 'Drains energy from opponents' },
                    { boost_id: 'mirror', name: 'Mirror', path: '', description: 'Reflects damage back to attacker' },
                    { boost_id: 'team_rejuvenation', name: 'Team Rejuvenation', path: '', description: 'Heals all team members' },
                    { boost_id: 'mix', name: 'Mix', path: '', description: 'Combines multiple effects into one' },
                    { boost_id: 'draconian', name: 'Draconian', path: '', description: 'Increases dragon-type creatures power' },
                    { boost_id: 'duplicate', name: 'Duplicate', path: '', description: 'Creates a temporary copy of a creature' },
                    { boost_id: 'vengeance', name: 'Vengeance', path: '', description: 'Increases power when health is low' },
                    { boost_id: 'terrorise', name: 'Terrorise', path: '', description: 'Reduces enemy attack power' },
                    { boost_id: 'quickness', name: 'Quickness', path: '', description: 'Increases speed temporarily' },
                    { boost_id: 'brutality', name: 'Brutality', path: '', description: 'Increases critical hit chance' },
                    { boost_id: 'snatch', name: 'Snatch', path: '', description: 'Steals a positive effect from enemy' },
                    { boost_id: 'shard', name: 'Shard', path: '', description: 'Creates a protective barrier' },
                    { boost_id: 'boon', name: 'Boon', path: '', description: 'Increases all stats temporarily' },
                    { boost_id: 'obliterate', name: 'Obliterate', path: '', description: 'Deals massive damage to a single target' },
                    { boost_id: 'corner', name: 'Corner', path: '', description: 'Traps enemy, preventing escape' },
                    { boost_id: 'indignation', name: 'Indignation', path: '', description: 'Increases damage when attacked' },
                    { boost_id: 'manipulate', name: 'Manipulate', path: '', description: 'Controls an enemy creature for one turn' }
                ];

                // Save boosts to database
                const savedBoosts = [];
                for (const boostData of boostTypes) {
                    const boost = new Boost(boostData);
                    await boost.save();
                    savedBoosts.push(boost);
                    console.log(`Created boost: ${boost.name}`);
                }

                console.log(`\nCreated ${savedBoosts.length} boosts successfully.`);
                
                // Display all created boosts
                console.log('\nCreated boost table:');
                console.log('ID | Name | Description');
                console.log('---------------------------');
                savedBoosts.forEach(boost => {
                    console.log(`${boost.boost_id} | ${boost.name} | ${boost.description}`);
                });
            } else {
                // Display information about existing boosts
                const existingBoosts = await Boost.find();
                console.log('\nExisting boosts:');
                console.log('ID | Name | Path');
                console.log('---------------');
                existingBoosts.forEach(boost => {
                    console.log(`${boost.boost_id} | ${boost.name} | ${boost.path}`);
                });
            }
        } else {
            // Create all boosts from scratch since none exist
            const boostTypes = [
                { boost_id: 'siphon', name: 'Siphon', path: '', description: 'Drains energy from opponents' },
                { boost_id: 'mirror', name: 'Mirror', path: '', description: 'Reflects damage back to attacker' },
                { boost_id: 'team_rejuvenation', name: 'Team Rejuvenation', path: '', description: 'Heals all team members' },
                { boost_id: 'mix', name: 'Mix', path: '', description: 'Combines multiple effects into one' },
                { boost_id: 'draconian', name: 'Draconian', path: '', description: 'Increases dragon-type creatures power' },
                { boost_id: 'duplicate', name: 'Duplicate', path: '', description: 'Creates a temporary copy of a creature' },
                { boost_id: 'vengeance', name: 'Vengeance', path: '', description: 'Increases power when health is low' },
                { boost_id: 'terrorise', name: 'Terrorise', path: '', description: 'Reduces enemy attack power' },
                { boost_id: 'quickness', name: 'Quickness', path: '', description: 'Increases speed temporarily' },
                { boost_id: 'brutality', name: 'Brutality', path: '', description: 'Increases critical hit chance' },
                { boost_id: 'snatch', name: 'Snatch', path: '', description: 'Steals a positive effect from enemy' },
                { boost_id: 'shard', name: 'Shard', path: '', description: 'Creates a protective barrier' },
                { boost_id: 'boon', name: 'Boon', path: '', description: 'Increases all stats temporarily' },
                { boost_id: 'obliterate', name: 'Obliterate', path: '', description: 'Deals massive damage to a single target' },
                { boost_id: 'corner', name: 'Corner', path: '', description: 'Traps enemy, preventing escape' },
                { boost_id: 'indignation', name: 'Indignation', path: '', description: 'Increases damage when attacked' },
                { boost_id: 'manipulate', name: 'Manipulate', path: '', description: 'Controls an enemy creature for one turn' }
            ];

            // Save boosts to database
            const savedBoosts = [];
            for (const boostData of boostTypes) {
                const boost = new Boost(boostData);
                await boost.save();
                savedBoosts.push(boost);
                console.log(`Created boost: ${boost.name}`);
            }

            console.log(`\nCreated ${savedBoosts.length} boosts successfully.`);
            
            // Display all created boosts
            console.log('\nCreated boost table:');
            console.log('ID | Name | Description');
            console.log('---------------------------');
            savedBoosts.forEach(boost => {
                console.log(`${boost.boost_id} | ${boost.name} | ${boost.description}`);
            });
        }
        
    } catch (error) {
        console.error('Error creating boosts:', error);
    }
}

async function createCurrencies() {
    try {
        // Check if currencies already exist
        const currencyCount = await Currency.countDocuments();
        if (currencyCount > 0) {
            console.log('Currencies already exist in the database. Skipping currency creation.');
            
            // Display existing currencies
            const existingCurrencies = await Currency.find();
            console.log('\nExisting currencies:');
            console.log('ID | Name | Type | Max Value');
            console.log('---------------------------');
            existingCurrencies.forEach(currency => {
                console.log(`${currency.currency_id} | ${currency.name} | ${currency.type} | ${currency.max_value}`);
            });
            return;
        }
        
        // Create currency types
        const currencyTypes = [
            { 
                currency_id: 'gems',
                name: 'Gems', 
                type: 'Gems', // Same as name
                max_value: 1000000000 // 1B max
            },
            { 
                currency_id: 'arcane_energy',
                name: 'Arcane Energy', 
                type: 'Arcane Energy', // Same as name
                max_value: 100000000 // 100M max
            },
            { 
                currency_id: 'anima',
                name: 'Anima', 
                type: 'Anima', // Same as name
                max_value: 1000000 // 1M max
            }
        ];

        // Save currencies to database
        const savedCurrencies = [];
        for (const currencyData of currencyTypes) {
            const currency = new Currency(currencyData);
            await currency.save();
            savedCurrencies.push(currency);
        }

        console.log('\nCreated currency types:');
        console.log('ID | Name | Type | Max Value');
        console.log('---------------------------');
        savedCurrencies.forEach(currency => {
            console.log(`${currency.currency_id} | ${currency.name} | ${currency.type} | ${currency.max_value}`);
        });
        
        return savedCurrencies;
    } catch (error) {
        console.error('Error creating currencies:', error);
    }
}



async function main() {
    try {
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB Atlas');
        
        // Create buildings
        await createBuildings();
        
        // Create boosts
        await createBoosts();
        
        // Create currencies
        await createCurrencies();
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
        console.log('Database connection closed');
    }
}

main();
