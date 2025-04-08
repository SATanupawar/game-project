const mongoose = require('mongoose');
const User = require('./models/user'); // Adjust the path as needed
const Building = require('./models/building'); // Adjust the path as needed
const Creature = require('./models/creature'); // Adjust the path as needed

async function createData() {
    try {
        // Create a new creature
        const creature = new Creature({
            creature_Id: 'creature1',
            name: 'Dragon',
            type: 'Fire',
            gold_coins: 50,
            description: 'A fierce dragon',
            image: 'dragon.png'
        });
        await creature.save();

        // Create a new building with a reference to the creature
        const building = new Building({
            buildingId: 'building123',
            name: 'Dragon Lair',
            gold_coins: 0, // Set to 0 or appropriate value if creature generates gold
            creature_id: creature._id,
            creature_count: 1,
            position: {
                x: 18,
                y: 17
            }
        });
        await building.save();

        // Create a new building without a creature
        const buildingWithoutCreature1 = new Building({
            buildingId: 'building456',
            name: 'Gold Mine',
            gold_coins: 30,// Fixed gold coins for this building
            position: {
                x: 18,
                y: 17
            }
        });
        await buildingWithoutCreature1.save();

        // Create another building without a creature
        const buildingWithoutCreature2 = new Building({
            buildingId: 'building789',
            name: 'Silver Mine',
            gold_coins: 20, // Fixed gold coins for this building
            position: {
                x: 18,
                y: 17
            }
        });
        await buildingWithoutCreature2.save();

        // Create a new user with references to the buildings without creatures
        const userWithoutCreature = new User({
            userId: 'user456',
            user_name: 'Player2',
            gold_coins: 100,
            buildings: [buildingWithoutCreature1._id, buildingWithoutCreature2._id]
        });
        await userWithoutCreature.save();

        console.log('User without creature created:', userWithoutCreature);
        console.log('Building created:', building);
        console.log('Creature created:', creature);
        console.log('Building without creature 1 created:', buildingWithoutCreature1);
        console.log('Building without creature 2 created:', buildingWithoutCreature2);
    } catch (error) {
        console.error('Error:', error);
    }
}

async function updateUserBuildings() {
    try {
        // Find the building with a creature
        const buildingWithCreature = await Building.findOne({ buildingId: 'building123' });

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
        await createData();
        await updateUserBuildings();
    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

main();