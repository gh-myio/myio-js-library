#!/bin/bash
# Consumption7DaysChart Showcase HTTP Server
# Kills any existing process on port 3334 and starts a new server

PORT=3334

echo "Stopping any existing server on port $PORT..."

# Kill process on port (cross-platform approach)
if command -v lsof &> /dev/null; then
  # macOS / Linux
  lsof -ti:$PORT | xargs -r kill -9 2>/dev/null
elif command -v netstat &> /dev/null; then
  # Windows (Git Bash / MSYS)
  netstat -ano | grep ":$PORT " | awk '{print $5}' | xargs -r taskkill //PID //F 2>/dev/null
fi

# Also try PowerShell method for Windows
powershell -Command "Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>/dev/null

echo "Starting HTTP server on port $PORT..."

# Navigate to project root (two levels up from showcase/consumption-7days-chart)
cd "$(dirname "$0")/../.."

# Start server
npx serve . -p $PORT &

sleep 2
echo ""
echo "Server running at: http://localhost:$PORT"
echo "Open showcase at: http://localhost:$PORT/showcase/consumption-7days-chart/"
