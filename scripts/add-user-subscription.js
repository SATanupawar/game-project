const mongoose = require('mongoose');
const User = require('../models/user');
const Subscription = require('../models/subscription');
const BattlePass = require('../models/battlePass');
const UserBattlePass = require('../models/userBattlePass');

async function addUserSubscription() {
    try {
        // Connect to the database
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected');
        
        // Get command line arguments
        const args = process.argv.slice(2);
        const userId = args[0];
        const subscriptionType = args[1]; // 'monthly', 'quarterly', 'yearly'
        
        if (!userId || !subscriptionType) {
            console.log('Usage: node add-user-subscription.js <userId> <subscriptionType>');
            console.log('subscriptionType can be: monthly, quarterly, yearly');
            await mongoose.disconnect();
            return;
        }
        
        // Check if subscription type is valid
        if (!['monthly', 'quarterly', 'yearly'].includes(subscriptionType)) {
            console.error(`Invalid subscription type: ${subscriptionType}. Must be monthly, quarterly, or yearly.`);
            await mongoose.disconnect();
            return;
        }
        
        // Check if user exists
        const user = await User.findOne({ userId });
        if (!user) {
            console.error(`User ${userId} not found`);
            await mongoose.disconnect();
            return;
        }
        
        // Check if user already has an active subscription
        let existingSubscription = await Subscription.findOne({
            userId,
            active: true,
            end_date: { $gt: new Date() }
        });
        
        if (existingSubscription) {
            console.log(`User ${userId} already has an active subscription until ${existingSubscription.end_date.toLocaleDateString()}`);
            console.log('Deactivating existing subscription...');
            
            existingSubscription.active = false;
            await existingSubscription.save();
        }
        
        // Get current active battle pass
        const now = new Date();
        const battlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });
        
        if (!battlePass) {
            console.warn('No active battle pass found');
        }
        
        // Calculate subscription details
        let price = 0;
        let endDate = new Date();
        
        switch (subscriptionType) {
            case 'monthly':
                price = 599;
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
                break;
            case 'quarterly':
                price = 1599;
                endDate = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
                break;
            case 'yearly':
                price = 6799;
                endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
                break;
        }
        
        // Create new subscription
        const subscription = new Subscription({
            userId,
            type: subscriptionType,
            price,
            start_date: now,
            end_date: endDate,
            active: true,
            auto_renew: false
        });
        
        await subscription.save();
        
        console.log(`Successfully created ${subscriptionType} subscription for user ${userId}`);
        console.log(`Subscription price: ₹${price}`);
        console.log(`Started: ${now.toLocaleDateString()}`);
        console.log(`Expires: ${endDate.toLocaleDateString()}`);
        
        // Update user's elite pass status
        if (!user.elite_pass) {
            user.elite_pass = {
                active: true,
                activated_at: now,
                expires_at: endDate
            };
        } else {
            user.elite_pass.active = true;
            user.elite_pass.activated_at = now;
            user.elite_pass.expires_at = endDate;
        }
        
        user.markModified('elite_pass');
        await user.save();
        
        console.log(`Updated elite pass status for user ${userId}`);
        
        // Update battle pass to elite if there is an active battle pass
        if (battlePass) {
            let userBattlePass = await UserBattlePass.findOne({
                userId,
                battle_pass_id: battlePass._id
            });
            
            if (!userBattlePass) {
                // Create new user battle pass with elite status
                userBattlePass = new UserBattlePass({
                    userId,
                    battle_pass_id: battlePass._id,
                    current_xp: 0,
                    current_level: 1,
                    is_elite: true,
                    claimed_rewards: [],
                    xp_history: []
                });
                await userBattlePass.save();
                console.log(`Created new battle pass progress for user ${userId} with elite access`);
            } else if (!userBattlePass.is_elite) {
                // Update existing battle pass to elite
                userBattlePass.is_elite = true;
                await userBattlePass.save();
                console.log(`Updated existing battle pass to elite for user ${userId}`);
            } else {
                console.log(`User ${userId} already has elite battle pass access`);
            }
        }
        
        // Disconnect from the database
        await mongoose.disconnect();
        console.log('Disconnected from database');
    } catch (error) {
        console.error('Error adding user subscription:', error);
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            console.error('Error disconnecting from database:', disconnectError);
        }
        process.exit(1);
    }
}

// Run the function
addUserSubscription(); 