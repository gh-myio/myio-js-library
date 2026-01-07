#!/bin/bash
# EnergyPanel Showcase HTTP Server
# Kills any existing process on port 3333 and starts a new server

PORT=3333

echo "Stopping any existing server on port $PORT..."

# Kill process on port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "Starting HTTP server on port $PORT..."

# Navigate to project root (two levels up from showcase/energy-panel)
cd "$(dirname "$0")/../.."

# Start server in background
npx serve . -p $PORT &

sleep 2

echo ""
echo "Server running at: http://localhost:$PORT"
echo "Open showcase at: http://localhost:$PORT/showcase/energy-panel/"
echo ""

# Open browser (macOS)
if command -v open &> /dev/null; then
    open "http://localhost:$PORT/showcase/energy-panel/"
# Open browser (Linux)
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT/showcase/energy-panel/"
fi
