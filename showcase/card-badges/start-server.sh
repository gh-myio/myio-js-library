#!/usr/bin/env bash
# Card Badges Showcase HTTP Server
set -e
PORT=3344

echo "Stopping any existing server on port $PORT..."
PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
if [ -n "$PID" ]; then
  kill -9 $PID 2>/dev/null || true
fi

cd "$(dirname "$0")/../.."

echo "Starting HTTP server on port $PORT..."
npx serve . -p $PORT &

sleep 2

echo ""
echo "Server running at: http://localhost:$PORT"
echo "Open showcase at: http://localhost:$PORT/showcase/card-badges/"
