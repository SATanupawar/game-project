const mongoose = require('mongoose');
const User = require('./models/user');
const Building = require('./models/building');
const Creature = require('./models/creature');
const Boost = require('./models/boost');
const Currency = require('./models/currency');

// Function to display creature info with level stats
async function displayCreatureInfo(creature) {
    // Refresh to make sure we have the most up-to-date data
    const populatedCreature = await Creature.findOne({ _id: creature._id });
    
    // Get current stats
    const stats = populatedCreature.getCurrentStats();
    
    const output = {
        _id: populatedCreature._id,
        creature_Id: populatedCreature.creature_Id,
        name: populatedCreature.name,
        type: populatedCreature.type,
        gold_coins: populatedCreature.gold_coins,
        description: populatedCreature.description,
        image: populatedCreature.image,
        level: populatedCreature.level,
        base_attack: populatedCreature.base_attack,
        base_health: populatedCreature.base_health,
        current_attack: stats.attack,
        current_health: stats.health,
        critical_damage_percentage: populatedCreature.critical_damage_percentage || populatedCreature.critical_damage_percentage, // Use new name but fallback to old one
        critical_damage: populatedCreature.critical_damage,
        total_levels: populatedCreature.level_stats.length,
        createdAt: populatedCreature.createdAt,
        updatedAt: populatedCreature.updatedAt
    };
    console.log(JSON.stringify(output, null, 2));
}

// Function to display all level stats for a creature
async function displayCreatureLevelStats(creatureId) {
    try {
        const creature = await Creature.findOne({ creature_Id: creatureId });
        if (!creature) {
            console.log('Creature not found');
            return;
        }
        
        console.log(`\nLevel stats for ${creature.name} (${creature.type}):`);
        console.log(`Base Attack: ${creature.base_attack}, Base Health: ${creature.base_health}`);
        console.log('----------------');
        
        // Sort level stats by level
        const sortedStats = creature.level_stats.sort((a, b) => a.level - b.level);
        
        // Display stats for each level - only show level, attack and health
        for (const levelStat of sortedStats) {
            console.log(`Level ${levelStat.level}: Attack ${levelStat.attack}, Health ${levelStat.health}`);
        }
        
        // Display the static values only once
        console.log('\nStatic values (same for all levels):');
        console.log(`Speed: ${sortedStats[0].speed}`);
        console.log(`Armor: ${sortedStats[0].armor}`);
        console.log(`Critical Damage Percentage: ${sortedStats[0].critical_damage_percentage || sortedStats[0].critical_damage_percentage}`);
        console.log(`Critical Damage: ${sortedStats[0].critical_damage}`);
    } catch (error) {
        console.error('Error displaying level stats:', error);
    }
}

// Function to display stats comparison for all creatures at a specific level
async function compareCreaturesAtLevel(level) {
    try {
        const creatures = await Creature.find();
        if (creatures.length === 0) {
            console.log('No creatures found');
            return;
        }
        
        console.log(`\n===== CREATURE COMPARISON AT LEVEL ${level} =====`);
        console.log('Name (Type) | Base Attack/Health | Level Stats');
        console.log('------------------------------------------------');
        
        for (const creature of creatures) {
            // Set all creatures to the specified level for comparison
            if (creature.setLevel(level)) {
                await creature.save();
            }
            
            const stats = creature.getCurrentStats();
            console.log(`${creature.name} (${creature.type}) | ${creature.base_attack}/${creature.base_health} | Attack: ${stats.attack}, Health: ${stats.health}`);
        }
        console.log('------------------------------------------------');
    } catch (error) {
        console.error('Error comparing creatures:', error);
    }
}

// Function to query creature by ID with stats
async function queryCreatureById(creatureId) {
    try {
        const creature = await Creature.findOne({ creature_Id: creatureId });
        if (!creature) {
            console.log('Creature not found');
            return;
        }
        console.log('\nQueried Creature Information:');
        await displayCreatureInfo(creature);
    } catch (error) {
        console.error('Error querying creature:', error);
    }
}

// Function to update creature level
async function updateCreatureLevel(creatureId, newLevelNumber) {
    try {
        const creature = await Creature.findOne({ creature_Id: creatureId });
        if (!creature) {
            console.log('Creature not found');
            return;
        }

        const previousLevel = creature.level;
        if (!creature.setLevel(newLevelNumber)) {
            console.log(`Failed to set level to ${newLevelNumber}`);
            return;
        }
        
        await creature.save();

        console.log(`\nUpdated ${creature.name} from level ${previousLevel} to level ${newLevelNumber}`);
        await displayCreatureInfo(creature);
    } catch (error) {
        console.error('Error updating creature level:', error);
    }
}

async function createCreaturesAndBuildings() {
    try {
        // Create creatures with the new model structure
        const creatureTemplates = [
            {
                creature_Id: 'greyscale_dragon',
                name: 'Greyscale Dragon',
                type: 'common',
                gold_coins: 77,
                arcane_energy: 99,
                description: 'A powerful common dragon with greyscale hide',
                image: 'greyscale_dragon.png',
                base_attack: 274,
                base_health: 1100,
                speed: 104,
                armor: 0,
                critical_damage_percentage: 25,
                critical_damage: 100
            },
            {
                creature_Id: 'storm_dragon',
                name: 'Storm Dragon',
                type: 'rare',
                gold_coins: 125,
                arcane_energy: 212,
                description: 'A rare dragon that commands the storms',
                image: 'storm_dragon.png',
                base_attack: 630,
                base_health: 1630,
                speed: 105,
                armor: 0,
                critical_damage_percentage: 25,
                critical_damage: 100
            },
            {
                creature_Id: 'armoured_dragon',
                name: 'Armoured Dragon',
                type: 'epic',
                gold_coins: 415,
                arcane_energy: 403,
                description: 'An epic dragon with natural armor plating',
                image: 'armoured_dragon.png',
                base_attack: 674,
                base_health: 2010,
                speed: 126,
                armor: 0,
                critical_damage_percentage: 30,
                critical_damage: 100
            },
            {
                creature_Id: 'fire_dragon',
                name: 'Fire Dragon',
                type: 'legendary',
                gold_coins: 1001,
                arcane_energy: 612,
                description: 'A legendary dragon that breathes devastating fire',
                image: 'fire_dragon.png',
                base_attack: 1123,
                base_health: 3030,
                speed: 110,
                armor: 0,
                critical_damage_percentage: 45,
                critical_damage: 100
            }
        ];

        // Remove all existing creatures first
        await Creature.deleteMany({});
        console.log('Removed all existing creatures from the database.');

        const savedCreatures = [];
        
        // Create new creatures
        for (const creatureTemplate of creatureTemplates) {
            const creature = new Creature(creatureTemplate);
            await creature.save();
            savedCreatures.push(creature);
            
            // Display the created creature with its stats
            console.log(`\nCreated New ${creature.type} Creature: ${creature.name}`);
            await displayCreatureInfo(creature);
        }
        
        // Display all level stats for the first creature
        if (savedCreatures.length > 0) {
            await displayCreatureLevelStats(savedCreatures[0].creature_Id);
        }
        
        // Compare all creatures at levels 1, 10, 20, 30, and 40
        await compareCreaturesAtLevel(1);
        await compareCreaturesAtLevel(10);
        await compareCreaturesAtLevel(20);
        await compareCreaturesAtLevel(40);

        // Create 4 buildings
        const buildings = [
            {
                buildingId: 'Outpost',
                name: 'Outpost',
                gold_coins: 1800,
                size: { x: 2, y: 2 },
                constructionTime: 5 // 5 minutes
            },
            {
                buildingId: 'Hero\'s Tomb',
                name: 'Hero\'s Tomb',
                gold_coins: 1200,
                size: { x: 3, y: 2 },
                constructionTime: 30 // 30 minutes
            },
            {
                buildingId: 'Bell Towers',
                name: 'Bell Towers',
                gold_coins: 1800,
                size: { x: 3, y: 3 },
                constructionTime: 120 // 120 minutes (2 hours)
            },
            {
                buildingId: 'Warg Pen',
                name: 'Warg Pen',
                gold_coins: 1200,
                size: { x: 3, y: 2 },
                constructionTime: 120 // 120 minutes (2 hours)
            }
        ];

        // Check if buildings already exist
        const buildingCount = await Building.countDocuments();
        if (buildingCount > 0) {
            console.log('Buildings already exist in the database. Skipping building creation.');
        } else {
            const savedBuildings = [];
            for (const buildingData of buildings) {
                const building = new Building(buildingData);
                await building.save();
                savedBuildings.push(building);
                console.log(`Created building: ${building.name}`);
            }
        }

        // Create one user without any buildings if it doesn't exist
        const userExists = await User.findOne({ userId: 'user1' });
        if (userExists) {
            console.log('User already exists. Skipping user creation.');
        } else {
            // Create user with gold stored in both gold_coins and currency.gold (they represent the same currency)
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
                creatures: [],
                battle_selected_creatures: [],
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

        // Demonstrate creature level progression with multiple creatures
        if (savedCreatures.length > 0) {
            console.log('\n===== DEMONSTRATING LEVEL PROGRESSION =====');
            
            // Level up creatures to different levels to demonstrate growth patterns
            const levelDemos = [
                { creatureIndex: 0, level: 10, description: 'Legendary Dragon at level 10' },
                { creatureIndex: 1, level: 15, description: 'Elite Leviathan at level 15' },
                { creatureIndex: 2, level: 20, description: 'Epic Stone Golem at level 20' },
                { creatureIndex: 3, level: 25, description: 'Epic Griffin at level 25' },
                { creatureIndex: 4, level: 30, description: 'Legendary Phoenix at level 30' },
                { creatureIndex: 5, level: 35, description: 'Rare Hydra at level 35' },
                { creatureIndex: 6, level: 40, description: 'Common Goblin at level 40' }
            ];
            
            for (const demo of levelDemos) {
                if (savedCreatures.length > demo.creatureIndex) {
                    const creature = savedCreatures[demo.creatureIndex];
                    console.log(`\n${demo.description}:`);
                    await updateCreatureLevel(creature.creature_Id, demo.level);
                }
            }
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
            console.log('Boosts already exist in the database. Skipping boost creation.');
            
            // Display existing boosts
            const existingBoosts = await Boost.find();
            console.log('\nExisting boosts:');
            console.log('ID | Name | Path');
            console.log('---------------');
            existingBoosts.forEach(boost => {
                console.log(`${boost.boost_id} | ${boost.name} | ${boost.path}`);
            });
            return;
        }
        
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
        }

        console.log('\nCreated boost table:');
        console.log('ID | Name | Path | Description');
        console.log('---------------------------');
        savedBoosts.forEach(boost => {
            console.log(`${boost.boost_id} | ${boost.name} | ${boost.path} | ${boost.description}`);
        });
        
        return savedBoosts;
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
                max_value: 10000000 // 10M max
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
        // Use the original MongoDB Atlas connection string
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('Connected to MongoDB Atlas');
        
        // Create creatures and buildings
        await createCreaturesAndBuildings();
        
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