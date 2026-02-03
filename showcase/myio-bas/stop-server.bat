@echo off
REM RFC-0158: Stop MAIN_BAS Showcase Server
REM Stops any running Python or Node.js HTTP servers on port 8080

echo Stopping HTTP servers on port 8080...

REM Kill Python processes
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *8080*" >nul 2>&1

REM Kill Node.js processes on port 8080
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Done.
pause
