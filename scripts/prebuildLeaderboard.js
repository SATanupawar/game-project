const redisWrapper = require('../service/redisService');

/**
 * Prebuilds the leaderboard cache periodically
 * Run this with: node scripts/prebuildLeaderboard.js
 */
async function startPrebuildProcess() {
  console.log('Starting leaderboard prebuild process');

  try {
    // Initial build of the leaderboard
    await prebuildLeaderboard();
    
    // Set up periodic rebuilding every 5 minutes
    setInterval(async () => {
      await prebuildLeaderboard();
    }, 5 * 60 * 1000); // 5 minutes in milliseconds
    
    console.log('Leaderboard prebuild process running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Error in prebuild process:', error);
    process.exit(1);
  }
}

async function prebuildLeaderboard() {
  try {
    const startTime = Date.now();
    console.log(`Starting leaderboard prebuild at ${new Date().toISOString()}`);
    
    // Use the Redis service's prebuild function
    const success = await redisWrapper.prebuildLeaderboard(500);
    
    if (success) {
      const endTime = Date.now();
      console.log(`Leaderboard prebuild completed in ${endTime - startTime}ms`);
    } else {
      console.log('Leaderboard prebuild skipped - no data available');
    }
    
    return success;
  } catch (error) {
    console.error('Error prebuilding leaderboard:', error);
    return false;
  }
}

// Start the process if this file is executed directly
if (require.main === module) {
  startPrebuildProcess();
}

module.exports = {
  prebuildLeaderboard,
  startPrebuildProcess
}; 