const mongoose = require('mongoose');
const User = require('../models/user');
require('dotenv').config();

async function addCanCollectField() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        
        // Find all users with active_merges
        const users = await User.find({ 'active_merges.0': { $exists: true } });
        console.log(`Found ${users.length} users with active merges`);
        
        let updatedCount = 0;
        
        // Update each user's active_merges to add can_collect field
        for (const user of users) {
            let modified = false;
            
            // Check each active merge
            if (user.active_merges && user.active_merges.length > 0) {
                for (let i = 0; i < user.active_merges.length; i++) {
                    const merge = user.active_merges[i];
                    
                    // If can_collect is undefined, set it to true
                    if (merge.can_collect === undefined) {
                        user.active_merges[i].can_collect = true;
                        modified = true;
                        console.log(`Setting can_collect=true for user ${user.userId}, merge ${i}`);
                    }
                }
                
                if (modified) {
                    user.markModified('active_merges');
                    await user.save();
                    updatedCount++;
                }
            }
        }
        
        console.log(`Updated ${updatedCount} users with active merges`);
        
        // Also run a direct database update to ensure all documents are updated
        const result = await User.updateMany(
            { 'active_merges.0': { $exists: true } }, 
            { $set: { 'active_merges.$[elem].can_collect': true } },
            { arrayFilters: [{ 'elem.can_collect': { $exists: false } }], multi: true }
        );
        
        console.log(`Direct database update affected ${result.nModified} documents`);
        
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        // Close the connection
        mongoose.connection.close();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
addCanCollectField(); 