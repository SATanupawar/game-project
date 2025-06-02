const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
    updateActiveMerges();
}).catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
});

// Import User model
const User = require('../models/user');

async function updateActiveMerges() {
    try {
        // Find all users with active_merges array
        const users = await User.find({ active_merges: { $exists: true, $ne: [] } });
        console.log(`Found ${users.length} users with active merges`);
        
        let updatedCount = 0;
        
        for (const user of users) {
            // Create simplified version of each active merge
            const simplifiedMerges = user.active_merges.map(merge => ({
                creature1_id: merge.creature1_id,
                creature2_id: merge.creature2_id,
                start_time: merge.start_time,
                estimated_finish_time: merge.estimated_finish_time,
                progress: merge.progress || 1,
                target_level: merge.target_level || (merge.creature1_level ? merge.creature1_level + 1 : 11),
                last_update: merge.last_update || merge.start_time,
                can_collect: merge.can_collect || false
            }));
            
            // Replace the active_merges array with the simplified version
            user.active_merges = simplifiedMerges;
            user.markModified('active_merges');
            await user.save();
            
            updatedCount++;
            console.log(`Updated user ${user.userId} - simplified ${simplifiedMerges.length} active merges`);
        }
        
        console.log(`Updated ${updatedCount} users with active merges`);
        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error updating active merges:', error);
        process.exit(1);
    }
} 