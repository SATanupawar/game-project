const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const connectDB = require('./config/db');

// Connect to MongoDB
connectDB();

// Import the Building model
const Building = require('./models/building');

async function createCreatureBuilding() {
  try {
    // Check if a creature building already exists
    const existingBuilding = await Building.findOne({ name: 'Creature Building' });
    
    if (existingBuilding) {
      console.log('Creature Building already exists:', existingBuilding);
      return existingBuilding;
    }
    
    // Create a new building
    const newBuilding = new Building({
      buildingId: 'creature_building',
      name: 'Creature Building',
      type: 'creature_habitat',
      gold_coins: 100,
      size: { x: 3, y: 3 },
      unlock_level: 1,
      description: 'A special building for housing creatures',
      image: 'buildings/creature_building.png'
    });
    
    // Save to database
    await newBuilding.save();
    
    console.log('Creature Building created successfully:', newBuilding);
    return newBuilding;
  } catch (error) {
    console.error('Error creating Creature Building:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the function
createCreatureBuilding(); 