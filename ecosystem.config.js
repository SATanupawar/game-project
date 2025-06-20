module.exports = {
  apps: [
    {
      name: 'game-server',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'leaderboard-cache',
      script: 'scripts/prebuildLeaderboard.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '0 */6 * * *' // Rebuild every 6 hours
    },
    {
      name: 'leaderboard-monitor',
      script: 'scripts/monitor-leaderboard-cache.js',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '*/15 * * * *' // Run every 15 minutes
    }
  ]
}; 