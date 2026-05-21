#!/bin/bash
PORT=3340
echo "Stopping any existing server on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
echo "Starting HTTP server on port $PORT..."
cd "$(dirname "$0")/../.."
npx serve . -p $PORT &
sleep 2
echo ""
echo "Server running at: http://localhost:$PORT"
echo "Open showcase at: http://localhost:$PORT/showcase/pre-setup-2-0/"
if command -v open &> /dev/null; then
    open "http://localhost:$PORT/showcase/pre-setup-2-0/"
elif command -v xdg-open &> /dev/null; then
    xdg-open "http://localhost:$PORT/showcase/pre-setup-2-0/"
fi
