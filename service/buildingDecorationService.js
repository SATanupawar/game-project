const BuildingDecoration = require('../models/buildingDecoration');

class BuildingDecorationService {
    // Get all building decorations
    async getAllDecorations() {
        try {
            return await BuildingDecoration.find({}).sort('unlockLevel');
        } catch (error) {
            console.error('Error in getAllDecorations:', error);
            throw error;
        }
    }

    // Get building decoration by ID
    async getDecorationById(decorationId) {
        try {
            const decoration = await BuildingDecoration.findOne({ decorationId });
            if (!decoration) {
                throw new Error('Building decoration not found');
            }
            return decoration;
        } catch (error) {
            console.error('Error in getDecorationById:', error);
            throw error;
        }
    }

    // Get building decorations by player level
    async getDecorationsByLevel(playerLevel) {
        try {
            // Find all decorations with unlockLevel less than or equal to player level
            const decorations = await BuildingDecoration.find({ unlockLevel: { $lte: playerLevel } })
                .sort('unlockLevel');
            
            return decorations;
        } catch (error) {
            console.error('Error in getDecorationsByLevel:', error);
            throw error;
        }
    }
}

module.exports = new BuildingDecorationService();