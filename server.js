const path = require('path');
const fs = require('fs');

const envPath = path.resolve(__dirname, '.env');
console.log('Loading .env file from:', envPath);

// Check if .env file exists
if (fs.existsSync(envPath)) {
    console.log('.env file exists');
    // Read and log the first few characters of the file (without sensitive data)
    const envContent = fs.readFileSync(envPath, 'utf8');
    console.log('First 100 characters of .env file:', envContent.substring(0, 100));
} else {
    console.log('.env file does not exist');
}

require('dotenv').config({ path: envPath });

// Debug environment variables
console.log('\nEnvironment variables loaded:');
console.log('firebase_type:', process.env.firebase_type);
console.log('firebase_project_id:', process.env.firebase_project_id);
console.log('firebase_private_key_id:', process.env.firebase_private_key_id);
console.log('firebase_client_email:', process.env.firebase_client_email);
console.log('mongodb_uri:', process.env.mongodb_uri);
console.log('port:', process.env.port);
console.log('node_env:', process.env.node_env);

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoute');
const buildingRoutes = require('./routes/buildingRoute');
const creatureRoutes = require('./routes/creatureRoute');
const cardPackRoutes = require('./routes/cardPackRoute');
const buildingDecorationRoutes = require('./routes/buildingDecorationRoute');
const chestRoutes = require('./routes/chest');
const arcaneEnergyRoutes = require('./routes/arcaneEnergyRoute');
const pushNotificationRoutes = require('./routes/pushNotificationRoute');
const authRoutes = require('./routes/authRoute');
const logRoutes = require('./routes/logRoute');
const matchmakingRoutes = require('./routes/matchmakingRoute');
const questRoutes = require('./routes/questRoute');
const pathRoutes = require('./routes/paths');
const User = require('./models/user');
const Creature = require('./models/creature');
const mongoose = require('mongoose');
const Building = require('./models/building');
const userService = require('./service/userService');
const leaderboardRoutes = require('./routes/leaderboardRoute');
const battlePassRoutes = require('./routes/battlePassRoute');
const subscriptionRoutes = require('./routes/subscriptionRoute');
const battlePassProgressRoutes = require('./routes/battlePassProgressRoute');
const subscriptionService = require('./service/subscriptionService');
const gameLiftLogsRoutes = require('./routes/logs');

// Import logging middleware
const { requestLogger, errorLogger } = require('./middleware/loggerMiddleware');

const app = express();

// Connect to MongoDB
connectDB();

// Enhanced CORS configuration
app.use(cors({
    origin: '*',  // Allow requests from any origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add request logging middleware
app.use(requestLogger);

// Serve static files from the public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Public routes
app.use('/api/users', userRoutes); // Registration and user creation should remain public
app.use('/api/auth', authRoutes); // New auth routes - public access
app.use('/api/logs', logRoutes); // Logging routes - normally these would be admin-only
app.use('/api/matchmaking', matchmakingRoutes); // Add matchmaking routes
app.use('/api/quests', questRoutes); // Quest routes
app.use('/api', gameLiftLogsRoutes); // GameLift logs route

// Protected routes (require authentication)
app.use('/api/buildings', buildingRoutes);
app.use('/api/creatures', creatureRoutes);

// Initialize creature slots during startup
const CreatureSlot = require('./models/creatureSlot');
CreatureSlot.initializeSlots()
  .then(() => console.log('Creature slots initialized'))
  .catch(err => console.error('Error initializing creature slots:', err));
app.use('/api/card-packs', cardPackRoutes);
app.use('/api/building-decorations', buildingDecorationRoutes);
app.use('/api/chests', chestRoutes);
app.use('/api/arcane-energy', arcaneEnergyRoutes);
app.use('/api/notifications', pushNotificationRoutes);

// Add to your routes
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api', battlePassRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api', battlePassProgressRoutes);
app.use('/api/paths', pathRoutes);

// Direct endpoint to get a user's data with battle creatures
app.get('/api/user/:userId/battle-data', async (req, res) => {
  try {
    console.log('Direct battle data route hit', req.params);
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId'
      });
    }

    // Find user without populate - we'll handle the creature_id manually
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('Found user battle creatures:', JSON.stringify(user.battle_selected_creatures || []));
    
    // Process user data into response format
    const processedCreatures = user.battle_selected_creatures.map(creature => {
      // Simply use the creature_id directly - no need for complex handling
      return {
        creature_id: creature.creature_id.toString(), // Convert ObjectId to string
        name: creature.name,
        level: creature.level,
        type: creature.type,
        attack: creature.attack,
        health: creature.health,
        speed: creature.speed || 0,
        armor: creature.armor || 0,
        critical_damage: creature.critical_damage || 0,
        critical_damage_percentage: creature.critical_damage_percentage || 0,
        creature_type: creature.creature_type || "Beast"
      };
    });
    
    const userData = {
      userId: user.userId,
      username: user.user_name,
      trophies: user.trophy_count || 0,
      profilePicture: user.profile_picture || 'default.jpg',
      level: user.level || 1,
      title: user.title || '',
      battle_selected_creatures: processedCreatures
    };
    
    res.status(200).json({
      success: true,
      data: userData
    });
  } catch (error) {
    console.error('Error in direct battle data route:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting battle data: ${error.message}`
    });
  }
});

// Diagnostic endpoint to check the raw user data and creature IDs
app.get('/api/user/:userId/raw-data', async (req, res) => {
  try {
    console.log('Raw data diagnostic endpoint hit', req.params);
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId'
      });
    }

    // Find user with all fields
    const user = await User.findOne({ userId });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Show the raw battle_selected_creatures data for debugging
    console.log('Raw battle_selected_creatures:', JSON.stringify(user.battle_selected_creatures || []));
    
    // Get specific details about the creature_id field
    const creatureDetails = user.battle_selected_creatures.map(creature => ({
      creature_id: creature.creature_id,
      creature_id_type: typeof creature.creature_id,
      creature_id_to_string: creature.creature_id ? creature.creature_id.toString() : null,
      is_object_id: creature.creature_id instanceof mongoose.Types.ObjectId,
      has_value: !!creature.creature_id
    }));
    
    console.log('Creature ID details:', JSON.stringify(creatureDetails));
    
    // Return full user data and specialized creature_id diagnostics
    res.status(200).json({
      success: true,
      userData: user,
      creatureDetails
    });
  } catch (error) {
    console.error('Error in raw data diagnostic route:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting raw data: ${error.message}`
    });
  }
});

// Direct creature purchase route to bypass any conflicts with userRoutes
app.post('/api/user/:userId/creature/purchase', async (req, res) => {
  try {
    console.log('Direct creature purchase route hit', req.params, req.body);
    const { userId } = req.params;
    const { creatureType, slotNumber } = req.body;
    
    if (!userId || !creatureType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, creatureType'
      });
    }
    
    // Use default slot 1 if not specified, ensure it's a number
    const slot = slotNumber ? parseInt(slotNumber) : 1;
    console.log(`Using slot number: ${slot} (type: ${typeof slot})`);
    
    // Use the userService function to purchase creature
    const userService = require('./service/userService');
    const result = await userService.purchaseCreature(userId, creatureType, slot);
    
    // Return the result
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error in direct creature purchase route:', error);
    return res.status(500).json({
      success: false,
      message: `Error purchasing creature: ${error.message}`
    });
  }
});

// Direct route for getting a user's creature inventory
app.get('/api/user/:userId/creature-inventory', async (req, res) => {
  try {
    console.log('Direct creature inventory route hit', req.params);
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false, 
        message: 'Missing required field: userId'
      });
    }

    // Use the userService function to get creature inventory
    const userService = require('./service/userService');
    const result = await userService.getCreatureInventory(userId);
    
    // Return the result
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    console.error('Error in direct creature inventory route:', error);
    return res.status(500).json({
      success: false,
      message: `Error getting creature inventory: ${error.message}`
    });
  }
});

// Keep old route for backward compatibility
app.post('/api/direct-creature-purchase', async (req, res) => {
  try {
    const { userId, creatureType } = req.body;
    // Forward the request to the new endpoint
    res.redirect(307, `/api/user/${userId}/creature/purchase`);
  } catch (error) {
    console.error('Error in direct creature purchase route:', error);
    return res.status(500).json({
      success: false,
      message: `Error purchasing creature: ${error.message}`
    });
  }
});

// Direct route for assigning creatures to buildings
app.post('/api/user/:userId/creature/assign-to-building', async (req, res) => {
  try {
    console.log('Direct creature assign-to-building route hit', req.params, req.body);
    const { userId } = req.params;
    const { creatureId, buildingId, buildingIndex, position } = req.body;
    
    if (!userId || !creatureId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, creatureId'
      });
    }

    // Find user
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find the creature
    const creatureIndex = user.creatures.findIndex(
      c => c._id.toString() === creatureId
    );
    
    if (creatureIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Creature not found'
      });
    }

    // Handle two different scenarios:
    // 1. If buildingIndex is provided, add to existing building
    // 2. If buildingId is provided, create a new building
    
    if (buildingIndex !== undefined) {
      // Scenario 1: Add creature to existing building
      const buildingIdx = parseInt(buildingIndex);
      const existingBuilding = user.buildings.find(b => b.index === buildingIdx);
      
      if (!existingBuilding) {
        return res.status(404).json({
          success: false,
          message: `Building with index ${buildingIdx} not found`
        });
      }
      
      // Check if there are already creatures in this building
      const buildingCreatures = user.creatures.filter(c => c.building_index === buildingIdx);
      if (buildingCreatures.length > 0) {
        // Get the creature to assign
        const newCreature = user.creatures[creatureIndex];
        
        // Primary validation: Check creature_Id_reference first
        if (newCreature.creature_Id_reference && buildingCreatures[0].creature_Id_reference) {
          const existingReference = buildingCreatures[0].creature_Id_reference.toLowerCase();
          const newReference = newCreature.creature_Id_reference.toLowerCase();
          
          // If references don't match, return error
          if (existingReference !== newReference) {
            return res.status(400).json({
              success: false,
              message: `This building already contains ${buildingCreatures[0].name} creatures. You can only assign creatures of the same type to this building.`,
              data: {
                existing_creature_reference: existingReference,
                new_creature_reference: newReference
              }
            });
          }
        }
        // Fallback validation: Check creature_type if creature_Id_reference is not available
        else {
          // Get the type of creatures currently in the building
          const existingType = buildingCreatures[0].creature_type?.toLowerCase();
          const newCreatureType = newCreature.creature_type?.toLowerCase();
          
          // If the types don't match, return an error
          if (existingType && existingType !== newCreatureType) {
            return res.status(400).json({
              success: false,
              message: `This building already contains ${buildingCreatures[0].name} creatures. You can only assign creatures of the same type to this building.`,
              data: {
                existing_creature_type: existingType,
                new_creature_type: newCreatureType
              }
            });
          }
        }
      }
      
      // Update the creature to reference the existing building
      user.creatures[creatureIndex].building_index = buildingIdx;
      
      // Add creature to building's creatures array if it doesn't already exist
      if (!existingBuilding.creatures) {
        existingBuilding.creatures = [];
      }
      
      if (!existingBuilding.creatures.some(id => id.toString() === user.creatures[creatureIndex]._id.toString())) {
        existingBuilding.creatures.push(user.creatures[creatureIndex]._id);
      }
      
      // Mark as modified
      user.markModified('buildings');
      user.markModified('creatures');
      
      // Save user
      await user.save();
      
      // Ensure relationship consistency
      try {
        await userService.fixBuildingCreatureRelationships(userId);
      } catch (relError) {
        console.error('Error ensuring relationship consistency:', relError);
        // Continue anyway since the basic operation succeeded
      }
      
      return res.status(200).json({
        success: true,
        message: `Creature assigned to existing building with index ${buildingIdx}`,
        data: {
          building: existingBuilding,
          creature: user.creatures[creatureIndex]
        }
      });
      
    } else if (buildingId) {
      // Scenario 2: Create a new building (existing functionality)
      // Default to 'creature_building' if no buildingId is provided
      const buildingTypeId = buildingId || 'creature_building';
      
      // Find the building template
      const buildingTemplate = await Building.findOne({ buildingId: buildingTypeId });
      if (!buildingTemplate) {
        return res.status(404).json({
          success: false,
          message: `Building type ${buildingTypeId} not found`
        });
      }
      
      // Generate a unique index for the new building
      const newBuildingIndex = Math.floor(Math.random() * 10000000000);
      
      // Use provided position or default
      const buildingPosition = position || { x: 10, y: 10 };
      
      // Create a new building for the user
      const newBuilding = {
        buildingId: buildingTemplate.buildingId,
        name: buildingTemplate.name,
        gold_coins: buildingTemplate.gold_coins || 0,
        position: buildingPosition,
        size: buildingTemplate.size || { x: 2, y: 2 },
        index: newBuildingIndex,
        reserveCoins: 0,
        last_collected: new Date(),
        creatures: []
      };
      
      // Initialize buildings array if it doesn't exist
      if (!user.buildings) {
        user.buildings = [];
      }
      
      // Add the building to the user
      user.buildings.push(newBuilding);
      
      // Update the creature to reference the new building
      user.creatures[creatureIndex].building_index = newBuildingIndex;
      
      // Add creature to building's creatures array
      if (!newBuilding.creatures) {
        newBuilding.creatures = [];
      }
      newBuilding.creatures.push(user.creatures[creatureIndex]._id);
      
      // Mark as modified
      user.markModified('buildings');
      user.markModified('creatures');
      
      // Save user
      await user.save();
      
      // Ensure relationship consistency
      try {
        await userService.fixBuildingCreatureRelationships(userId);
      } catch (relError) {
        console.error('Error ensuring relationship consistency:', relError);
        // Continue anyway since the basic operation succeeded
      }
      
      return res.status(200).json({
        success: true,
        message: `New building created and creature assigned successfully`,
        data: {
          building: newBuilding,
          creature: user.creatures[creatureIndex]
        }
      });
    } else {
      // Neither buildingId nor buildingIndex provided
      return res.status(400).json({
        success: false,
        message: 'Either buildingId or buildingIndex must be provided'
      });
    }
  } catch (error) {
    console.error('Error in assign creature to building route:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

// Keep old route for backward compatibility
app.post('/api/creature/assign-to-building', async (req, res) => {
  try {
    const { userId } = req.body;
    // Forward the request to the new endpoint
    res.redirect(307, `/api/user/${userId}/creature/assign-to-building`);
  } catch (error) {
    console.error('Error in creature assign-to-building route:', error);
    return res.status(500).json({
      success: false,
      message: `Error assigning creature to building: ${error.message}`
    });
  }
});

// Direct route for unlocking a creature
app.post('/api/user/:userId/creature/unlock', async (req, res) => {
    try {    
        console.log('Direct creature unlock route hit', req.params, req.body);    
        const { userId } = req.params;    
        const { creatureId, forceUnlock } = req.body;
        
        if (!userId || !creatureId) {
          return res.status(400).json({
            success: false,
            message: 'Missing required fields: userId, creatureId'
          });
        }
        
        // Import the userService
        const userService = require('./service/userService');
        
        // Pass forceUnlock parameter
        const result = await userService.unlockCreature(userId, creatureId, forceUnlock);
        
        if (!result.success) {
          return res.status(400).json(result);
        }
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in unlock creature route:', error);
        return res.status(500).json({
          success: false,
          message: `Server error: ${error.message}`
        });
    }
});

// Keep old route for backward compatibility
app.post('/api/creature/unlock', async (req, res) => {
  try {
    const { userId, creatureId, forceUnlock } = req.body;
    // Forward all parameters including forceUnlock
    const result = await userService.unlockCreature(userId, creatureId, forceUnlock);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Error in creature unlock route:', error);
    return res.status(500).json({
      success: false,
      message: `Error unlocking creature: ${error.message}`
    });
  }
});

// Direct route for starting the unlock timer for a creature
app.post('/api/user/:userId/creature/start-unlock', async (req, res) => {
  try {
    console.log('Direct creature start-unlock route hit', req.params, req.body);
    const { userId } = req.params;
    const { creatureId } = req.body;
    
    if (!userId || !creatureId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, creatureId'
      });
    }
    
    // Import the userService
    const userService = require('./service/userService');
    
    // Call the start unlock function
    const result = await userService.startCreatureUnlock(userId, creatureId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in start creature unlock route:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

// Keep old route for backward compatibility
app.post('/api/creature/start-unlock', async (req, res) => {
  try {
    const { userId } = req.body;
    // Forward the request to the new endpoint
    res.redirect(307, `/api/user/${userId}/creature/start-unlock`);
  } catch (error) {
    console.error('Error in creature start-unlock route:', error);
    return res.status(500).json({
      success: false,
      message: `Error starting creature unlock: ${error.message}`
    });
  }
});

// Direct route for checking creature unlock status - already has userId in URL
app.get('/api/creature/unlock-status/:userId', async (req, res) => {
  try {
    console.log('Direct creature unlock-status route hit', req.params);
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId'
      });
    }
    
    // Import the userService
    const userService = require('./service/userService');
    
    // Call the check unlock status function
    const result = await userService.checkCreatureUnlockStatus(userId);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in check creature unlock status route:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

// Add another route with consistent pattern
app.get('/api/user/:userId/creature/unlock-status', async (req, res) => {
  try {
    console.log('User creature unlock-status route hit', req.params);
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: userId'
      });
    }
    
    // Import the userService
    const userService = require('./service/userService');
    
    // Call the check unlock status function
    const result = await userService.checkCreatureUnlockStatus(userId);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in check creature unlock status route:', error);
    return res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
});

// Get a user with buildings and creatures
app.get('/api/users/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate({
            path: 'buildings',
            populate: { path: 'creature_id' }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Basic route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Game Backend API' });
});

// Serve the log downloader HTML page
app.get('/log-downloader', (req, res) => {
    res.sendFile(path.join(__dirname, 'download-logs.html'));
});

// Error handling middleware
app.use(errorLogger); // Add error logging middleware

// Final error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});

// MongoDB Connection
mongoose.set('strictQuery', false);
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Initialize creature slots
    const CreatureSlot = require('./models/creatureSlot');
    CreatureSlot.initializeSlots()
      .then(() => console.log('Creature slots initialized'))
      .catch(err => console.error('Error initializing creature slots:', err));
  })
  .catch((err) => console.log(err)); 