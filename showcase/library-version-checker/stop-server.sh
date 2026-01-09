#!/bin/bash
# LibraryVersionChecker Showcase HTTP Server - Stop Script
# Kills any existing process on port 3333

PORT=3333

echo "Stopping server on port $PORT..."

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

echo ""
echo "Server stopped."
