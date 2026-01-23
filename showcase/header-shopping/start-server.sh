#!/bin/bash
# HeaderShopping Showcase HTTP Server

PORT=3335

echo "Stopping any existing server on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "Starting HTTP server on port $PORT..."
cd "$(dirname "$0")/../.."

npx serve . -p $PORT &

sleep 2

echo ""
echo "Server running at: http://localhost:$PORT"
echo "Open showcase at: http://localhost:$PORT/showcase/header-shopping/"
echo ""

if command -v open &> /dev/null; then
    open "http://localhost:$PORT/showcase/header-shopping/"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT/showcase/header-shopping/"
fi
