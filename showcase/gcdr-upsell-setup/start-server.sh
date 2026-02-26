#!/bin/bash
PORT=3340
echo "Starting HTTP server on port $PORT..."
cd "$(dirname "$0")/../.."
npx serve . -p $PORT &
sleep 2
echo ""
echo "Server running at: http://localhost:$PORT"
echo "Open showcase at: http://localhost:$PORT/showcase/gcdr-upsell-setup/"
echo ""
open "http://localhost:$PORT/showcase/gcdr-upsell-setup/" 2>/dev/null || xdg-open "http://localhost:$PORT/showcase/gcdr-upsell-setup/" 2>/dev/null || true
