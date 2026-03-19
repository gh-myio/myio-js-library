#!/bin/bash
echo "Stopping HTTP server on port 3340..."
lsof -ti:3340 | xargs kill -9 2>/dev/null && echo "Done." || echo "No process found on port 3340."
