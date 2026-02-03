@echo off
REM RFC-0001: Inventory Panel Showcase Server
REM Starts a local HTTP server to serve the Inventory Panel showcase

echo ============================================
echo  RFC-0001: Inventory Panel Showcase
echo ============================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting Python HTTP server on port 8080...
    echo.
    echo Open in browser: http://localhost:8080/showcase/inventory-panel/
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    cd /d "%~dp0..\.."
    python -m http.server 8080
    goto :eof
)

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting Node.js HTTP server on port 8080...
    echo.
    echo Open in browser: http://localhost:8080/showcase/inventory-panel/
    echo.
    echo Press Ctrl+C to stop the server
    echo.
    cd /d "%~dp0..\.."
    npx http-server -p 8080 -c-1
    goto :eof
)

echo ERROR: Neither Python nor Node.js found.
echo Please install Python or Node.js to run the local server.
echo.
echo Alternatively, you can use any HTTP server pointing to the project root.
pause
