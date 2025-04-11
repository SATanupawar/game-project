const mongoose = require('mongoose');
const User = require('./models/user'); // Adjust the path as needed
const Building = require('./models/building'); // Adjust the path as needed
const Creature = require('./models/creature'); // Adjust the path as needed
const CreatureLevel = require('./models/creature_level');

// Function to display creature in the exact format
async function displayCreatureInfo(creature) {
    const populatedCreature = await Creature.findOne({ _id: creature._id });
    const output = {
        _id: populatedCreature._id,
        creature_Id: populatedCreature.creature_Id,
        name: populatedCreature.name,
        type: populatedCreature.type,
        gold_coins: populatedCreature.gold_coins,
        description: populatedCreature.description,
        image: populatedCreature.image,
        level: populatedCreature.level._id,
        levelNumber: populatedCreature.levelNumber,
        createdAt: populatedCreature.createdAt,
        updatedAt: populatedCreature.updatedAt,
        __v: populatedCreature.__v
    };
    console.log(JSON.stringify(output, null, 2));
}

// Function to display complete creature info with level details when needed
async function displayCompleteCreatureInfo(creature) {
    const populatedCreature = await Creature.findOne({ _id: creature._id })
        .populate('level')
        .setOptions({ populateLevel: true });

    const output = {
        _id: populatedCreature._id,
        creature_Id: populatedCreature.creature_Id,
        name: populatedCreature.name,
        type: populatedCreature.type,
        gold_coins: populatedCreature.gold_coins,
        description: populatedCreature.description,
        image: populatedCreature.image,
        level: {
            _id: populatedCreature.level._id,
            level: populatedCreature.level.level,
            attack: populatedCreature.level.attack,
            health: populatedCreature.level.health,
            speed: populatedCreature.level.speed,
            armor: populatedCreature.level.armor,
            critical_health: populatedCreature.level.critical_health,
            critical_damage: populatedCreature.level.critical_damage,
            gold_coins: populatedCreature.level.gold_coins
        },
        createdAt: populatedCreature.createdAt,
        updatedAt: populatedCreature.updatedAt,
        __v: populatedCreature.__v
    };
    console.log(JSON.stringify(output, null, 2));
}

// Function to query creature by ID with level info
async function queryCreatureById(creatureId) {
    try {
        const creature = await Creature.findOne({ creature_Id: creatureId }).populate('level');
        if (!creature) {
            console.log('Creature not found');
            return;
        }
        console.log('\nQueried Creature Information:');
        await displayCompleteCreatureInfo(creature);
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

        const newLevel = await CreatureLevel.findOne({
            creature_Id: creatureId,
            level: newLevelNumber
        });

        if (!newLevel) {
            console.log('Level not found');
            return;
        }

        creature.level = newLevel._id;
        creature.levelNumber = newLevel.level;
        await creature.save();

        console.log('\nUpdated Creature:');
        await displayCreatureInfo(creature);
    } catch (error) {
        console.error('Error updating creature level:', error);
    }
}

async function createLevelsAndCreatures() {
    try {
        const creatureTemplates = [
            {
                creature_Id: 'creature1',
                name: 'Dragon',
                type: 'Fire',
                gold_coins: 50,
                description: 'A fierce fire-breathing dragon',
                image: 'dragon.png'
            },
            {
                creature_Id: 'creature2',
                name: 'Griffin',
                type: 'Air',
                gold_coins: 75,
                description: 'A majestic flying creature',
                image: 'griffin.png'
            },
            {
                creature_Id: 'creature3',
                name: 'Hydra',
                type: 'Water',
                gold_coins: 100,
                description: 'A powerful multi-headed serpent',
                image: 'hydra.png'
            }
        ];

        const savedCreatures = [];
        
        // For each creature, create 40 levels and the creature itself
        for (const creatureTemplate of creatureTemplates) {
            // Create 40 levels for this creature
            const creatureLevels = [];
            for (let i = 1; i <= 40; i++) {
                const level = new CreatureLevel({
                    creature_Id: creatureTemplate.creature_Id,
                    level: i,
                    attack: 100 + (i - 1) * 20,
                    health: 1000 + (i - 1) * 200,
                    speed: 100,
                    armor: 50,
                    critical_health: 50,
                    critical_damage: 20,
                    gold_coins: 100
                });
                await level.save();
                creatureLevels.push(level);
            }
            console.log(`Created 40 levels for ${creatureTemplate.creature_Id}`);

            // Create the creature with its first level
            const creature = new Creature({
                ...creatureTemplate,
                level: creatureLevels[0]._id,
                levelNumber: 1
            });
            await creature.save();
            savedCreatures.push(creature);
            
            // Display the created creature
            console.log('\nCreated New Creature:');
            await displayCreatureInfo(creature);
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

        const savedBuildings = [];
        for (const buildingData of buildings) {
            const building = new Building(buildingData);
            await building.save();
            savedBuildings.push(building);
            console.log(`Created building: ${building.name}`);
        }

        // Create one user without any buildings
        const user = new User({
            userId: 'user1',
            user_name: 'Player1',
            gold_coins: 1000,
            buildings: []  // Empty buildings array
        });
        await user.save();
        console.log('Created user without any buildings');

        console.log('All data created successfully!');

    } catch (error) {
        console.error('Error:', error);
    }
}

async function main() {
    try {
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });
        await createLevelsAndCreatures();
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

main();