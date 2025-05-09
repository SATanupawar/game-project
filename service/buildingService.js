const Building = require('../models/building');

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
