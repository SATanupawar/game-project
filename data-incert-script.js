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

        // Create buildings for each creature
        for (let i = 0; i < savedCreatures.length; i++) {
            const building = new Building({
                buildingId: `building${i + 1}`,
                name: `${savedCreatures[i].name} Lair`,
                gold_coins: 0,
                creature_id: savedCreatures[i]._id,
                creature_count: 1,
                position: {
                    x: 18,
                    y: 17 + i
                }
            });
            await building.save();
            console.log(`Created building for ${savedCreatures[i].name}`);
        }

        // Create buildings without creatures (original code)
        const buildingWithoutCreature1 = new Building({
            buildingId: 'building456',
            name: 'Gold Mine',
            gold_coins: 30,
            position: {
                x: 18,
                y: 17
            }
        });
        await buildingWithoutCreature1.save();

        const buildingWithoutCreature2 = new Building({
            buildingId: 'building789',
            name: 'Silver Mine',
            gold_coins: 20,
            position: {
                x: 18,
                y: 17
            }
        });
        await buildingWithoutCreature2.save();

        // Create user (original code)
        const userWithoutCreature = new User({
            userId: 'user456',
            user_name: 'Player2',
            gold_coins: 100,
            buildings: [buildingWithoutCreature1._id, buildingWithoutCreature2._id]
        });
        await userWithoutCreature.save();

        console.log('All data created successfully!');

        // Example: Update Dragon to level 5
        await updateCreatureLevel('creature1', 5);

        // Display all creatures in the database
        console.log('\nAll Creatures in Database:');
        const allCreatures = await Creature.find();
        for (const creature of allCreatures) {
            await displayCreatureInfo(creature);
            console.log('------------------------');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateUserBuildings() {
    try {
        // Find the building with a creature
        const buildingWithCreature = await Building.findOne({ buildingId: 'building1' });

        if (!buildingWithCreature) {
            console.log('Building with creature not found');
            return;
        }

        // Update the user's buildings to include the building with a creature
        const user = await User.findOneAndUpdate(
            { userId: 'user456' },
            { $addToSet: { buildings: buildingWithCreature._id } }, // Add the building if not already present
            { new: true }
        );

        console.log('Updated user:', user);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function main() {
    try {
        await mongoose.connect('mongodb+srv://satyam:game_project@cluster0.jr08s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true });
        await createLevelsAndCreatures();
        await updateUserBuildings();
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

main();