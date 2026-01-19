@echo off
REM Stop MAIN_UNIQUE_DATASOURCE Showcase Server
REM Kills any process running on port 3333

set PORT=3333

echo Stopping server on port %PORT%...

REM Kill process on port using PowerShell
powershell -Command "Get-NetTCPConnection -LocalPort %PORT% -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }" 2>nul

REM Alternative: using netstat + taskkill
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% "') do (
    taskkill /PID %%a /F 2>nul
)

echo Server stopped.
