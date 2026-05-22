@echo off
set PORT=3340
echo Starting HTTP server on port %PORT%...
cd /d "%~dp0..\.."
start "" npx serve . -p %PORT%
timeout /t 2 /nobreak >nul
echo.
echo Server running at: http://localhost:%PORT%
echo Open showcase at: http://localhost:%PORT%/showcase/pre-setup-2-0/
echo.
start "" "http://localhost:%PORT%/showcase/pre-setup-2-0/"
