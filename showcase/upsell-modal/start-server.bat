@echo off
echo Starting Upsell Modal Showcase Server...
echo Open your browser to: http://localhost:3334/showcase/upsell-modal/
echo Press Ctrl+C to stop the server
cd /d "%~dp0..\.."
npx http-server . -p 3334 -o /showcase/upsell-modal/
