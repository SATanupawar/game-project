/**
 * Script to monitor Redis leaderboard cache and rebuild it if necessary
 * 
 * Can be run as a cron job to keep the cache fresh, schedule in ecosystem.config.js
 * Example: pm2 start ecosystem.config.js
 */

require('dotenv').config();
const redisWrapper = require('../service/redisService');

// Check for stale or missing leaderboard cache
async function monitorAndRebuildLeaderboard() {
  try {
    console.log('Starting Redis leaderboard cache monitor...');
    
    // Get time when script started
    const startTime = Date.now();

    // Check Redis connection first
    const healthStatus = await redisWrapper.healthCheck();
    
    if (healthStatus.status !== 'connected') {
      console.error('Redis is not connected, cannot monitor leaderboard cache');
      console.log(JSON.stringify(healthStatus, null, 2));
      process.exit(1);
    }

    // Check if leaderboard exists in Redis
    const leaderboardCount = await redisWrapper.zCard('leaderboard:global');
    console.log(`Found ${leaderboardCount || 0} entries in Redis leaderboard`);
    
    // Check if cached JSON leaderboard exists
    const cachedLeaderboard = await redisWrapper.getJson('cached:leaderboard:top');
    
    let needsRebuild = false;
    let rebuildReason = '';

    // Determine if rebuild is needed
    if (!leaderboardCount || leaderboardCount === 0) {
      needsRebuild = true;
      rebuildReason = 'Leaderboard has no entries';
    } else if (!cachedLeaderboard) {
      needsRebuild = true;
      rebuildReason = 'Cached leaderboard JSON does not exist';
    } else {
      // Check if cached leaderboard is within expected size
      const expectSize = Math.min(500, leaderboardCount);
      const actualSize = cachedLeaderboard.length;
      
      if (actualSize < expectSize * 0.9) { // If it's less than 90% of expected size
        needsRebuild = true;
        rebuildReason = `Cached leaderboard size (${actualSize}) is less than 90% of expected (${expectSize})`;
      }
    }

    // Rebuild if needed
    if (needsRebuild) {
      console.log(`Rebuilding leaderboard cache: ${rebuildReason}`);
      const success = await redisWrapper.prebuildLeaderboard(500);
      
      if (success) {
        console.log('Successfully rebuilt leaderboard cache');
      } else {
        console.error('Failed to rebuild leaderboard cache');
      }
    } else {
      console.log('Leaderboard cache is in good state, no rebuild needed');
    }

    // Calculate and log execution time
    const executionTime = (Date.now() - startTime) / 1000;
    console.log(`Monitoring completed in ${executionTime.toFixed(2)} seconds`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error in leaderboard monitoring script:', error);
    process.exit(1);
  }
}

// Execute the monitor function
monitorAndRebuildLeaderboard(); 