#!/bin/bash
echo "Stopping Upsell Modal Showcase Server..."
pkill -f "http-server.*3334" 2>/dev/null || true
echo "Server stopped."
