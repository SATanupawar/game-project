const mongoose = require('mongoose');
const User = require('./user');

// Patch the User model to override the locked_creatures field
// This ensures all creatures go to the main creatures array

/**
 * Create a virtual property for locked_creatures that redirects to the main creatures array
 * This intercepts any attempt to use locked_creatures and routes it to the creatures array
 */
User.schema.virtual('locked_creatures').get(function() {
  console.log('[USER MODEL] Attempted to access locked_creatures - Redirecting to main creatures array');
  return []; // Always return empty array to make it seem like there are no locked creatures
}).set(function(newCreatures) {
  console.log('[USER MODEL] Attempted to set locked_creatures - Adding to main creatures array instead');
  
  // If creatures array doesn't exist, create it
  if (!this.creatures) {
    this.creatures = [];
  }
  
  // If we're trying to set locked_creatures, we convert them to regular creatures
  if (Array.isArray(newCreatures) && newCreatures.length > 0) {
    for (const creature of newCreatures) {
      const creatureId = new mongoose.Types.ObjectId();
      const newCreature = {
        _id: creatureId,
        creature_id: creatureId,
        name: creature.name,
        creature_type: creature.creature_type || creature.name.toLowerCase().replace(/\s+/g, '_'),
        level: creature.level || 1,
        building_index: 0, // Default building index
        base_attack: 50,
        base_health: 300,
        attack: 50,
        health: 300,
        gold_coins: 0,
        count: 1
      };
      
      this.creatures.push(newCreature);
    }
  }
  
  // Mark the creatures array as modified
  this.markModified('creatures');
});

// Apply the patch to existing models
console.log('[USER MODEL] Applied patch to User model - locked_creatures redirected to main creatures array');

module.exports = User; 