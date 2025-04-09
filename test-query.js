const mongoose = require('mongoose');
const Creature = require('./models/creature');

async function testQuery() {
    try {
        await mongoose.connect('mongodb+srv://satyam:game_project@cluster0.jr08s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Find all creatures with their level information
        const creatures = await Creature.find();
        
        creatures.forEach(creature => {
            console.log(`\nCreature Information:`);
            console.log(`Name: ${creature.name}`);
            console.log(`Creature ID: ${creature.creature_Id}`);
            console.log(`Level Number: ${creature.level.level}`);
            console.log(`Level ID: ${creature.level._id}`);
            console.log(`Attack: ${creature.level.attack}`);
            console.log(`Health: ${creature.level.health}`);
            console.log('------------------------');
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

testQuery(); 