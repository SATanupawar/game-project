// Save this as insertCreatureSlots.js

const mongoose = require('mongoose');
require('dotenv').config();

// Define the CreatureSlot schema
const creatureSlotSchema = new mongoose.Schema({
  slot_number: {
    type: Number,
    required: true,
    unique: true
  },
  is_elite: {
    type: Boolean,
    default: false
  },
  gold_cost: {
    type: Number,
    default: 0
  },
  is_default: {
    type: Boolean,
    default: false
  }
});

// Create the model
const CreatureSlot = mongoose.model('CreatureSlot', creatureSlotSchema);

// Connect to MongoDB
mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Connected');
    insertSlots();
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
});

// Function to insert the slots
async function insertSlots() {
  try {
    // First clear any existing slots
    await CreatureSlot.deleteMany({});
    console.log('Cleared existing creature slots');

    // Define the default slots
    const slots = [
      {
        slot_number: 1,
        is_elite: false,
        gold_cost: 100,
        is_default: true
      },
      {
        slot_number: 2,
        is_elite: false,
        gold_cost: 200,
        is_default: false
      },
      {
        slot_number: 3,
        is_elite: true,
        gold_cost: 0,
        is_default: false
      },
      {
        slot_number: 4,
        is_elite: true,
        gold_cost: 0,
        is_default: false
      },
      {
        slot_number: 5,
        is_elite: true,
        gold_cost: 0,
        is_default: false
      }
    ];

    // Insert the slots
    const result = await CreatureSlot.insertMany(slots);
    console.log(`Successfully inserted ${result.length} creature slots`);
    
    // Display the inserted slots
    console.log('Inserted slots:');
    result.forEach(slot => {
      console.log(`Slot ${slot.slot_number}: Elite=${slot.is_elite}, Gold=${slot.gold_cost}, Default=${slot.is_default}`);
    });

    // Close the connection
    mongoose.connection.close();
    console.log('MongoDB connection closed');
    
    // Exit process
    process.exit();
  } catch (error) {
    console.error('Error inserting creature slots:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}