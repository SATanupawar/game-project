const mongoose = require("mongoose");
const CreatureLevel = require("./models/creature_level");

async function createLevels() {
    await mongoose.connect('mongodb+srv://satyam:game_project@cluster0.jr08s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const levels = [];
    for (let i = 1; i <= 40; i++) {
        levels.push({
            level: i,
            attack: 100 + (i - 1) * 20, // Increment attack by 20 per level
            health: 1000 + (i - 1) * 200, // Increment health by 200 per level
            speed: 100,
            armor: 50,
            critical_damage_percentage: 50,
            critical_damage: 20,
            gold_coins: 100
        });
    }

    try {
        await CreatureLevel.insertMany(levels);
        console.log('Levels created successfully.');
    } catch (error) {
        console.error('Error creating levels:', error);
    } finally {
        mongoose.connection.close();
    }
}

createLevels();