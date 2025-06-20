const { configureAWS, gameLiftConfig } = require('../config/aws');
const logService = require('./logService');
const uuidv4 = require('uuid').v4;

// Initialize GameLift client
const gameLift = configureAWS();

// Check if we're in test mode
const isTestMode = gameLiftConfig.isTestMode;
console.log(`GameLift Service: ${isTestMode ? 'TEST MODE' : 'PRODUCTION MODE'}`);

/**
 * Creates a matchmaking ticket for a player or group
 * @param {string} userId - The user's ID
 * @param {object} playerAttributes - Player attributes for matchmaking (skill, level, etc.)
 * @param {string[]} [playerIds] - Optional array of player IDs for group matchmaking
 * @returns {Promise<object>} Matchmaking ticket information
 */
async function createMatchmakingTicket(userId, playerAttributes, playerIds = []) {
    try {
        // Ensure userId is in the playerIds array for group matchmaking
        if (!playerIds.includes(userId)) {
            playerIds = [userId, ...playerIds];
        }

        // Format player attributes according to GameLift requirements
        const flatAttributes = {};
        let playerLatencies = [];

        if (playerAttributes.latencies) {
            // Handle nested SDM format
            if (playerAttributes.latencies.SDM) {
                // Extract the latencies for each region
                const apSouthLatency = playerAttributes.latencies.SDM["ap-south-1"] || 999;
                const usEastLatency = playerAttributes.latencies.SDM["us-east-1"] || 999;
                
                // Add them as separate attributes with the format expected by the ruleset
                flatAttributes.latency_ap_south_1 = { N: apSouthLatency };
                flatAttributes.latency_us_east_1 = { N: usEastLatency };
                
                // Also add them to PlayerLatencies format for GameLift
                playerLatencies = [
                    { RegionName: "ap-south-1", LatencyInMilliseconds: apSouthLatency },
                    { RegionName: "us-east-1", LatencyInMilliseconds: usEastLatency }
                ];
            } 
            // Handle flat format
            else {
                // Extract the latencies for each region
                const apSouthLatency = playerAttributes.latencies["ap-south-1"] || 999;
                const usEastLatency = playerAttributes.latencies["us-east-1"] || 999;
                
                // Add them as separate attributes with the format expected by the ruleset
                flatAttributes.latency_ap_south_1 = { N: apSouthLatency };
                flatAttributes.latency_us_east_1 = { N: usEastLatency };
                
                // Also add them to PlayerLatencies format for GameLift
                playerLatencies = [
                    { RegionName: "ap-south-1", LatencyInMilliseconds: apSouthLatency },
                    { RegionName: "us-east-1", LatencyInMilliseconds: usEastLatency }
                ];
            }
            delete playerAttributes.latencies;
        } else {
            // If we have individual latency attributes, convert them to PlayerLatencies format
            if (playerAttributes.latency_ap_south_1 !== undefined && playerAttributes.latency_us_east_1 !== undefined) {
                const apSouthLatency = typeof playerAttributes.latency_ap_south_1 === 'object' ? 
                    playerAttributes.latency_ap_south_1.N : playerAttributes.latency_ap_south_1;
                const usEastLatency = typeof playerAttributes.latency_us_east_1 === 'object' ? 
                    playerAttributes.latency_us_east_1.N : playerAttributes.latency_us_east_1;
                
                playerLatencies = [
                    { RegionName: "ap-south-1", LatencyInMilliseconds: Number(apSouthLatency) },
                    { RegionName: "us-east-1", LatencyInMilliseconds: Number(usEastLatency) }
                ];
            }
        }
        Object.assign(flatAttributes, playerAttributes);

        // Create player objects for each player ID
        const players = playerIds.map(id => {
            const playerObj = {
                PlayerId: id,
                PlayerAttributes: flatAttributes
            };
            
            // Add PlayerLatencies if available
            if (playerLatencies.length > 0) {
                playerObj.LatencyInMs = {};
                playerLatencies.forEach(latency => {
                    playerObj.LatencyInMs[latency.RegionName] = latency.LatencyInMilliseconds;
                });
            }
            
            return playerObj;
        });

        // Generate a unique ticket ID
        const ticketId = `ticket-${userId}-${uuidv4()}`;

        // Get the configuration name without the full ARN
        const configNameMatch = gameLiftConfig.matchmakingConfigurationArn.match(/matchmakingconfiguration\/([^\/]+)$/);
        const configName = configNameMatch ? configNameMatch[1] : gameLiftConfig.matchmakingConfigurationArn;

        console.log('Loaded matchmaking config ARN:', process.env.AWS_GAMELIFT_MATCHMAKING_CONFIG_ARN);
        console.log('Resolved configName:', configName);

        // Create matchmaking ticket request
        const params = {
            ConfigurationName: configName,
            Players: players,
            TicketId: ticketId,
        };

        console.log('Starting matchmaking with params:', JSON.stringify(params, null, 2));

        try {
            // Call GameLift to create a matchmaking ticket
            const matchmakingTicket = await gameLift.startMatchmaking(params).promise();
            
            console.log('Ticket created successfully:', JSON.stringify(matchmakingTicket, null, 2));

            // Log the matchmaking ticket creation
            await logService.createLog('MATCHMAKING_TICKET_CREATED', userId, {
                ticketId: matchmakingTicket.TicketId || ticketId, // Use returned TicketId or our generated one
                configurationName: configName,
                playerCount: players.length,
                playerAttributes
            });

            return {
                success: true,
                message: 'Matchmaking ticket created successfully',
                ticketId: matchmakingTicket.TicketId || ticketId, // Return either the AWS ticket ID or our generated one
                estimatedWaitTime: matchmakingTicket.EstimatedWaitTime,
                ticketStatus: matchmakingTicket.Status
            };
        } catch (error) {
            console.error('Error from GameLift startMatchmaking:', error);
            
            // If AWS GameLift is not fully set up, return a mock response for testing
            console.log('Returning mock ticket response with our generated ticketId:', ticketId);
            
            // Log the matchmaking ticket creation
            await logService.createLog('MATCHMAKING_TICKET_CREATED', userId, {
                ticketId: ticketId,
                configurationName: configName,
                playerCount: players.length,
                playerAttributes,
                isSimulated: true
            });
            
            return {
                success: true,
                message: 'Matchmaking ticket created successfully',
                ticketId: ticketId,
                estimatedWaitTime: 30, // Mock estimated wait time
                ticketStatus: 'SEARCHING',
                isSimulated: true // Indicate this is a simulated ticket for testing
            };
        }
    } catch (error) {
        console.error('Error in createMatchmakingTicket outer try-catch:', error);
        
        // Log the error
        await logService.logSystemError('Matchmaking ticket creation failed', error, 'gameLiftService.createMatchmakingTicket');
        
        throw error;
    }
}

/**
 * Checks the status of a matchmaking ticket
 * @param {string} userId - The user's ID
 * @param {string} ticketId - The matchmaking ticket ID
 * @returns {Promise<object>} Ticket status information
 */
async function checkMatchmakingTicket(userId, ticketId) {
    try {
        // Validate the ticketId to ensure it's not a placeholder
        if (!ticketId || 
            ticketId === ':ticketId' || 
            ticketId.includes(':') || 
            ticketId === '{ticketId}' || 
            ticketId.includes('{')) {
            console.error('Invalid ticketId format received:', ticketId);
            return {
                success: false,
                message: 'Invalid ticket ID format',
                ticketId: ticketId || 'unknown'
            };
        }

        // Fix for truncated ticket IDs - look for a ticket prefix pattern
        // Example: ticket-playerXXX-UUIDPREFIX
        const ticketPattern = /^ticket-([a-zA-Z0-9]+)-([a-f0-9\-]+)$/;
        if (ticketId.match(ticketPattern) && ticketId.split('-').length < 6) {
            console.log('Detected truncated ticket ID:', ticketId);
            console.log('Using simulated response for truncated ID');
            
            // Log the ticket status check
            await logService.createLog('MATCHMAKING_TICKET_CHECKED', userId, {
                ticketId,
                status: 'SEARCHING',
                isSimulated: true,
                note: 'Truncated ID detected'
            });

            return {
                success: true,
                message: 'Matchmaking ticket status retrieved (simulated)',
                ticketId,
                status: 'SEARCHING',
                matchId: null,
                estimatedWaitTime: 15,
                isSimulated: true,
                note: 'Using truncated ticket ID, please use the full ID for production use'
            };
        }

        // Check matchmaking ticket status
        const params = {
            TicketIds: [ticketId]  // AWS expects TicketIds (plural) not TicketId
        };

        try {
            const ticketInfo = await gameLift.describeMatchmaking(params).promise();
            
            // No tickets found
            if (!ticketInfo.TicketList || ticketInfo.TicketList.length === 0) {
                return {
                    success: false,
                    message: 'Matchmaking ticket not found',
                    ticketId
                };
            }

            const ticket = ticketInfo.TicketList[0];
            
            // Check if match has been made
            let gameSessionInfo = null;
            let matchId = ticket.MatchId || null;
            
            if (ticket.GameSessionConnectionInfo) {
                const matchedPlayers = ticket.GameSessionConnectionInfo.MatchedPlayerSessions || [];
                
                // Extract the current user ID from the ticket ID (assuming format ticket-userId-uuid)
                const ticketParts = ticketId.split('-');
                const currentUserId = ticketParts.length > 1 ? ticketParts[1] : userId;
                
                // Check if we have real match data from GameLift
                const hasRealMatchData = ticket.GameSessionConnectionInfo && 
                                         ticket.GameSessionConnectionInfo.GameSessionArn;

                // Only add simulated data if we don't have real data and are in test mode
                if (!hasRealMatchData && (isTestMode || process.env.TEST_MODE === 'true') && 
                    ticket.Status === 'COMPLETED' && matchedPlayers.length < 2) {
                    console.log('Adding simulated opponent for testing (no real match data found)');
                    
                    // Generate a synthetic opponent ID if there are no opponents
                    const opponentFound = matchedPlayers.some(player => player.PlayerId !== currentUserId);
                    
                    if (!opponentFound) {
                        // Create a deterministic opponent ID based on the current user's ID
                        const opponentId = `opponent-${currentUserId}`;
                        
                        // Add the simulated opponent to the matched players
                        matchedPlayers.push({
                            PlayerId: opponentId,
                            PlayerSessionId: `psess-opponent-${uuidv4().substring(0, 8)}`
                        });
                        
                        console.log(`Added simulated opponent ${opponentId} to matchedPlayers`);
                    }
                }
                
                // Never override real matchId from GameLift
                if (!matchId && hasRealMatchData && ticket.Status === 'COMPLETED') {
                    // Extract real match ID from GameSessionArn
                    const arnParts = ticket.GameSessionConnectionInfo.GameSessionArn.split('/');
                    matchId = arnParts[arnParts.length - 1]; // Last part is the real matchId: 4faff3a7-8f6d-40e5-a96e-9a75178a6afd
                    console.log(`Using real matchId from GameSessionArn: ${matchId}`);
                } else if (!hasRealMatchData && (!matchId || matchId === null) && ticket.Status === 'COMPLETED') {
                    // Only use synthetic ID if we don't have real data
                    matchId = `match-${ticketId}`;
                    console.log(`Generated synthetic matchId: ${matchId} (no real match ID found)`);
                }
                
                gameSessionInfo = {
                    ipAddress: ticket.GameSessionConnectionInfo.IpAddress,
                    port: ticket.GameSessionConnectionInfo.Port,
                    gameSessionArn: ticket.GameSessionConnectionInfo.GameSessionArn,
                    matchedPlayers: matchedPlayers
                };

                if (matchId && hasRealMatchData) {
                    try {
                        const describeParams = {
                            GameSessionId: ticket.GameSessionConnectionInfo.GameSessionArn
                        };
                        
                        const gameSessionDetails = await gameLift.describeGameSessions(describeParams).promise();
                        
                        if (gameSessionDetails.GameSessions && gameSessionDetails.GameSessions.length > 0) {
                            const session = gameSessionDetails.GameSessions[0];
                            
                            // Get matchmaking data from GameSession
                            if (session.MatchmakerData) {
                                const matchData = JSON.parse(session.MatchmakerData);
                                // Remove storing teams in gameSessionInfo
                                // gameSessionInfo.teams = matchData.teams || [];
                                
                                // Update matchedPlayers with players from all teams
                                if (matchData.teams) {
                                    matchData.teams.forEach(team => {
                                        team.players.forEach(player => {
                                            // Case insensitive comparison and properly formatted playerId
                                            if (!matchedPlayers.some(p => 
                                                p.PlayerId.toLowerCase() === player.playerId.toLowerCase())) {
                                                matchedPlayers.push({
                                                    PlayerId: player.playerId,  // Keep original casing from the data
                                                    PlayerSessionId: `psess-${uuidv4().substring(0, 8)}`
                                                });
                                            }
                                        });
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`Failed to get game session details: ${error.message}`);
                    }
                }
            }

            // Log the ticket status check
            await logService.createLog('MATCHMAKING_TICKET_CHECKED', userId, {
                ticketId,
                status: ticket.Status,
                matchId: matchId,
                matchStatus: ticket.Status
            });

            return {
                success: true,
                message: 'Matchmaking ticket status retrieved',
                ticketId,
                status: ticket.Status,
                matchId: matchId,
                estimatedWaitTime: ticket.EstimatedWaitTime,
                gameSessionInfo
            };
        } catch (error) {
            console.error('Error from GameLift describeMatchmaking:', error);
            
            // If error mentions "not found" and the ID might be truncated
            if (error.message && error.message.includes('not found') && ticketId.split('-').length < 6) {
                console.log('Error indicates ticket not found, likely truncated ID:', ticketId);
                
                // Log the ticket status check
                await logService.createLog('MATCHMAKING_TICKET_CHECKED', userId, {
                    ticketId,
                    status: 'SEARCHING',
                    isSimulated: true,
                    note: 'Truncated ID detected after error'
                });
    
                return {
                    success: true,
                    message: 'Matchmaking ticket status retrieved (simulated)',
                    ticketId,
                    status: 'SEARCHING',
                    matchId: null,
                    estimatedWaitTime: 15,
                    isSimulated: true,
                    note: 'Using truncated ticket ID, please use the full ID for production use'
                };
            }
            
            // If AWS GameLift is not fully set up, return a mock response for testing
            console.log('Returning mock ticket status for ticketId:', ticketId);
            
            // Generate simulated ticket status based on ticket creation time
            const ticketIdParts = ticketId.split('-');
            const playerId = ticketIdParts[1];
            
            // Log the ticket status check
            await logService.createLog('MATCHMAKING_TICKET_CHECKED', userId, {
                ticketId,
                status: 'SEARCHING',
                isSimulated: true
            });

            return {
                success: true,
                message: 'Matchmaking ticket status retrieved (simulated)',
                ticketId,
                status: 'SEARCHING',
                matchId: null,
                estimatedWaitTime: 15,
                isSimulated: true
            };
        }
    } catch (error) {
        console.error('Error checking matchmaking ticket:', error);
        
        // Log the error
        await logService.logSystemError('Matchmaking ticket check failed', error, 'gameLiftService.checkMatchmakingTicket');
        
        throw error;
    }
}

/**
 * Cancels a matchmaking ticket
 * @param {string} userId - The user's ID
 * @param {string} ticketId - The matchmaking ticket ID
 * @returns {Promise<object>} Cancellation result
 */
async function cancelMatchmakingTicket(userId, ticketId) {
    try {
        // Cancel matchmaking ticket
        const params = {
            TicketId: ticketId
        };

        try {
            await gameLift.stopMatchmaking(params).promise();

            // Log the ticket cancellation
            await logService.createLog('MATCHMAKING_TICKET_CANCELLED', userId, {
                ticketId
            });

            return {
                success: true,
                message: 'Matchmaking ticket cancelled successfully',
                ticketId
            };
        } catch (error) {
            console.error('Error from GameLift stopMatchmaking:', error);
            
            // If AWS GameLift is not fully set up, return a mock response for testing
            console.log('Returning mock ticket cancellation for ticketId:', ticketId);
            
            // Log the ticket cancellation
            await logService.createLog('MATCHMAKING_TICKET_CANCELLED', userId, {
                ticketId,
                isSimulated: true
            });

            return {
                success: true,
                message: 'Matchmaking ticket cancelled successfully (simulated)',
                ticketId,
                isSimulated: true
            };
        }
    } catch (error) {
        console.error('Error cancelling matchmaking ticket:', error);
        
        // Log the error
        await logService.logSystemError('Matchmaking ticket cancellation failed', error, 'gameLiftService.cancelMatchmakingTicket');
        
        throw error;
    }
}

/**
 * Accepts or rejects a match
 * @param {string} userId - The user's ID
 * @param {string} ticketId - The matchmaking ticket ID
 * @param {string} matchId - The match ID
 * @param {string} acceptanceStatus - The acceptance status (ACCEPT/REJECT)
 * @returns {Promise<object>} Acceptance result
 */
async function acceptMatch(userId, ticketId, matchId, acceptanceStatus = 'ACCEPT') {
    try {
        // Accept the match
        const params = {
            MatchId: matchId,
            TicketId: ticketId,
            PlayerIds: [userId], // Changed from PlayerId to PlayerIds (array)
            AcceptanceType: acceptanceStatus // Changed from AcceptanceStatus to AcceptanceType
        };

        try {
            await gameLift.acceptMatch(params).promise();

            // Log the match acceptance
            await logService.createLog('MATCHMAKING_MATCH_ACCEPTED', userId, {
                ticketId,
                matchId,
                acceptanceStatus
            });

            return {
                success: true,
                message: `Match ${acceptanceStatus === 'ACCEPT' ? 'accepted' : 'rejected'} successfully`,
                ticketId,
                matchId,
                acceptanceStatus
            };
        } catch (error) {
            console.error('Error from GameLift acceptMatch:', error);
            
            // If AWS GameLift is not fully set up, return a mock response for testing
            console.log('Returning mock match acceptance for matchId:', matchId);
            
            // Log the match acceptance
            await logService.createLog('MATCHMAKING_MATCH_ACCEPTED', userId, {
                ticketId,
                matchId,
                acceptanceStatus,
                isSimulated: true
            });
            
            return {
                success: true,
                message: `Match ${acceptanceStatus === 'ACCEPT' ? 'accepted' : 'rejected'} successfully (simulated)`,
                ticketId,
                matchId,
                acceptanceStatus,
                isSimulated: true
            };
        }
    } catch (error) {
        console.error('Error accepting match:', error);
        
        // Log the error
        await logService.logSystemError('Match acceptance failed', error, 'gameLiftService.acceptMatch');
        
        throw error;
    }
}

/**
 * Gets match details
 * @param {string} userId - The user's ID 
 * @param {string} matchId - The match ID
 * @returns {Promise<object>} Match details
 */
async function getMatchDetails(userId, matchId) {
    try {
        console.log(`Getting match details for matchId: ${matchId}`);
        
        // Generate simulated match details with some mock data - directly return this for testing
        const simPlayer1 = { 
            PlayerId: userId,
            PlayerAttributes: {
                skill: { N: 2200 },
                role: { S: "healer" },
                region: { S: "ap-northeast-2" }
            }
        };
        
        const simPlayer2 = { 
            PlayerId: "player-bot-1",
            PlayerAttributes: {
                skill: { N: 2150 },
                role: { S: "warrior" },
                region: { S: "ap-northeast-2" }
            }
        };
        
        // Log the match details request for the simulated match
        await logService.createLog('MATCHMAKING_MATCH_DETAILS_REQUESTED', userId, {
            matchId,
            status: 'COMPLETED',
            isSimulated: true
        });
        
        // Skip AWS GameLift calls entirely for now and return simulated data
        console.log('Returning match details simulation for:', matchId);
        
        return {
            success: true,
            message: 'Match details retrieved (simulated)',
            matchId,
            status: 'COMPLETED',
            players: [simPlayer1, simPlayer2],
            gameSessionInfo: {
                IpAddress: "192.168.0.1",
                Port: 7777,
                GameSessionArn: "arn:aws:gamelift:ap-northeast-2:576432758876:gamesession/fleet-12345/simulation",
                MatchedPlayerSessions: [
                    {
                        PlayerId: userId,
                        PlayerSessionId: "psess-" + uuidv4().substring(0, 8)
                    },
                    {
                        PlayerId: "player-bot-1",
                        PlayerSessionId: "psess-" + uuidv4().substring(0, 8)
                    }
                ]
            },
            isSimulated: true
        };
        
        /* Original AWS code - disabled temporarily
        // Get match details (this is a partial implementation as GameLift doesn't have a direct match lookup)
        // You may need to store match details in your own database when matches are created
        
        // Using the FlexMatch API to get game session details
        const params = {
            TicketIds: [matchId]
        };

        try {
            const matchDetails = await gameLift.describeMatchmaking(params).promise();

            if (!matchDetails.TicketList || matchDetails.TicketList.length === 0) {
                return {
                    success: false,
                    message: 'Match not found',
                    matchId
                };
            }

            const match = matchDetails.TicketList[0];
            
            // Log the match details request
            await logService.createLog('MATCHMAKING_MATCH_DETAILS_REQUESTED', userId, {
                matchId,
                status: match.Status
            });

            return {
                success: true,
                message: 'Match details retrieved',
                matchId,
                status: match.Status,
                players: match.Players || [],
                gameSessionInfo: match.GameSessionConnectionInfo || null
            };
        } catch (error) {
            console.error('Error from GameLift describeMatchmaking (match details):', error);
            
            // If AWS GameLift is not fully set up, return a mock response for testing
            console.log('Returning mock match details for matchId:', matchId);
            
            // Generate simulated match details - see above
        }
        */
    } catch (error) {
        console.error('Error getting match details:', error);
        
        // Log the error
        await logService.logSystemError('Match details retrieval failed', error, 'gameLiftService.getMatchDetails');
        
        throw error;
    }
}

/**
 * Gets the pre-signed URL for GameLift game session logs
 * @param {string} userId - The user's ID
 * @param {string} gameSessionId - The game session ID or ARN
 * @returns {Promise<object>} Log URL information
 */
async function getGameSessionLogUrl(userId, gameSessionId) {
    try {
        console.log(`Getting game session log URL for session: ${gameSessionId}`);
        
        // If a full ARN is provided, extract just the session ID
        let sessionId = gameSessionId;
        if (gameSessionId.includes('arn:aws:gamelift')) {
            const arnParts = gameSessionId.split('/');
            sessionId = arnParts[arnParts.length - 1];
        }
        
        // Always return local sample log for test environment - this guarantees we can test the functionality
        // even when using test mode or when real logs aren't available
        if (isTestMode || process.env.NODE_ENV === 'development') {
            console.log('Using sample log file for test/development environment');
            
            // Generate server URL based on current environment
            const port = process.env.PORT || 5000;
            const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;
            const logUrl = `${serverUrl}/public/sample-gamelift-log.txt`;
            
            // Log the log URL request
            try {
                await logService.createLog('GAME_SESSION_LOG_REQUESTED', userId, {
                    gameSessionId: sessionId,
                    logUrlGenerated: true,
                    isSimulated: true
                });
            } catch (logError) {
                console.log('Warning: Unable to create log entry:', logError.message);
            }
            
            return {
                success: true,
                message: 'Game session log URL generated successfully (simulated)',
                gameSessionId: sessionId,
                logUrl: logUrl,
                isSimulated: true
            };
        }
        
        try {
            const result = await gameLift.getGameSessionLogUrl({
                GameSessionId: sessionId
            }).promise();
            
            // Log the log URL request
            try {
                await logService.createLog('GAME_SESSION_LOG_REQUESTED', userId, {
                    gameSessionId: sessionId,
                    logUrlGenerated: true
                });
            } catch (logError) {
                console.log('Warning: Unable to create log entry:', logError.message);
            }
            
            return {
                success: true,
                message: 'Game session log URL generated successfully',
                gameSessionId: sessionId,
                logUrl: result.PreSignedUrl
            };
        } catch (error) {
            console.error('Error fetching game session log URL:', error);
            
            // If any error occurs, still return a sample log URL for easier testing/development
            console.log('Returning sample log URL due to error');
            
            // Generate server URL based on current environment
            const port = process.env.PORT || 5000;
            const serverUrl = process.env.SERVER_URL || `http://localhost:${port}`;
            const logUrl = `${serverUrl}/public/sample-gamelift-log.txt`;
            
            // Log the log URL request
            try {
                await logService.createLog('GAME_SESSION_LOG_REQUESTED', userId, {
                    gameSessionId: sessionId,
                    logUrlGenerated: true,
                    isSimulated: true,
                    errorOccurred: true
                });
            } catch (logError) {
                console.log('Warning: Unable to create log entry:', logError.message);
            }
            
            return {
                success: true,
                message: 'Game session log URL generated successfully (simulated due to error)',
                gameSessionId: sessionId,
                logUrl: logUrl,
                isSimulated: true
            };
        }
    } catch (error) {
        console.error('Error in getGameSessionLogUrl:', error);
        
        // Log the error
        await logService.logSystemError('Game session log URL generation failed', error, 'gameLiftService.getGameSessionLogUrl');
        
        throw error;
    }
}

module.exports = {
    createMatchmakingTicket,
    checkMatchmakingTicket,
    cancelMatchmakingTicket,
    acceptMatch,
    getMatchDetails,
    getGameSessionLogUrl
}; 