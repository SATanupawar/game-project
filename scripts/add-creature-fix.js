const mongoose = require('mongoose');
const User = require('../models/user');
const Creature = require('../models/creature');

// MongoDB connection
mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Connected');
    addCreatureAndFix();
}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});

async function addCreatureAndFix() {
    try {
        // Find user2
        const user = await User.findOne({ userId: 'user2' });
        if (!user) {
            console.error('User not found');
            process.exit(1);
        }

        console.log(`Found user: ${user.user_name} with ${user.buildings.length} buildings and ${user.creatures.length} creatures`);
        
        // Find all creature buildings
        const creatureBuildings = user.buildings.filter(b => b.buildingId === 'creature_building');
        console.log(`Found ${creatureBuildings.length} creature buildings`);
        
        // Choose the last creature building
        const building = creatureBuildings[creatureBuildings.length - 1];
        if (!building) {
            console.error('No creature building found');
            process.exit(1);
        }
        
        console.log(`Selected building: ${building.name} (Index: ${building.index})`);
        
        // Create a new ObjectId for the creature
        const creatureId = new mongoose.Types.ObjectId();
        
        // Get a random legendary creature template
        const creatureTemplates = await Creature.find({ type: 'legendary' });
        if (!creatureTemplates || creatureTemplates.length === 0) {
            console.error('No legendary creature templates found');
            process.exit(1);
        }
        
        // Select a random template
        const randomIndex = Math.floor(Math.random() * creatureTemplates.length);
        const template = creatureTemplates[randomIndex];
        
        console.log(`Selected template: ${template.name} (${template.creature_Id})`);
        
        // Create new creature
        const newCreature = {
            _id: creatureId,
            creature_id: creatureId,
            name: template.name,
            level: 1,
            building_index: building.index,
            creature_type: template.creature_Id,
            base_attack: template.base_attack,
            base_health: template.base_health,
            attack: template.base_attack,
            health: template.base_health,
            gold_coins: template.gold_coins,
            count: 1,
            upgrade_progress: 0,
            upgrade_partner_id: null,
            last_upgrade_click_time: null,
            type: template.type,
            arcane_energy: template.arcane_energy,
            image: template.image,
            description: template.description,
            unlock_level: template.unlock_level
        };
        
        // Add the creature to user's creatures array
        user.creatures.push(newCreature);
        console.log(`Added new creature ${newCreature.name} to user's creatures array`);
        
        // Check if building.creatures exists, create if not
        if (!building.creatures) {
            building.creatures = [];
        }
        
        // Add creature to building's creatures array
        building.creatures.push(creatureId);
        console.log(`Added creature ${newCreature.name} to building's creatures array`);
        
        // Now fix ALL buildings and creatures to ensure consistent relationships
        let fixCount = 0;
        
        // For each creature that has a building_index
        user.creatures.forEach(creature => {
            if (creature.building_index) {
                // Find the building
                const relatedBuilding = user.buildings.find(b => b.index === creature.building_index);
                if (relatedBuilding) {
                    // Ensure building has creatures array
                    if (!relatedBuilding.creatures) {
                        relatedBuilding.creatures = [];
                    }
                    
                    // Get creature ID
                    const cId = creature.creature_id || creature._id;
                    
                    // Check if creature is already in building's creatures array
                    const alreadyInBuilding = relatedBuilding.creatures.some(id => 
                        id.toString() === cId.toString()
                    );
                    
                    // If not, add it
                    if (!alreadyInBuilding) {
                        relatedBuilding.creatures.push(cId);
                        fixCount++;
                        console.log(`Fixed: Added ${creature.name} to building ${relatedBuilding.name} (${relatedBuilding.index})`);
                    }
                }
            }
        });
        
        // Mark as modified
        user.markModified('creatures');
        user.markModified('buildings');
        
        // Save changes
        await user.save();
        
        console.log(`Added new creature and fixed ${fixCount} building-creature relationships successfully`);
        
        // Verify
        const updatedUser = await User.findOne({ userId: 'user2' });
        
        // Check all buildings with creatures
        updatedUser.buildings.forEach(b => {
            if (b.creatures && b.creatures.length > 0) {
                console.log(`Building ${b.name} (${b.index}) has ${b.creatures.length} creatures:`);
                b.creatures.forEach(cid => console.log(`- Creature ID: ${cid}`));
            }
        });
        
        mongoose.disconnect();
        console.log('Done');
    } catch (error) {
        console.error('Error adding creature and fixing relationships:', error);
        mongoose.disconnect();
        process.exit(1);
    }
} 