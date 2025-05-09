const Chest = require('../models/chestCard');
const User = require('../models/user');
const { generateRandomNumber } = require('../utils/random');
const { generateReward } = require('../utils/rewards');

// Get a random chest card based on probability
const getRandomChestCard = async () => {
  const allChests = await Chest.find();
  const randomNumber = generateRandomNumber(0, 100);
  
  // Find the matching chest based on the random number
  let selectedChest = null;
  for (const chest of allChests) {
    if (randomNumber <= chest.drop_chance) {
      selectedChest = chest;
      break;
    }
  }
  
  // If no chest matched, select the first chest (Common)
  if (!selectedChest && allChests.length > 0) {
    selectedChest = allChests[0];
  }
  
  return selectedChest;
};

// Get a chest for the user
const getChestForUser = async (userId) => {
  try {
    // Generate a random chest
    const chestCard = await getRandomChestCard();
    if (!chestCard) {
      throw new Error('No chest cards available');
    }
    
    // Add the chest to user's chest collection
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Create a chest record for user with current time
    const userChest = {
      chest_id: chestCard._id,
      obtained_at: new Date(),
      unlock_status: 'locked'
    };
    
    user.chests.push(userChest);
    await user.save();
    
    return {
      success: true,
      chest: {
        id: userChest.chest_id,
        name: chestCard.name,
        rarity: chestCard.rarity,
        unlock_time_minutes: chestCard.unlock_time_minutes,
        obtained_at: userChest.obtained_at
      }
    };
  } catch (error) {
    console.error('Error getting chest for user:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Check if a chest is ready to open
const checkChestUnlockStatus = async (userId, chestId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Find the chest in user's collection
    const userChest = user.chests.find(
      chest => chest.chest_id.toString() === chestId && chest.unlock_status !== 'claimed'
    );
    
    if (!userChest) {
      throw new Error('Chest not found or already claimed');
    }
    
    // Get the chest details from database
    const chestDetails = await Chest.findById(chestId);
    if (!chestDetails) {
      throw new Error('Chest details not found');
    }
    
    // Calculate if unlock time has passed
    const obtainedTime = new Date(userChest.obtained_at).getTime();
    const unlockTimeMs = chestDetails.unlock_time_minutes * 60 * 1000;
    const currentTime = new Date().getTime();
    const timeRemaining = (obtainedTime + unlockTimeMs) - currentTime;
    
    if (timeRemaining <= 0) {
      return {
        success: true,
        status: 'ready',
        chest: {
          id: userChest.chest_id,
          name: chestDetails.name,
          rarity: chestDetails.rarity
        }
      };
    } else {
      return {
        success: true,
        status: 'locked',
        timeRemaining: Math.ceil(timeRemaining / 1000), // remaining time in seconds
        chest: {
          id: userChest.chest_id,
          name: chestDetails.name,
          rarity: chestDetails.rarity,
          unlock_time_minutes: chestDetails.unlock_time_minutes
        }
      };
    }
  } catch (error) {
    console.error('Error checking chest unlock status:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Open a chest and claim rewards
const openChest = async (userId, chestId) => {
  try {
    // First check if the chest is ready to open
    const chestStatus = await checkChestUnlockStatus(userId, chestId);
    if (!chestStatus.success) {
      throw new Error(chestStatus.error);
    }
    
    if (chestStatus.status !== 'ready') {
      throw new Error('Chest is not ready to be opened yet');
    }
    
    const user = await User.findById(userId);
    const chestDetails = await Chest.findById(chestId);
    
    // Generate rewards based on chest rarity
    const rewards = generateReward(chestDetails.rarity);
    
    // Update chest status to claimed
    const chestIndex = user.chests.findIndex(
      chest => chest.chest_id.toString() === chestId && chest.unlock_status !== 'claimed'
    );
    
    if (chestIndex !== -1) {
      user.chests[chestIndex].unlock_status = 'claimed';
      user.chests[chestIndex].opened_at = new Date();
      
      // Apply rewards to user
      if (rewards.coins) {
        user.coins += rewards.coins;
      }
      
      if (rewards.gems) {
        user.gems += rewards.gems;
      }
      
      if (rewards.cards && rewards.cards.length > 0) {
        // Add cards to user's collection
        rewards.cards.forEach(card => {
          const existingCard = user.cards.find(c => c.card_id.toString() === card.id.toString());
          if (existingCard) {
            existingCard.count += card.count;
          } else {
            user.cards.push({
              card_id: card.id,
              count: card.count
            });
          }
        });
      }
      
      await user.save();
      
      return {
        success: true,
        message: 'Chest opened successfully',
        rewards: rewards
      };
    } else {
      throw new Error('Chest not found or already claimed');
    }
  } catch (error) {
    console.error('Error opening chest:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Get all user chests
const getUserChests = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Get details for each chest
    const chestDetails = await Promise.all(
      user.chests
        .filter(chest => chest.unlock_status !== 'claimed')
        .map(async (chest) => {
          const chestInfo = await Chest.findById(chest.chest_id);
          if (!chestInfo) return null;
          
          const obtainedTime = new Date(chest.obtained_at).getTime();
          const unlockTimeMs = chestInfo.unlock_time_minutes * 60 * 1000;
          const currentTime = new Date().getTime();
          const timeRemaining = Math.max(0, (obtainedTime + unlockTimeMs) - currentTime);
          
          return {
            id: chest.chest_id,
            status: timeRemaining > 0 ? 'locked' : 'ready',
            timeRemaining: Math.ceil(timeRemaining / 1000),
            name: chestInfo.name,
            rarity: chestInfo.rarity,
            unlock_time_minutes: chestInfo.unlock_time_minutes,
            obtained_at: chest.obtained_at
          };
        })
    );
    
    return {
      success: true,
      chests: chestDetails.filter(chest => chest !== null)
    };
  } catch (error) {
    console.error('Error getting user chests:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  getChestForUser,
  checkChestUnlockStatus,
  openChest,
  getUserChests
}; 