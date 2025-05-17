const AWS = require('aws-sdk');

// Configure AWS SDK
const configureAWS = () => {
    // Load AWS configurations from environment variables
    const region = process.env.AWS_REGION || 'ap-northeast-2'; // Default to Seoul region for GameLift
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    
    // Detect test mode
    const isTestMode = process.env.TEST_MODE === 'true';
    
    if (isTestMode) {
        console.log('⚠️ AWS SDK configured in TEST MODE. Using mock responses for GameLift.');
    } else {
        console.log(`🚀 AWS SDK configured in PRODUCTION mode for region: ${region}`);
    }
    
    // Configure AWS SDK
    AWS.config.update({
        region,
        accessKeyId,
        secretAccessKey
    });
    
    // Return configured GameLift client
    return new AWS.GameLift();
};

// GameLift configurations
const gameLiftConfig = {
    // These values should be set in environment variables
    fleetId: process.env.AWS_GAMELIFT_FLEET_ID,
    matchmakingConfigurationArn: process.env.AWS_GAMELIFT_MATCHMAKING_CONFIG_ARN,
    matchmakingRulesetArn: process.env.AWS_GAMELIFT_MATCHMAKING_RULESET_ARN,
    // GameLift queue name (if using queues)
    queueName: process.env.AWS_GAMELIFT_QUEUE_NAME,
    // Detect test mode
    isTestMode: process.env.TEST_MODE === 'true'
};

module.exports = {
    configureAWS,
    gameLiftConfig
}; 