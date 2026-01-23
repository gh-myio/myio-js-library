@echo off
REM MAIN_UNIQUE_DATASOURCE Showcase HTTP Server
REM RFC-0134: ThingsBoard Widget Simulation Environment
REM Kills any existing process on port 3333 and starts a new server

set PORT=3333

echo ============================================
echo  MAIN_UNIQUE_DATASOURCE Showcase Server
echo  RFC-0134: ThingsBoard Simulation
echo ============================================
echo.

echo Stopping any existing server on port %PORT%...

REM Kill process on port using PowerShell
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

REM Alternative: using netstat + taskkill
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    taskkill /PID %%a /F 2>nul
)

echo Starting HTTP server on port %PORT%...

REM Navigate to project root (two levels up from showcase\main-unique-datasource)
cd /d "%~dp0..\.."

REM Start server in background
start "" npx serve . -p %PORT%

timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo  Server running at: http://localhost:%PORT%
echo ============================================
echo.
echo  Showcase URL:
echo  http://localhost:%PORT%/showcase/main-unique-datasource/
echo.
echo  Prerequisites:
echo  - Run 'npm run build' to generate UMD bundle
echo.
echo ============================================

start "" "http://localhost:%PORT%/showcase/main-unique-datasource/"
