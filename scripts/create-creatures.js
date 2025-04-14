/**
 * Script to initialize creatures in the database
 * Run with: node scripts/create-creatures.js
 */
const mongoose = require('mongoose');
const Creature = require('../models/creature');

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/game-db', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Creature templates with base stats
const creatureTemplates = [
    // Common creatures
    {
        creature_Id: 'goblin',
        name: 'Goblin',
        type: 'melee',
        rarity: 'common',
        base_attack: 10,
        base_health: 50,
        gold_coins: 5,
        description: 'A small but vicious goblin that attacks with primitive weapons.',
        image: 'goblin.png',
        speed: 100,
        armor: 40,
        critical_health: 50,
        critical_damage: 15
    },
    {
        creature_Id: 'skeleton',
        name: 'Skeleton',
        type: 'ranged',
        rarity: 'common',
        base_attack: 12,
        base_health: 45,
        gold_coins: 5,
        description: 'An undead skeleton armed with a bow, firing bone arrows.',
        image: 'skeleton.png',
        speed: 90,
        armor: 30,
        critical_health: 40,
        critical_damage: 20
    },
    
    // Rare creatures
    {
        creature_Id: 'orc',
        name: 'Orc Warrior',
        type: 'melee',
        rarity: 'rare',
        base_attack: 18,
        base_health: 80,
        gold_coins: 10,
        description: 'A brutal orc warrior wielding a heavy axe.',
        image: 'orc.png',
        speed: 85,
        armor: 60,
        critical_health: 55,
        critical_damage: 25
    },
    {
        creature_Id: 'witch',
        name: 'Forest Witch',
        type: 'magic',
        rarity: 'rare',
        base_attack: 22,
        base_health: 65,
        gold_coins: 12,
        description: 'A mysterious witch who casts powerful nature spells.',
        image: 'witch.png',
        speed: 80,
        armor: 50,
        critical_health: 60,
        critical_damage: 30
    },
    
    // Epic creature
    {
        creature_Id: 'golem',
        name: 'Stone Golem',
        type: 'tank',
        rarity: 'epic',
        base_attack: 25,
        base_health: 150,
        gold_coins: 20,
        description: 'A massive golem made of living stone, nearly impervious to damage.',
        image: 'golem.png',
        speed: 60,
        armor: 80,
        critical_health: 70,
        critical_damage: 20
    },
    
    // Legendary creature
    {
        creature_Id: 'dragon',
        name: 'Fire Dragon',
        type: 'boss',
        rarity: 'legendary',
        base_attack: 45,
        base_health: 250,
        gold_coins: 50,
        description: 'A terrifying dragon that breathes fire and causes destruction everywhere it goes.',
        image: 'dragon.png',
        speed: 120,
        armor: 100,
        critical_health: 85,
        critical_damage: 50
    }
];

// Function to initialize creatures
async function initializeCreatures() {
    try {
        // Check if creatures already exist
        const count = await Creature.countDocuments();
        if (count > 0) {
            console.log(`Database already has ${count} creatures. Skipping initialization.`);
            console.log('To recreate creatures, please drop the collection first.');
            return;
        }
        
        console.log('Creating creatures...');
        
        // Create all creatures
        for (const template of creatureTemplates) {
            const creature = new Creature(template);
            await creature.save();
            
            // Calculate stats at level 1
            const stats = creature.getCurrentStats();
            
            console.log(`Created ${creature.rarity} creature: ${creature.name}`);
            console.log(`  Base Attack: ${creature.base_attack}, Current Attack: ${stats.attack}`);
            console.log(`  Base Health: ${creature.base_health}, Current Health: ${stats.health}`);
            console.log(`  Growth rates: Attack ${creature.attack_growth}%, Health ${creature.health_growth}%`);
            console.log('--------------------------');
        }
        
        console.log('Creature initialization complete!');
    } catch (error) {
        console.error('Error creating creatures:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the initialization
initializeCreatures(); 