#!/bin/bash
PORT=3339
echo "Stopping server on port $PORT..."

# Find PID listening on the port (Windows-compatible via netstat)
PID=$(netstat -ano 2>/dev/null | grep ":${PORT}.*LISTENING" | awk '{print $NF}' | head -1)

if [ -n "$PID" ]; then
  taskkill //PID "$PID" //F 2>/dev/null && echo "Killed PID $PID." || echo "Failed to kill PID $PID."
else
  echo "No process found on port $PORT."
fi

echo "Server stopped."
