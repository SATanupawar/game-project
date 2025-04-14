const mongoose = require('mongoose');
const User = require('./models/user');
const Building = require('./models/building');
const Creature = require('./models/creature');

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
        
        // Display stats for each level
        for (const levelStat of sortedStats) {
            console.log(`Level ${levelStat.level}: Attack ${levelStat.attack}, Health ${levelStat.health}`);
        }
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
                creature_Id: 'dragon',
                name: 'Dragon',
                type: 'legendary',
                gold_coins: 50,
                description: 'A fierce fire-breathing dragon with immense power',
                image: 'dragon.png',
                base_attack: 45,
                base_health: 250
            },
            {
                creature_Id: 'leviathan',
                name: 'Leviathan',
                type: 'elite',
                gold_coins: 45,
                description: 'A massive sea serpent that commands the depths of the ocean',
                image: 'leviathan.png',
                base_attack: 40,
                base_health: 280
            },
            {
                creature_Id: 'golem',
                name: 'Stone Golem',
                type: 'epic',
                gold_coins: 40,
                description: 'A massive creature made of living stone with incredible defense',
                image: 'golem.png',
                base_attack: 35,
                base_health: 350
            },
            {
                creature_Id: 'griffin',
                name: 'Griffin',
                type: 'epic',
                gold_coins: 35,
                description: 'A majestic flying creature with incredible speed and agility',
                image: 'griffin.png',
                base_attack: 38,
                base_health: 230
            },
            {
                creature_Id: 'phoenix',
                name: 'Phoenix',
                type: 'legendary',
                gold_coins: 55,
                description: 'A legendary bird that can be reborn from its own ashes',
                image: 'phoenix.png',
                base_attack: 42,
                base_health: 260
            },
            {
                creature_Id: 'hydra',
                name: 'Hydra',
                type: 'rare',
                gold_coins: 30,
                description: 'A powerful multi-headed serpent with regenerative abilities',
                image: 'hydra.png',
                base_attack: 32,
                base_health: 220
            },
            {
                creature_Id: 'goblin',
                name: 'Goblin',
                type: 'common',
                gold_coins: 15,
                description: 'A small but cunning creature that attacks in groups',
                image: 'goblin.png',
                base_attack: 25,
                base_health: 150
            }
        ];

        const savedCreatures = [];
        
        // Check if creatures already exist to avoid duplicates
        const creatureCount = await Creature.countDocuments();
        if (creatureCount > 0) {
            console.log('Creatures already exist in the database. Skipping creature creation.');
            
            // Just for demo purposes, display existing creatures
            const existingCreatures = await Creature.find();
            for (const creature of existingCreatures) {
                console.log(`\nExisting creature: ${creature.name}`);
                await displayCreatureInfo(creature);
            }
            
            // Display all level stats for the first creature
            if (existingCreatures.length > 0) {
                await displayCreatureLevelStats(existingCreatures[0].creature_Id);
            }
            
            // Compare all creatures at levels 1, 10, 20, 30, and 40
            await compareCreaturesAtLevel(1);
            await compareCreaturesAtLevel(10);
            await compareCreaturesAtLevel(20);
            await compareCreaturesAtLevel(40);
        } else {
            // Create creatures
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
        }

        // Create 4 buildings
        const buildings = [
            {
                buildingId: 'building1',
                name: 'Dark Library',
                gold_coins: 30,
                size: { x: 2, y: 3 }
            },
            {
                buildingId: 'building2',
                name: 'Beast Sanctum',
                gold_coins: 40,
                size: { x: 3, y: 3 }
            },
            {
                buildingId: 'building3',
                name: 'Fortress',
                gold_coins: 50,
                size: { x: 3, y: 3 }
            },
            {
                buildingId: 'building4',
                name: 'Tavern',
                gold_coins: 35,
                size: { x: 3, y: 2 }
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
            const user = new User({
                userId: 'user1',
                user_name: 'Player1',
                gold_coins: 1000,
                buildings: []  // Empty buildings array
            });
            await user.save();
            console.log('Created user without any buildings');
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

async function main() {
    try {
        // Use the original MongoDB Atlas connection string
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('Connected to MongoDB Atlas');
        await createCreaturesAndBuildings();
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
        console.log('Database connection closed');
    }
}

main();