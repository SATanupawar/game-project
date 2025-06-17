const Building = require('../models/building');
const User = require('../models/user');

class BuildingService {
    // Update building position
    async updateBuildingPosition(buildingId, x, y) {
        try {
            // Validate input
            if (typeof x !== 'number' || typeof y !== 'number') {
                throw new Error('X and Y coordinates must be numbers');
            }

            // Update building position
            const building = await Building.findByIdAndUpdate(
                buildingId,
                { 
                    position: { x, y },
                    updatedAt: new Date()
                },
                { 
                    new: true,
                    runValidators: true 
                }
            );

            if (!building) {
                throw new Error('Building not found');
            }

            return {
                buildingId: building.buildingId,
                name: building.name,
                position: building.position,
                updatedAt: building.updatedAt
            };
        } catch (error) {
            console.error('Error in updateBuildingPosition:', error);
            throw error;
        }
    }
    
    // Sell a building and get half the cost back
    async sellBuilding(userId, buildingIndex) {
        try {
            console.log(`Attempting to sell building. User: ${userId}, Building Index: ${buildingIndex}`);
            
            // Convert buildingIndex to number if it's a string
            const buildingIndexNumber = typeof buildingIndex === 'string' ? parseInt(buildingIndex, 10) : buildingIndex;
            
            if (isNaN(buildingIndexNumber)) {
                throw new Error('Building index must be a valid number');
            }

            // Find the user
            const user = await User.findOne({ userId });
            if (!user) {
                throw new Error('User not found');
            }

            // Find the building in user's buildings
            const buildingToSell = user.buildings.find(b => b.index === buildingIndexNumber);
            if (!buildingToSell) {
                throw new Error(`Building with index ${buildingIndexNumber} not found for this user`);
            }

            console.log(`Found building to sell:`, buildingToSell);

            // Check if there are creatures in the building
            const creaturesInBuilding = user.creatures.filter(c => c.building_index === buildingIndexNumber);
            if (creaturesInBuilding.length > 0) {
                throw new Error(`Cannot sell building with ${creaturesInBuilding.length} creatures. Please remove all creatures first.`);
            }

            // Calculate sell value
            let sellValue = 500; // Default sell value if no cost information is found
            let buildingName = buildingToSell.name || 'Unknown Building';
            let buildingType = buildingToSell.is_decoration ? 'decoration' : 'building';

            // First, try to get cost from the building object itself
            if (buildingToSell.cost && typeof buildingToSell.cost === 'number') {
                sellValue = Math.floor(buildingToSell.cost / 2);
                console.log(`Using building's own cost: ${buildingToSell.cost}, sell value: ${sellValue}`);
            } else {
                // If no cost in building object, try to find the template
                try {
                    // Import the BuildingDecoration model
                    const BuildingDecoration = require('../models/buildingDecoration');
                    let buildingTemplate = null;
                    
                    // Check if it's a decoration
                    if (buildingToSell.is_decoration === true) {
                        console.log(`Building is a decoration, looking up by decorationId: ${buildingToSell.buildingId}`);
                        
                        // For decorations, try to find in BuildingDecoration collection
                        if (buildingToSell.buildingId) {
                            buildingTemplate = await BuildingDecoration.findOne({ decorationId: buildingToSell.buildingId });
                            console.log(`Decoration lookup result: ${buildingTemplate ? 'found' : 'not found'}`);
                        }
                    }
                    
                    // If not found as decoration or not a decoration, try regular building lookup
                    if (!buildingTemplate) {
                        console.log(`Looking up as regular building with buildingId: ${buildingToSell.buildingId}`);
                        
                        // Try in Building collection
                        buildingTemplate = await Building.findOne({ 
                            $or: [
                                { _id: buildingToSell.building_id },
                                { buildingId: buildingToSell.buildingId },
                                { name: buildingToSell.name }
                            ]
                        });
                        
                        // If still not found and it might be a decoration, try in BuildingDecoration again with different fields
                        if (!buildingTemplate && buildingToSell.buildingId) {
                            buildingTemplate = await BuildingDecoration.findOne({
                                $or: [
                                    { decorationId: buildingToSell.buildingId },
                                    { name: buildingToSell.name }
                                ]
                            });
                            
                            if (buildingTemplate) {
                                buildingType = 'decoration';
                                console.log(`Found as decoration by name or decorationId`);
                            }
                        }
                    }

                    if (buildingTemplate && buildingTemplate.cost) {
                        sellValue = Math.floor(buildingTemplate.cost / 2);
                        buildingName = buildingTemplate.name || buildingName;
                        console.log(`Using template cost for ${buildingType}: ${buildingTemplate.cost}, sell value: ${sellValue}`);
                    } else {
                        console.log(`Building template not found or has no cost. Using default sell value: ${sellValue}`);
                    }
                } catch (templateError) {
                    console.error('Error finding building template:', templateError);
                    // Continue with default sell value
                }
            }

            // Remove the building from user's buildings
            user.buildings = user.buildings.filter(b => b.index !== buildingIndexNumber);
            
            // Add the sell value to user's gold
            const previousGold = user.gold_coins || 0;
            user.gold_coins = previousGold + sellValue;
            
            // Save the user
            await user.save();

            console.log(`Successfully sold ${buildingType} ${buildingIndexNumber} for ${sellValue} gold`);

            return {
                building_name: buildingName,
                building_index: buildingIndexNumber,
                building_type: buildingType,
                sell_value: sellValue,
                previous_gold: previousGold,
                new_gold: user.gold_coins
            };
        } catch (error) {
            console.error('Error in sellBuilding:', error);
            throw error;
        }
    }

    // Get building by ID
    async getBuildingById(buildingId) {
        try {
            const building = await Building.findById(buildingId);
            if (!building) {
                throw new Error('Building not found');
            }
            return building;
        } catch (error) {
            console.error('Error in getBuildingById:', error);
            throw error;
        }
    }

    // Get all buildings
    async getAllBuildings() {
        try {
            return await Building.find({});
        } catch (error) {
            console.error('Error in getAllBuildings:', error);
            throw error;
        }
    }

    // Get buildings available for a player level
    async getBuildingsByLevel(playerLevel) {
        try {
            // Find all buildings with unlockLevel less than or equal to player level
            const buildings = await Building.find({ unlockLevel: { $lte: playerLevel } })
                .sort('unlockLevel');
            
            return buildings;
        } catch (error) {
            console.error('Error in getBuildingsByLevel:', error);
            throw error;
        }
    }
}

module.exports = new BuildingService();
