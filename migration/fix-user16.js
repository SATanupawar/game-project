const mongoose = require('mongoose');
const User = require('../models/user');
require('dotenv').config();

async function fixUser16() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        
        // Find user16
        const user = await User.findOne({ userId: 'user16' });
        
        if (!user) {
            console.log('User not found');
            return;
        }
        
        console.log('Found user:', user.userId);
        console.log('Active merges:', user.active_merges.length);
        
        // Update all active merges for this user
        if (user.active_merges && user.active_merges.length > 0) {
            for (let i = 0; i < user.active_merges.length; i++) {
                // Set can_collect to true for each merge
                user.active_merges[i].can_collect = true;
                console.log(`Setting can_collect=true for merge ${i}`);
            }
            
            user.markModified('active_merges');
            await user.save();
            console.log('User saved with updated active_merges');
            
            // Verify the save worked
            const updatedUser = await User.findOne({ userId: 'user16' });
            if (updatedUser.active_merges && updatedUser.active_merges.length > 0) {
                for (let i = 0; i < updatedUser.active_merges.length; i++) {
                    console.log(`Merge ${i} can_collect:`, updatedUser.active_merges[i].can_collect);
                }
            }
        }
        
        // Also run a direct database update
        const result = await User.updateOne(
            { userId: 'user16' },
            { $set: { 'active_merges.$[].can_collect': true } }
        );
        
        console.log('Direct update result:', result);
        
        console.log('Fix completed successfully');
    } catch (error) {
        console.error('Fix failed:', error);
    } finally {
        // Close the connection
        mongoose.connection.close();
        console.log('Disconnected from MongoDB');
    }
}

// Run the fix
fixUser16(); 