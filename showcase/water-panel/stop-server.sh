#!/bin/bash
echo "Stopping http-server on port 3333..."
pkill -f "http-server.*3333" || echo "No server found on port 3333"
echo "Done."
