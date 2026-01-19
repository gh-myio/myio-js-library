#!/bin/bash
PORT=3337
echo "Stopping server on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
echo "Server stopped."
