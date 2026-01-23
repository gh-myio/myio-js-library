@echo off
REM Consumption7DaysChart Showcase HTTP Server
REM Kills any existing process on port 3334 and starts a new server

set PORT=3334

echo Stopping any existing server on port %PORT%...

REM Kill process on port using PowerShell
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

REM Alternative: using netstat + taskkill
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    taskkill /PID %%a /F 2>nul
)

echo Starting HTTP server on port %PORT%...

REM Navigate to project root (two levels up from showcase\consumption-7days-chart)
cd /d "%~dp0..\.."

start "" npx serve . -p %PORT%

timeout /t 2 /nobreak >nul

echo.
echo Server running at: http://localhost:%PORT%
echo Open showcase at: http://localhost:%PORT%/showcase/consumption-7days-chart/
echo.
start "" "http://localhost:%PORT%/showcase/consumption-7days-chart/"
