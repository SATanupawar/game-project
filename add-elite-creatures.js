const mongoose = require('mongoose');
const Creature = require('./models/creature');

async function addEliteCreatures() {
    try {
        // Connect to MongoDB Atlas
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true 
        });
        console.log('Connected to MongoDB Atlas');

        // Create Darkfire Dragon (Elite Creature 1)
        const darkfireDragon = new Creature({
            creature_Id: 'darkfire_dragon',
            name: 'Darkfire Dragon',
            type: 'elite',
            gold_coins: 2000,
            arcane_energy: 1500,
            description: 'An elite dragon with powerful fire abilities that can destroy aegis and inflict burn damage.',
            image: 'creatures/darkfire_dragon.png',
            level: 1,
            base_attack: 1053,
            base_health: 3555,
            speed: 107,
            armor: 0,
            critical_damage_percentage: 30,
            critical_damage: 100,
            unlock_time: 1440,
            interval_time: 720,
            unlock_level: 41,
            creature_type: 'Draconic',
            anima_cost: 1500
        });

        // Create Voidflame Dragon (Elite Creature 2)
        const voidflameDragon = new Creature({
            creature_Id: 'voidflame_dragon',
            name: 'Voidflame Dragon',
            type: 'elite',
            gold_coins: 2000,
            arcane_energy: 1500,
            description: 'An elite dragon with void flame abilities that can cleanse negative effects and increase defense.',
            image: 'creatures/voidflame_dragon.png',
            level: 1,
            base_attack: 1012,
            base_health: 3440,
            speed: 110,
            armor: 0,
            critical_damage_percentage: 25,
            critical_damage: 100,
            unlock_time: 1440,
            interval_time: 720,
            unlock_level: 42,
            creature_type: 'Draconic',
            anima_cost: 1500
        });

        // Save Darkfire Dragon
        await darkfireDragon.save();
        console.log('Darkfire Dragon saved successfully!');
        
        // Save Voidflame Dragon
        await voidflameDragon.save();
        console.log('Voidflame Dragon saved successfully!');
        
        console.log('Both elite creatures have been added to the database.');

    } catch (error) {
        console.error('Error adding elite creatures:', error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the script
addEliteCreatures(); 