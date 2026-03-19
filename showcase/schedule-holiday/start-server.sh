#!/bin/bash
# Schedule Holiday Showcase Server
# Starts a local HTTP server to serve the showcase

echo "============================================"
echo " Schedule Holiday Showcase"
echo " Migrated from feriado-v6"
echo "============================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if command -v python3 &> /dev/null; then
    echo "Starting Python HTTP server on port 8080..."
    echo ""
    echo "Open in browser: http://localhost:8080/showcase/schedule-holiday/"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd "$PROJECT_ROOT"
    python3 -m http.server 8080
    exit 0
fi

if command -v python &> /dev/null; then
    echo "Starting Python HTTP server on port 8080..."
    echo ""
    echo "Open in browser: http://localhost:8080/showcase/schedule-holiday/"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd "$PROJECT_ROOT"
    python -m http.server 8080
    exit 0
fi

if command -v node &> /dev/null; then
    echo "Starting Node.js HTTP server on port 8080..."
    echo ""
    echo "Open in browser: http://localhost:8080/showcase/schedule-holiday/"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd "$PROJECT_ROOT"
    npx http-server -p 8080 -c-1
    exit 0
fi

echo "ERROR: Neither Python nor Node.js found."
exit 1
