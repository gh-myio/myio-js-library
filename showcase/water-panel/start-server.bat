@echo off
echo Starting local server for WaterPanel showcase...
echo.
echo Server will run at: http://localhost:3333
echo Showcase URL: http://localhost:3333/showcase/water-panel/
echo.
echo Press Ctrl+C to stop the server.
echo.

cd /d "%~dp0..\.."
npx http-server -p 3333 -c-1 --cors
