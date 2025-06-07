const User = require('../models/user');
const mongoose = require('mongoose');

// Get user currency details
async function getUserCurrency(userId) {
    try {
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Initialize currency if it doesn't exist
        if (!user.currency) {
            user.currency = {
                gems: 0,
                arcane_energy: 0,
                gold: user.gold_coins || 0,
                anima: 0,
                last_updated: new Date()
            };
            await user.save();
        } else if (user.currency.gold === undefined) {
            // Ensure gold is always present in the currency object
            user.currency.gold = user.gold_coins || 0;
            user.markModified('currency');
            await user.save();
        }

        return {
            success: true,
            message: 'Currency details fetched successfully',
            data: {
                currency: user.currency,
                gold_coins: user.gold_coins
            }
        };
    } catch (error) {
        console.error('Error fetching user currency:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Process multiple currency operations at once
async function processCurrencyOperations(userId, operations) {
    try {
        console.log(`Processing currency operations for user ${userId}`, operations);
        
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Initialize currency if needed
        if (!user.currency) {
            user.currency = {
                gems: 0,
                arcane_energy: 0,
                gold: user.gold_coins || 0,
                anima: 0,
                last_updated: new Date()
            };
        } else if (user.currency.gold === undefined) {
            // Ensure gold is always present in the currency object
            user.currency.gold = user.gold_coins || 0;
        }

        // Validate operations format
        if (!Array.isArray(operations)) {
            return {
                success: false,
                message: 'Operations must be an array of currency operations'
            };
        }

        // Process each operation
        const validTypes = ['gems', 'arcane_energy', 'gold', 'anima'];
        const results = [];
        
        for (const op of operations) {
            // Validate operation format
            if (!op.type || !validTypes.includes(op.type) || op.amount === undefined) {
                results.push({
                    success: false,
                    type: op.type || 'unknown',
                    message: 'Invalid operation format. Needs type and amount.'
                });
                continue;
            }

            const currencyType = op.type;
            const amount = parseInt(op.amount);
            
            if (isNaN(amount)) {
                results.push({
                    success: false,
                    type: currencyType,
                    message: 'Amount must be a number'
                });
                continue;
            }
            
            // Get current value
            const currentValue = currencyType === 'gold' ? 
                (user.gold_coins || 0) : // For gold, use gold_coins
                (user.currency[currencyType] || 0);  // For others, use currency object
            
            // Special handling for removal operations (negative amounts)
            if (amount < 0) {
                const removalAmount = Math.abs(amount);
                
                // Check if user has enough currency
                if (currentValue < removalAmount) {
                    results.push({
                        success: false,
                        type: currencyType,
                        message: `Insufficient ${currencyType}. You only have ${currentValue} but tried to remove ${removalAmount}.`,
                        previous_value: currentValue,
                        current_value: currentValue,
                        change: 0
                    });
                    continue;
                }
            }
            
            // Calculate new value
            let newValue = currentValue + amount;
            
            // Only check for negative values
            let limitMessage = null;
            if (newValue < 0) {
                limitMessage = `Insufficient ${currencyType}. Setting to 0.`;
                newValue = 0;
            }
            
            // Update currency
            user.currency[currencyType] = newValue;
            
            // Special handling for gold - update gold_coins as well
            if (currencyType === 'gold') {
                user.gold_coins = newValue;
            }
            
            results.push({
                success: true,
                type: currencyType,
                previous_value: currentValue,
                current_value: newValue,
                change: amount,
                message: limitMessage || `${currencyType} updated successfully`
            });
        }
        
        // Only save if we have any successful operations
        const hasSuccessfulOps = results.some(result => result.success);
        if (hasSuccessfulOps) {
            // Update last updated timestamp
            user.currency.last_updated = new Date();
            user.markModified('currency');
            await user.save();
        }

        return {
            success: true,
            message: `Processed ${operations.length} currency operations`,
            data: {
                operations_results: results,
                current_currency: user.currency
            }
        };
    } catch (error) {
        console.error('Error processing currency operations:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Sync gold_coins and currency.gold for all users
async function syncGoldValues() {
    try {
        console.log('Starting gold values synchronization...');
        
        const users = await User.find({});
        console.log(`Found ${users.length} users to process`);
        
        const results = {
            processed: users.length,
            synced: 0,
            skipped: 0,
            errors: 0,
            details: []
        };
        
        for (const user of users) {
            try {
                const goldCoins = user.gold_coins || 0;
                
                // Skip if no currency object
                if (!user.currency) {
                    user.currency = {
                        gems: 0,
                        arcane_energy: 0,
                        gold: goldCoins,
                        anima: 0,
                        last_updated: new Date()
                    };
                    user.markModified('currency');
                    await user.save();
                    
                    results.synced++;
                    results.details.push({
                        userId: user.userId,
                        status: 'created',
                        gold_coins: goldCoins
                    });
                    continue;
                }
                
                // Skip if already in sync
                if (user.currency.gold === goldCoins) {
                    results.skipped++;
                    results.details.push({
                        userId: user.userId,
                        status: 'skipped',
                        reason: 'Already in sync',
                        gold_value: goldCoins
                    });
                    continue;
                }
                
                // Update currency.gold to match gold_coins
                user.currency.gold = goldCoins;
                user.currency.last_updated = new Date();
                user.markModified('currency');
                await user.save();
                
                results.synced++;
                results.details.push({
                    userId: user.userId,
                    status: 'synced',
                    previous_gold: user.currency.gold,
                    new_gold: goldCoins
                });
                
            } catch (error) {
                console.error(`Error processing user ${user.userId}:`, error);
                results.errors++;
                results.details.push({
                    userId: user.userId,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        return {
            success: true,
            message: `Gold sync completed: ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors`,
            data: results
        };
    } catch (error) {
        console.error('Error syncing gold values:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Purchase gold or arcane energy with gems
async function purchaseWithGems(userId, purchaseType, gemAmount) {
    try {
        console.log(`User ${userId} is purchasing ${purchaseType} with ${gemAmount} gems`);
        
        // Validate purchase type
        if (!['gold', 'arcane_energy'].includes(purchaseType)) {
            return {
                success: false,
                message: `Invalid purchase type: ${purchaseType}. Must be 'gold' or 'arcane_energy'`
            };
        }
        
        // Validate gem amount
        if (!gemAmount || isNaN(parseInt(gemAmount)) || parseInt(gemAmount) <= 0) {
            return {
                success: false,
                message: 'Valid positive gem amount is required'
            };
        }
        
        // Parse to integer
        gemAmount = parseInt(gemAmount);
        
        // Find user
        const user = await User.findOne({ userId });
        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Initialize currency if needed
        if (!user.currency) {
            user.currency = {
                gems: 0,
                arcane_energy: 0,
                gold: user.gold_coins || 0,
                anima: 0,
                last_updated: new Date()
            };
        } else if (user.currency.gold === undefined) {
            user.currency.gold = user.gold_coins || 0;
        }
        
        // Check if user has enough gems
        const currentGems = user.currency.gems || 0;
        if (currentGems < gemAmount) {
            return {
                success: false,
                message: `Insufficient gems. You have ${currentGems} but need ${gemAmount}`,
                data: {
                    current_gems: currentGems,
                    required_gems: gemAmount
                }
            };
        }
        
        // Calculate amount to add based on purchase type and gem amount
        let amountToAdd = 0;
        
        // Conversion rates based on the requirements
        if (purchaseType === 'gold') {
            // 10 gems = 3,370 gold
            // 100 gems = 39,999 gold
            // 500 gems = 231,150 gold
            // 1000 gems = 1,333,333 gold
            if (gemAmount === 10) {
                amountToAdd = 3370;
            } else if (gemAmount === 100) {
                amountToAdd = 39999;
            } else if (gemAmount === 500) {
                amountToAdd = 231150;
            } else if (gemAmount === 1000) {
                amountToAdd = 1333333;
            } else {
                // Calculate proportionally for other amounts
                // Base rate: 10 gems = 3370 gold
                amountToAdd = Math.floor((gemAmount / 10) * 3370);
            }
        } else if (purchaseType === 'arcane_energy') {
            // 10 gems = 1,890 arcane energy
            // 100 gems = 21,777 arcane energy
            // 500 gems = 112,444 arcane energy
            // 1000 gems = 255,689 arcane energy
            // 2500 gems = 650,111 arcane energy
            if (gemAmount === 10) {
                amountToAdd = 1890;
            } else if (gemAmount === 100) {
                amountToAdd = 21777;
            } else if (gemAmount === 500) {
                amountToAdd = 112444;
            } else if (gemAmount === 1000) {
                amountToAdd = 255689;
            } else if (gemAmount === 2500) {
                amountToAdd = 650111;
            } else {
                // Calculate proportionally for other amounts
                // Base rate: 10 gems = 1890 arcane_energy
                amountToAdd = Math.floor((gemAmount / 10) * 1890);
            }
        }
        
        // Prepare operations array for currency changes
        const operations = [
            {
                type: 'gems',
                amount: -gemAmount // Remove gems
            },
            {
                type: purchaseType,
                amount: amountToAdd // Add purchased currency
            }
        ];
        
        // Process the currency operations
        const result = await processCurrencyOperations(userId, operations);
        
        // Check if operations were successful
        if (!result.success || result.data.operations_results.some(op => !op.success)) {
            return {
                success: false,
                message: 'Failed to process purchase',
                data: result.data
            };
        }
        
        // Fetch the updated user to get the current balances
        const updatedUser = await User.findOne({ userId });
        
        // Format the response for clarity
        return {
            success: true,
            message: `Successfully purchased ${amountToAdd.toLocaleString()} ${purchaseType} for ${gemAmount} gems`,
            data: {
                spent_gems: gemAmount,
                received: {
                    type: purchaseType,
                    amount: amountToAdd
                },
                current_balance: {
                    gems: updatedUser.currency.gems,
                    gold: updatedUser.gold_coins,
                    arcane_energy: updatedUser.currency.arcane_energy,
                    anima: updatedUser.currency.anima
                }
            }
        };
    } catch (error) {
        console.error('Error in purchaseWithGems:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

module.exports = {
    getUserCurrency,
    processCurrencyOperations,
    syncGoldValues,
    purchaseWithGems
}; 