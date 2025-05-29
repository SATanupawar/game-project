const mongoose = require('mongoose');
const User = require('../models/user');
const Subscription = require('../models/subscription');
const UserBattlePass = require('../models/userBattlePass');
const BattlePass = require('../models/battlePass');

async function fixSubscriptionFields() {
    try {
        // Connect to the database
        await mongoose.connect('mongodb+srv://awsexos:exos%40aws2025@cluster0.uuvjvcy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { 
            useNewUrlParser: true, 
            useUnifiedTopology: true
        });
        console.log('MongoDB Connected');
        
        // Get current active battle pass
        const now = new Date();
        const currentBattlePass = await BattlePass.findOne({
            start_date: { $lte: now },
            end_date: { $gte: now },
            active: true
        });
        
        if (currentBattlePass) {
            console.log(`Current active battle pass: ${currentBattlePass.name}`);
        } else {
            console.log('No active battle pass found');
        }
        
        // Find all users with elite pass
        const users = await User.find({
            'elite_pass.active': true
        });
        
        console.log(`Found ${users.length} users with active elite pass`);
        
        // Process each user
        let fixedCount = 0;
        let missingFieldsCount = 0;
        let inconsistentFieldsCount = 0;
        
        for (const user of users) {
            let needsUpdate = false;
            
            // Normalize all elite pass date fields
            if (user.elite_pass) {
                // Get the primary date fields
                const startDate = user.elite_pass.start_date || 
                                  user.elite_pass.activated_at || 
                                  user.elite_pass.purchase_date || 
                                  now;
                                  
                const endDate = user.elite_pass.end_date || 
                               user.elite_pass.expires_at || 
                               user.elite_pass.expiry_date || 
                               new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
                
                // Check for missing fields
                if (!user.elite_pass.start_date || 
                    !user.elite_pass.end_date || 
                    !user.elite_pass.activated_at || 
                    !user.elite_pass.expires_at || 
                    !user.elite_pass.purchase_date || 
                    !user.elite_pass.expiry_date) {
                    missingFieldsCount++;
                    needsUpdate = true;
                }
                
                // Check for inconsistent fields
                if ((user.elite_pass.start_date && user.elite_pass.activated_at && 
                     user.elite_pass.start_date.getTime() !== user.elite_pass.activated_at.getTime()) ||
                    (user.elite_pass.end_date && user.elite_pass.expires_at && 
                     user.elite_pass.end_date.getTime() !== user.elite_pass.expires_at.getTime())) {
                    inconsistentFieldsCount++;
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    // Standardize all date fields
                    user.elite_pass.start_date = startDate;
                    user.elite_pass.activated_at = startDate;
                    user.elite_pass.purchase_date = startDate;
                    user.elite_pass.end_date = endDate;
                    user.elite_pass.expires_at = endDate;
                    user.elite_pass.expiry_date = endDate;
                    
                    // Make sure subscription type is set
                    if (!user.elite_pass.subscription_type) {
                        const diffMonths = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24 * 30));
                        
                        if (diffMonths <= 1) {
                            user.elite_pass.subscription_type = 'monthly';
                        } else if (diffMonths <= 3) {
                            user.elite_pass.subscription_type = 'quarterly';
                        } else {
                            user.elite_pass.subscription_type = 'yearly';
                        }
                    }
                    
                    user.markModified('elite_pass');
                    await user.save();
                    fixedCount++;
                }
                
                // Find or create subscription record if it doesn't exist
                let subscription = await Subscription.findOne({
                    userId: user.userId,
                    active: true
                });
                
                if (!subscription) {
                    // Create new subscription record
                    const type = user.elite_pass.subscription_type || 'monthly';
                    let price = 599;
                    
                    if (type === 'quarterly') {
                        price = 1599;
                    } else if (type === 'yearly') {
                        price = 6799;
                    }
                    
                    subscription = new Subscription({
                        userId: user.userId,
                        type: type,
                        price: price,
                        start_date: user.elite_pass.start_date || now,
                        end_date: user.elite_pass.end_date || new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
                        active: true,
                        auto_renew: false,
                        payment_id: null,
                        subscription_history: [{
                            action: 'created',
                            date: now,
                            note: `${type} subscription created during cleanup`
                        }]
                    });
                    
                    await subscription.save();
                    console.log(`Created missing subscription record for user ${user.userId}`);
                }
                
                // Check battle pass elite status
                if (currentBattlePass) {
                    let userBattlePass = await UserBattlePass.findOne({
                        userId: user.userId,
                        battle_pass_id: currentBattlePass._id
                    });
                    
                    if (userBattlePass) {
                        if (!userBattlePass.is_elite) {
                            userBattlePass.is_elite = true;
                            await userBattlePass.save();
                            console.log(`Updated battle pass to elite for user ${user.userId}`);
                        }
                    } else {
                        // Create new battle pass entry
                        userBattlePass = new UserBattlePass({
                            userId: user.userId,
                            battle_pass_id: currentBattlePass._id,
                            current_xp: 0,
                            current_level: 1,
                            is_elite: true,
                            claimed_rewards: [],
                            xp_history: []
                        });
                        
                        await userBattlePass.save();
                        console.log(`Created new battle pass entry for user ${user.userId}`);
                    }
                    
                    // Update battle pass summary if needed
                    if (user.battlePassSummary && !user.battlePassSummary.is_elite) {
                        user.battlePassSummary.is_elite = true;
                        user.markModified('battlePassSummary');
                        await user.save();
                        console.log(`Updated battle pass summary for user ${user.userId}`);
                    }
                }
            }
        }
        
        console.log('Fix subscription fields complete:');
        console.log(`- Fixed ${fixedCount} users`);
        console.log(`- Found ${missingFieldsCount} users with missing fields`);
        console.log(`- Found ${inconsistentFieldsCount} users with inconsistent fields`);
        
        await mongoose.disconnect();
        console.log('MongoDB Disconnected');
    } catch (error) {
        console.error('Error fixing subscription fields:', error);
        await mongoose.disconnect();
    }
}

// Run the script
fixSubscriptionFields(); 