require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

// Import the Creature model
const Creature = require('./models/creature');

// Connect to the database
connectDB();

// Path to the JSON file
const jsonFilePath = path.resolve(__dirname, '../monster_data_fixed.json');

// Function to convert percentage string to number
const percentageToNumber = (percentageStr) => {
  if (!percentageStr || percentageStr === 'N/A') return 0;
  return parseInt(percentageStr.replace('%', ''));
};

// Function to generate a unique creature ID
const generateCreatureId = (name) => {
  return name.toLowerCase().replace(/\s+/g, '_');
};

// Function to import monsters
const importMonsters = async () => {
  try {
    console.log('Reading monster data from JSON file...');
    const monsterData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    
    // Count existing creatures
    const existingCount = await Creature.countDocuments();
    console.log(`Found ${existingCount} existing creatures in the database.`);
    
    if (existingCount > 0) {
      console.log('Removing existing creatures...');
      await Creature.deleteMany({});
      console.log('Existing creatures removed successfully.');
    }
    
    console.log(`Importing ${monsterData.length} monsters...`);
    
    for (const monster of monsterData) {
      // Create a new creature document
      const creature = new Creature({
        creature_Id: generateCreatureId(monster.name),
        name: monster.name,
        type: monster.type,
        gold_coins: monster.gold,
        arcane_energy: monster.arcane_energy,
        description: `A powerful ${monster.creature_type} creature.`,
        image: `creatures/${generateCreatureId(monster.name)}.png`, // Assuming image naming convention
        level: 1,
        base_attack: monster.attack,
        base_health: monster.health,
        speed: monster.speed,
        armor: percentageToNumber(monster.armor),
        critical_damage_percentage: percentageToNumber(monster.critical_damage_percentage),
        critical_damage: percentageToNumber(monster.critical_damage),
        unlock_time: monster.unlock_time,
        interval_time: monster.interval_time,
        unlock_level: monster.unlock_level,
        creature_type: monster.creature_type,
        anima_cost: monster.anima_cost
      });
      
      // Generate level stats for the creature
      creature.generateLevelStats();
      
      // Save the creature to the database
      await creature.save();
      console.log(`Imported: ${monster.name}`);
    }
    
    console.log('Import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error importing monsters:', error);
    process.exit(1);
  }
};

// Run the import function
importMonsters(); 