const mongoose = require('mongoose');
const Creature = require('./models/creature');

async function testCreatureQuery() {
    try {
        await mongoose.connect('mongodb+srv://satyam:game_project@cluster0.jr08s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Find the Dragon creature
        const creature = await Creature.findOne({ creature_Id: 'creature1' });
        
        // Format the output to match your desired structure
        const formattedCreature = {
            _id: creature._id,
            creature_Id: creature.creature_Id,
            name: creature.name,
            type: creature.type,
            gold_coins: creature.gold_coins,
            description: creature.description,
            image: creature.image,
            level: {
                _id: creature.level._id,
                level: creature.level.level,
                attack: creature.level.attack,
                health: creature.level.health,
                speed: creature.level.speed,
                armor: creature.level.armor,
                critical_health: creature.level.critical_health,
                critical_damage: creature.level.critical_damage,
                gold_coins: creature.level.gold_coins
            },
            createdAt: creature.createdAt,
            updatedAt: creature.updatedAt,
            __v: creature.__v
        };

        console.log(JSON.stringify(formattedCreature, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        mongoose.connection.close();
    }
}

testCreatureQuery(); 