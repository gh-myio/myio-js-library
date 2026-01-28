#!/bin/bash
# MAIN_UNIQUE_DATASOURCE Showcase HTTP Server
# RFC-0134: ThingsBoard Widget Simulation Environment
# Kills any existing process on port 3333 and starts a new server

PORT=3333

echo "============================================"
echo " MAIN_UNIQUE_DATASOURCE Showcase Server"
echo " RFC-0134: ThingsBoard Simulation"
echo "============================================"
echo ""

echo "Stopping any existing server on port $PORT..."

# Kill process on port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "Starting HTTP server on port $PORT..."

# Navigate to project root (two levels up from showcase/main-unique-datasource)
cd "$(dirname "$0")/../.."

# Start server in background
npx serve . -p $PORT &

sleep 2

echo ""
echo "============================================"
echo " Server running at: http://localhost:$PORT"
echo "============================================"
echo ""
echo " Showcase URL:"
echo " http://localhost:$PORT/showcase/main-unique-datasource/"
echo ""
echo " Prerequisites:"
echo " - Run 'npm run build' to generate UMD bundle"
echo ""
echo "============================================"

# Open browser (macOS)
if command -v open &> /dev/null; then
    open "http://localhost:$PORT/showcase/main-unique-datasource/"
# Open browser (Linux)
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT/showcase/main-unique-datasource/"
fi
