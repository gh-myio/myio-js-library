#!/bin/bash
# RFC-0158: MAIN_BAS Showcase Server
# Starts a local HTTP server to serve the BAS dashboard showcase

echo "============================================"
echo " RFC-0158: MAIN_BAS Dashboard Showcase"
echo "============================================"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check if Python is available
if command -v python3 &> /dev/null; then
    echo "Starting Python HTTP server on port 8080..."
    echo ""
    echo "Open in browser: http://localhost:8080/showcase/myio-bas/"
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
    echo "Open in browser: http://localhost:8080/showcase/myio-bas/"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd "$PROJECT_ROOT"
    python -m http.server 8080
    exit 0
fi

# Check if Node.js is available
if command -v node &> /dev/null; then
    echo "Starting Node.js HTTP server on port 8080..."
    echo ""
    echo "Open in browser: http://localhost:8080/showcase/myio-bas/"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    cd "$PROJECT_ROOT"
    npx http-server -p 8080 -c-1
    exit 0
fi

echo "ERROR: Neither Python nor Node.js found."
echo "Please install Python or Node.js to run the local server."
echo ""
echo "Alternatively, you can use any HTTP server pointing to the project root."
exit 1
