#!/bin/bash

echo "=== Testing Matchmaking API ==="
echo ""

echo "1. Creating a matchmaking ticket..."
echo "Request: POST http://localhost:5000/api/matchmaking/ticket"
RESPONSE=$(curl -s -X POST image.pnghttp://localhost:5000/api/matchmaking/ticket -H "Content-Type: application/json" -d "{\"userId\": \"player333\", \"playerAttributes\": {\"skill\": 1500, \"role\": \"tank\", \"region\": \"ap-northeast-2\"}}")
echo "Full Response: $RESPONSE"
TICKET_ID=$(echo $RESPONSE | grep -o '"ticketId":"[^"]*' | sed 's/"ticketId":"//')
echo "Extracted Ticket ID: $TICKET_ID"
echo ""

# Check if ticket ID is empty and use a hardcoded one for testing subsequent steps
if [ -z "$TICKET_ID" ]; then
    echo "WARNING: Failed to extract ticket ID, using hardcoded ID for testing"
    TICKET_ID="ticket-player333-$(date +%s)"
    echo "Using Ticket ID: $TICKET_ID"
fi
echo ""

sleep 2

echo "2. Checking ticket status..."
echo "Request: GET http://localhost:5000/api/matchmaking/ticket/$TICKET_ID?userId=player333"
curl -v -X GET "http://localhost:5000/api/matchmaking/ticket/$TICKET_ID?userId=player333"
echo ""
echo ""

sleep 2

echo "3. Creating a match ID for testing..."
MATCH_ID="match-$(date +%s)"
echo "Match ID: $MATCH_ID"
echo ""

sleep 2

echo "4. Accepting the match..."
echo "Request: POST http://localhost:5000/api/matchmaking/match/accept"
curl -v -X POST http://localhost:5000/api/matchmaking/match/accept -H "Content-Type: application/json" -d "{\"userId\": \"player333\", \"ticketId\": \"$TICKET_ID\", \"matchId\": \"$MATCH_ID\", \"acceptanceStatus\": \"ACCEPT\"}"
echo ""
echo ""

sleep 2

echo "5. Getting match details..."
echo "Request: GET http://localhost:5000/api/matchmaking/match/$MATCH_ID?userId=player333"
curl -v -X GET "http://localhost:5000/api/matchmaking/match/$MATCH_ID?userId=player333"
echo ""
echo ""

sleep 2

echo "6. Cancelling the ticket..."
echo "Request: DELETE http://localhost:5000/api/matchmaking/ticket/$TICKET_ID"
curl -v -X DELETE "http://localhost:5000/api/matchmaking/ticket/$TICKET_ID" -H "Content-Type: application/json" -d "{\"userId\": \"player333\"}"
echo ""
echo ""

echo "=== Test complete ===" 