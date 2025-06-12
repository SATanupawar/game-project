const mongoose = require('mongoose');
const BuildingDecoration = require('../models/buildingDecoration');

const decorationsData = [
  {
    name: "Flaming Tree",
    cost: 1050,
    boostPercent: 1,
    sizeString: "2x2",
    unlockLevel: 2
  },
  {
    name: "Hero's Statue",
    cost: 5730,
    boostPercent: 2,
    sizeString: "2x2",
    unlockLevel: 5
  },
  {
    name: "Stone Giant Statue",
    cost: 14840,
    boostPercent: 3,
    sizeString: "2x2",
    unlockLevel: 8
  },
  {
    name: "Serene Arch",
    cost: 14840,
    boostPercent: 3,
    sizeString: "3x3",
    unlockLevel: 12
  },
  {
    name: "Gargoyle Statue",
    cost: 39660,
    boostPercent: 3,
    sizeString: "2x2",
    unlockLevel: 15
  },
  {
    name: "Spirit Tree",
    cost: 53640,
    boostPercent: 5,
    sizeString: "2x2",
    unlockLevel: 19
  },
  {
    name: "Red Dragon Arch",
    cost: 66120,
    boostPercent: 4,
    sizeString: "3x3",
    unlockLevel: 22
  },
  {
    name: "Dragon Gate",
    cost: 77530,
    boostPercent: 6,
    sizeString: "3x3",
    unlockLevel: 26
  },
  {
    name: "Gothic Arch",
    cost: 94387,
    boostPercent: 5,
    sizeString: "3x3",
    unlockLevel: 30
  },
  {
    name: "Void Tree",
    cost: 173716,
    boostPercent: 5,
    sizeString: "3x3",
    unlockLevel: 34
  },
  {
    name: "Obelisk",
    cost: 201940,
    boostPercent: 4,
    sizeString: "2x2",
    unlockLevel: 38
  },
  {
    name: "Monolith",
    cost: 361394,
    boostPercent: 5,
    sizeString: "2x2",
    unlockLevel: 41
  },
  {
    name: "Engraved Arch",
    cost: 536810,
    boostPercent: 5,
    sizeString: "2x2",
    unlockLevel: 44
  },
  {
    name: "Sentry Tower",
    cost: 633000,
    boostPercent: 5,
    sizeString: "2x2",
    unlockLevel: 48
  },
  {
    name: "Shattered Arch",
    cost: 701770,
    boostPercent: 7,
    sizeString: "3x3",
    unlockLevel: 52
  },
  {
    name: "Netherworld Portal",
    cost: 803444,
    boostPercent: 7,
    sizeString: "3x3",
    unlockLevel: 56
  },
  {
    name: "Gilded Tree",
    cost: 977777,
    boostPercent: 7,
    sizeString: "2x2",
    unlockLevel: 60
  },
  {
    name: "Flame Spirit Tree",
    cost: 1114490,
    boostPercent: 7,
    sizeString: "2x2",
    unlockLevel: 63
  },
  {
    name: "Necrotic Tree",
    cost: 1243555,
    boostPercent: 5,
    sizeString: "2x2",
    unlockLevel: 67
  },
  {
    name: "Golden Tree",
    cost: 1544777,
    boostPercent: 8,
    sizeString: "2x2",
    unlockLevel: 70
  }
];

// Process building decorations
async function processDecorations() {
  try {
    // Process each decoration to add required fields
    const processedDecorations = decorationsData.map(decoration => {
      // Parse size string into dimensions
      let size = { x: 1, y: 1 };
      
      if (decoration.sizeString) {
        const sizeMatch = decoration.sizeString.match(/(\d+)x(\d+)/);
        if (sizeMatch) {
          size = {
            x: parseInt(sizeMatch[1]),
            y: parseInt(sizeMatch[2])
          };
        }
      }
      
      // Create a normalized ID from the name
      const decorationId = decoration.name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
        
      // Add default description if not provided
      const description = decoration.description || 
        `A beautiful ${decoration.name} that provides a ${decoration.boostPercent}% boost to your buildings.`;
      
      return {
        ...decoration,
        decorationId,
        size,
        description,
        image: decoration.image || `${decorationId}.png`
      };
    });
    
    return processedDecorations;
  } catch (error) {
    console.error('Error processing decorations:', error);
    throw error;
  }
}

async function populateBuildingDecorations() {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    console.log('Connected to MongoDB Atlas');
    
    // Check if decorations already exist
    const decorationCount = await BuildingDecoration.countDocuments();
    if (decorationCount > 0) {
      console.log(`${decorationCount} building decorations already exist.`);
      
      // Option to delete existing decorations and recreate them
      const deleteExisting = process.env.RECREATE_DECORATIONS === 'true';
      if (deleteExisting) {
        console.log('Deleting existing building decorations to recreate them...');
        await BuildingDecoration.deleteMany({});
        console.log('Existing building decorations deleted.');
      } else {
        console.log('Skipping recreation of building decorations.');
        
        // Display information about existing decorations
        const existingDecorations = await BuildingDecoration.find().sort('unlockLevel');
        console.log('\nExisting building decorations:');
        console.log('ID | Name | Level | Cost | Boost% | Size');
        console.log('----------------------------------------');
        existingDecorations.forEach(decoration => {
          console.log(`${decoration.decorationId} | ${decoration.name} | ${decoration.unlockLevel} | ${decoration.cost} | ${decoration.boostPercent}% | ${decoration.size.x}x${decoration.size.y}`);
        });
        
        mongoose.connection.close();
        console.log('Database connection closed');
        return;
      }
    }
    
    // Process decoration data
    const processedDecorations = await processDecorations();
    
    // Insert all decorations
    const savedDecorations = await BuildingDecoration.insertMany(processedDecorations);
    
    console.log(`Successfully added ${savedDecorations.length} building decorations:`);
    console.log('ID | Name | Level | Cost | Boost% | Size');
    console.log('----------------------------------------');
    savedDecorations.forEach(decoration => {
      console.log(`${decoration.decorationId} | ${decoration.name} | ${decoration.unlockLevel} | ${decoration.cost} | ${decoration.boostPercent}% | ${decoration.size.x}x${decoration.size.y}`);
    });
    
  } catch (error) {
    console.error('Error populating building decorations:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
populateBuildingDecorations(); 