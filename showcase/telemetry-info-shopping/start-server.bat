@echo off
set PORT=3337
echo Stopping any existing server on port %PORT%...
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    taskkill /PID %%a /F 2>nul
)
echo Starting HTTP server on port %PORT%...
cd /d "%~dp0..\.."
start "" npx serve . -p %PORT%
timeout /t 2 /nobreak >nul
echo.
echo Server running at: http://localhost:%PORT%
echo Open showcase at: http://localhost:%PORT%/showcase/telemetry-info-shopping/
echo.
start "" "http://localhost:%PORT%/showcase/telemetry-info-shopping/"
