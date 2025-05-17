# GameLift Matchmaking API Documentation

This document describes the API endpoints for AWS GameLift FlexMatch integration.

## Prerequisites

Before using these APIs, ensure you have:

1. A valid AWS account with GameLift service enabled
2. A configured GameLift fleet
3. A FlexMatch matchmaking configuration and ruleset
4. Environment variables properly set in the `.env` file
5. AWS SDK installed via npm

## API Endpoints

### Create Matchmaking Ticket

Creates a new matchmaking ticket for a player or group of players.

**Endpoint**: `POST /api/matchmaking/ticket`

**Request Body**:
```json
{
  "userId": "player123",
  "playerAttributes": {
    "skill": 1200,
    "role": "warrior",
    "region": "us-east",
    "latencies": {
      "us-east": 20,
      "us-west": 90,
      "eu-central": 150
    }
  },
  "playerIds": ["player456", "player789"] // Optional - for group matchmaking
}
```

**Response**:
```json
{
  "success": true,
  "message": "Matchmaking ticket created successfully",
  "ticketId": "ticket-player123-abc123",
  "estimatedWaitTime": 30,
  "ticketStatus": "SEARCHING"
}
```

### Check Matchmaking Ticket Status

Checks the status of an existing matchmaking ticket.

**Endpoint**: `GET /api/matchmaking/ticket/:ticketId?userId=player123`

**URL Parameters**:
- `ticketId`: The ID of the matchmaking ticket to check

**Query Parameters**:
- `userId`: The ID of the user who created the ticket

**Response**:
```json
{
  "success": true,
  "message": "Matchmaking ticket status retrieved",
  "ticketId": "ticket-player123-abc123",
  "status": "COMPLETED",
  "matchId": "match-abc123",
  "estimatedWaitTime": 0,
  "gameSessionInfo": {
    "ipAddress": "198.51.100.1",
    "port": 7777,
    "gameSessionArn": "arn:aws:gamelift:us-east-1:123456789012:gamesession/fleet-123/abc123",
    "matchedPlayers": [
      {
        "playerId": "player123",
        "playerSessionId": "psess-abc123"
      }
    ]
  }
}
```

Possible status values:
- `SEARCHING`: The matchmaker is actively searching for a match.
- `REQUIRES_ACCEPTANCE`: A match was found but requires player acceptance.
- `PENDING_FULFILLMENT`: Players have accepted the match and a game session is being created.
- `COMPLETED`: Match completed successfully, game session created.
- `FAILED`: Match failed during processing.
- `CANCELLED`: Ticket was cancelled.
- `TIMED_OUT`: Ticket expired without finding a match.

### Cancel Matchmaking Ticket

Cancels an existing matchmaking ticket.

**Endpoint**: `DELETE /api/matchmaking/ticket/:ticketId`

**URL Parameters**:
- `ticketId`: The ID of the matchmaking ticket to cancel

**Request Body**:
```json
{
  "userId": "player123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Matchmaking ticket cancelled successfully",
  "ticketId": "ticket-player123-abc123"
}
```

### Accept or Reject Match

Used to accept or reject a match when player acceptance is required.

**Endpoint**: `POST /api/matchmaking/match/accept`

**Request Body**:
```json
{
  "userId": "player123",
  "ticketId": "ticket-player123-abc123",
  "matchId": "match-abc123",
  "acceptanceStatus": "ACCEPT" // or "REJECT"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Match accepted successfully",
  "ticketId": "ticket-player123-abc123",
  "matchId": "match-abc123",
  "acceptanceStatus": "ACCEPT"
}
```

### Get Match Details

Retrieves details about a match.

**Endpoint**: `GET /api/matchmaking/match/:matchId?userId=player123`

**URL Parameters**:
- `matchId`: The ID of the match to retrieve

**Query Parameters**:
- `userId`: The ID of the user requesting the match details

**Response**:
```json
{
  "success": true,
  "message": "Match details retrieved",
  "matchId": "match-abc123",
  "status": "COMPLETED",
  "players": [
    {
      "PlayerId": "player123",
      "PlayerAttributes": {
        "skill": 1200,
        "role": "warrior"
      }
    },
    {
      "PlayerId": "player456",
      "PlayerAttributes": {
        "skill": 1220,
        "role": "mage"
      }
    }
  ],
  "gameSessionInfo": {
    "IpAddress": "198.51.100.1",
    "Port": 7777,
    "GameSessionArn": "arn:aws:gamelift:us-east-1:123456789012:gamesession/fleet-123/abc123",
    "MatchedPlayerSessions": [
      {
        "PlayerId": "player123",
        "PlayerSessionId": "psess-abc123"
      },
      {
        "PlayerId": "player456",
        "PlayerSessionId": "psess-def456"
      }
    ]
  }
}
```

## Client Implementation

### Unity Implementation Example

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.Networking;
using System.Collections.Generic;
using Newtonsoft.Json;

public class MatchmakingManager : MonoBehaviour
{
    private string apiUrl = "http://your-api-server.com/api/matchmaking";
    private string userId;
    private string ticketId;
    private string matchId;
    private bool isMatchmaking = false;
    private float checkInterval = 3f; // Check ticket status every 3 seconds
    private Coroutine ticketCheckCoroutine;

    // Start matchmaking process
    public void StartMatchmaking(string skill, string role, string region)
    {
        // Get user ID from auth system
        userId = AuthManager.GetUserId();
        
        // Create player attributes
        Dictionary<string, object> playerAttributes = new Dictionary<string, object>
        {
            { "skill", int.Parse(skill) },
            { "role", role },
            { "region", region },
            { "latencies", GetRegionLatencies() }
        };
        
        StartCoroutine(CreateMatchmakingTicket(playerAttributes));
    }
    
    // Create matchmaking ticket
    private IEnumerator CreateMatchmakingTicket(Dictionary<string, object> playerAttributes)
    {
        Dictionary<string, object> requestData = new Dictionary<string, object>
        {
            { "userId", userId },
            { "playerAttributes", playerAttributes }
        };
        
        string jsonData = JsonConvert.SerializeObject(requestData);
        
        using (UnityWebRequest request = new UnityWebRequest(apiUrl + "/ticket", "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonData);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                var response = JsonConvert.DeserializeObject<Dictionary<string, object>>(request.downloadHandler.text);
                
                if ((bool)response["success"])
                {
                    ticketId = (string)response["ticketId"];
                    isMatchmaking = true;
                    
                    // Start polling for ticket status
                    ticketCheckCoroutine = StartCoroutine(PollTicketStatus());
                    
                    Debug.Log("Matchmaking started with ticket: " + ticketId);
                }
                else
                {
                    Debug.LogError("Failed to create matchmaking ticket: " + (string)response["message"]);
                }
            }
            else
            {
                Debug.LogError("Error creating matchmaking ticket: " + request.error);
            }
        }
    }
    
    // Poll ticket status
    private IEnumerator PollTicketStatus()
    {
        while (isMatchmaking)
        {
            yield return new WaitForSeconds(checkInterval);
            
            using (UnityWebRequest request = UnityWebRequest.Get(apiUrl + "/ticket/" + ticketId + "?userId=" + userId))
            {
                yield return request.SendWebRequest();
                
                if (request.result == UnityWebRequest.Result.Success)
                {
                    var response = JsonConvert.DeserializeObject<Dictionary<string, object>>(request.downloadHandler.text);
                    
                    if ((bool)response["success"])
                    {
                        string status = (string)response["status"];
                        Debug.Log("Ticket status: " + status);
                        
                        // Handle different status outcomes
                        switch (status)
                        {
                            case "REQUIRES_ACCEPTANCE":
                                matchId = (string)response["matchId"];
                                isMatchmaking = false;
                                StopCoroutine(ticketCheckCoroutine);
                                ShowMatchAcceptanceUI();
                                break;
                                
                            case "COMPLETED":
                                matchId = (string)response["matchId"];
                                isMatchmaking = false;
                                StopCoroutine(ticketCheckCoroutine);
                                
                                // Extract game session info and connect to server
                                var gameSessionInfo = response["gameSessionInfo"] as Dictionary<string, object>;
                                ConnectToGameServer(gameSessionInfo);
                                break;
                                
                            case "FAILED":
                            case "CANCELLED":
                            case "TIMED_OUT":
                                isMatchmaking = false;
                                StopCoroutine(ticketCheckCoroutine);
                                ShowMatchmakingFailedUI(status);
                                break;
                        }
                    }
                    else
                    {
                        Debug.LogError("Failed to check ticket status: " + (string)response["message"]);
                    }
                }
                else
                {
                    Debug.LogError("Error checking ticket status: " + request.error);
                }
            }
        }
    }
    
    // Cancel matchmaking
    public void CancelMatchmaking()
    {
        if (!isMatchmaking || string.IsNullOrEmpty(ticketId))
            return;
            
        StartCoroutine(CancelMatchmakingTicket());
    }
    
    private IEnumerator CancelMatchmakingTicket()
    {
        Dictionary<string, string> requestData = new Dictionary<string, string>
        {
            { "userId", userId }
        };
        
        string jsonData = JsonConvert.SerializeObject(requestData);
        
        using (UnityWebRequest request = UnityWebRequest.Delete(apiUrl + "/ticket/" + ticketId))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonData);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                var response = JsonConvert.DeserializeObject<Dictionary<string, object>>(request.downloadHandler.text);
                
                if ((bool)response["success"])
                {
                    isMatchmaking = false;
                    StopCoroutine(ticketCheckCoroutine);
                    Debug.Log("Matchmaking cancelled");
                }
                else
                {
                    Debug.LogError("Failed to cancel matchmaking: " + (string)response["message"]);
                }
            }
            else
            {
                Debug.LogError("Error cancelling matchmaking: " + request.error);
            }
        }
    }
    
    // Accept or reject match
    public void RespondToMatch(bool accept)
    {
        if (string.IsNullOrEmpty(matchId) || string.IsNullOrEmpty(ticketId))
            return;
            
        StartCoroutine(SendMatchResponse(accept ? "ACCEPT" : "REJECT"));
    }
    
    private IEnumerator SendMatchResponse(string acceptanceStatus)
    {
        Dictionary<string, string> requestData = new Dictionary<string, string>
        {
            { "userId", userId },
            { "ticketId", ticketId },
            { "matchId", matchId },
            { "acceptanceStatus", acceptanceStatus }
        };
        
        string jsonData = JsonConvert.SerializeObject(requestData);
        
        using (UnityWebRequest request = new UnityWebRequest(apiUrl + "/match/accept", "POST"))
        {
            byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(jsonData);
            request.uploadHandler = new UploadHandlerRaw(bodyRaw);
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                var response = JsonConvert.DeserializeObject<Dictionary<string, object>>(request.downloadHandler.text);
                
                if ((bool)response["success"])
                {
                    Debug.Log("Match " + acceptanceStatus.ToLower() + "ed");
                    
                    if (acceptanceStatus == "ACCEPT")
                    {
                        // Start polling for ticket status again to check for completion
                        isMatchmaking = true;
                        ticketCheckCoroutine = StartCoroutine(PollTicketStatus());
                    }
                }
                else
                {
                    Debug.LogError("Failed to " + acceptanceStatus.ToLower() + " match: " + (string)response["message"]);
                }
            }
            else
            {
                Debug.LogError("Error " + acceptanceStatus.ToLower() + "ing match: " + request.error);
            }
        }
    }
    
    // Get region latencies
    private Dictionary<string, int> GetRegionLatencies()
    {
        // In a real implementation, you would measure actual latencies
        return new Dictionary<string, int>
        {
            { "us-east-1", 50 },
            { "us-west-2", 100 },
            { "eu-west-1", 150 }
        };
    }
    
    // Connect to game server
    private void ConnectToGameServer(Dictionary<string, object> gameSessionInfo)
    {
        string ipAddress = (string)gameSessionInfo["ipAddress"];
        int port = Convert.ToInt32(gameSessionInfo["port"]);
        
        Debug.Log("Connecting to game server at " + ipAddress + ":" + port);
        
        // In a real implementation, you would connect to the game server here
        // using your game's networking library
    }
    
    // UI Helpers
    private void ShowMatchAcceptanceUI()
    {
        // Show UI for accepting or rejecting the match
    }
    
    private void ShowMatchmakingFailedUI(string reason)
    {
        // Show UI for matchmaking failure
    }
}
```

## Error Handling

The API follows a consistent error handling pattern:

- HTTP 400: Bad Request - Missing required parameters or invalid input
- HTTP 404: Not Found - Resource not found (ticket, match, etc.)
- HTTP 500: Internal Server Error - Server-side errors

All error responses include a `success: false` flag and a descriptive message.

## Logging

All matchmaking events are logged to the system logs with the following event types:

- `MATCHMAKING_TICKET_CREATED`
- `MATCHMAKING_TICKET_CHECKED`
- `MATCHMAKING_TICKET_CANCELLED`
- `MATCHMAKING_MATCH_FOUND`
- `MATCHMAKING_MATCH_ACCEPTED`
- `MATCHMAKING_MATCH_REJECTED`
- `MATCHMAKING_MATCH_DETAILS_REQUESTED`
- `MATCHMAKING_GAME_SESSION_CREATED`
- `MATCHMAKING_PLAYER_JOINED`
- `MATCHMAKING_PLAYER_LEFT`

These logs can be accessed through the logging API. 