const mongoose = require('mongoose');
const User = require('./models/user');

mongoose.connect('mongodb://localhost:27017/game_db')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    try {
      // Update all battle creatures to remove position, image, and description fields
      const result = await User.updateMany(
        { 'battle_selected_creatures': { $exists: true } },
        { 
          $unset: { 
            'battle_selected_creatures.$[].position': 1,
            'battle_selected_creatures.$[].image': 1,
            'battle_selected_creatures.$[].description': 1
          } 
        }
      );
      
      console.log('Removed position, image, and description fields from battle creatures');
      console.log(`Modified ${result.modifiedCount} documents`);
      
      mongoose.disconnect();
    } catch (err) {
      console.error('Error:', err);
      mongoose.disconnect();
    }
  })
  .catch(err => {
    console.error('Connection error:', err);
  }); 