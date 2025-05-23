const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Creature = require('../models/creature');

// MongoDB connection
mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Connected');
    addCreatures();
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});

async function addCreatures() {
    try {
        // Check if we should recreate all creatures
        const RECREATE_CREATURES = process.env.RECREATE_CREATURES === 'true';

        if (RECREATE_CREATURES) {
            // Delete all existing creatures
            await Creature.deleteMany({});
            console.log('Deleted all existing creatures');
        } else {
            console.log('Adding creatures without deleting existing ones');
            console.log('To recreate all creatures, set RECREATE_CREATURES=true');
        }

        // Read the monster data from the JSON file
        const monsterData = JSON.parse(fs.readFileSync(path.join(__dirname, '../monster_data_fixed.json'), 'utf8'));
        console.log(`Loaded ${monsterData.length} creatures from monster_data_fixed.json`);

        // Count creatures by type
        const typeCount = {
            common: 0,
            rare: 0,
            epic: 0,
            legendary: 0
        };

        // Process each monster and add to database
        for (const monster of monsterData) {
            // Convert percentage strings to numbers for the model
            let armor = 0;
            if (monster.armor !== 'N/A' && monster.armor !== '0%') {
                armor = parseInt(monster.armor.replace('%', ''));
            }

            let critPercentage = 0;
            if (monster.critical_damage_percentage !== 'N/A') {
                critPercentage = parseInt(monster.critical_damage_percentage.replace('%', ''));
            }

            let critDamage = 100;
            if (monster.critical_damage !== 'N/A') {
                critDamage = parseInt(monster.critical_damage.replace('%', ''));
            }

            // Create a unique creature ID based on name
            const creatureId = monster.name.toLowerCase().replace(/\s+/g, '_');
            
            // Create the creature document
            const creature = new Creature({
                creature_Id: creatureId,
                name: monster.name,
                type: monster.type,
                gold_coins: monster.gold,
                arcane_energy: monster.arcane_energy,
                description: `A ${monster.type} ${monster.creature_type} creature that unlocks at level ${monster.unlock_level}.`,
                image: `creatures/${creatureId}.png`, // Assuming image naming convention
                level: 1,
                base_attack: monster.attack,
                base_health: monster.health,
                speed: monster.speed,
                armor: armor,
                critical_damage_percentage: critPercentage,
                critical_damage: critDamage,
                unlock_time: monster.unlock_time,
                interval_time: monster.interval_time,
                unlock_level: monster.unlock_level,
                creature_type: monster.creature_type,
                anima_cost: monster.anima_cost
            });

            // Save the creature to the database
            await creature.save();
            
            // Update count for this type
            typeCount[monster.type]++;
        }

        // Log summary of added creatures
        console.log('Successfully added creatures:');
        console.log(`Common: ${typeCount.common}`);
        console.log(`Rare: ${typeCount.rare}`);
        console.log(`Epic: ${typeCount.epic}`);
        console.log(`Legendary: ${typeCount.legendary}`);
        console.log(`Total: ${Object.values(typeCount).reduce((a, b) => a + b, 0)}`);
        
        console.log('All creatures have been added to the database');
        mongoose.connection.close();
    } catch (error) {
        console.error('Error adding creatures:', error);
        mongoose.connection.close();
    }
} 