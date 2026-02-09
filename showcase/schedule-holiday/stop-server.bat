@echo off
REM Stop Schedule Holiday Showcase Server

echo Stopping HTTP servers on port 8080...

taskkill /F /IM python.exe /FI "WINDOWTITLE eq *8080*" >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Done.
pause
