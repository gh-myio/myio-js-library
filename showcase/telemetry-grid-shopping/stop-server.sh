#!/bin/bash
# Stop TelemetryGridShopping Showcase HTTP Server

PORT=3334

echo "Stopping server on port $PORT..."

# Kill process on port
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "Server stopped."
