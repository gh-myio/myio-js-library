#!/bin/bash
# RFC-0158: Start Fancoil Remote Showcase Server
# Starts a simple HTTP server on port 8081 for the showcase

echo "Starting Fancoil Remote Showcase Server on port 8081..."
echo ""
echo "Open http://localhost:8081 in your browser"
echo "Press Ctrl+C to stop the server"
echo ""

cd "$(dirname "$0")/../.."

if command -v python3 &> /dev/null; then
    python3 -m http.server 8081 --bind 127.0.0.1
elif command -v python &> /dev/null; then
    python -m http.server 8081 --bind 127.0.0.1
else
    echo "Python not found. Trying Node.js..."
    npx serve -l 8081 .
fi
