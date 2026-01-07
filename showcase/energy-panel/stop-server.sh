#!/bin/bash
# EnergyPanel Showcase - Stop HTTP Server
# Stops the server running on port 3333

PORT=3333

echo "Stopping server on port $PORT..."

# Kill process on port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "Server stopped."
