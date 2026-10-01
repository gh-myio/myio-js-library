#!/usr/bin/env bash
# Card Badges Showcase HTTP Server - Stop Script
PORT=3344

echo "Stopping server on port $PORT..."
PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null || true
fi

echo "Server stopped."
