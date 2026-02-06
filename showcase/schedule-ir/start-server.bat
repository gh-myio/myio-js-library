@echo off
REM Schedule IR Showcase HTTP Server
REM Kills any existing process on port 8080 and starts a new server

set PORT=8080

echo ============================================
echo  Schedule IR Showcase Server
echo  Migrated from agendamento-ir
echo ============================================
echo.

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
echo ============================================
echo  Server running at: http://localhost:%PORT%
echo ============================================
echo.
echo  Showcase URL:
echo  http://localhost:%PORT%/showcase/schedule-ir/
echo.
echo  Prerequisites:
echo  - Run 'npm run build' to generate UMD bundle
echo.
echo ============================================

start "" "http://localhost:%PORT%/showcase/schedule-ir/"
