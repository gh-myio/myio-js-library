@echo off
echo Stopping HTTP server on port 3340...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3340') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo Done.
pause
