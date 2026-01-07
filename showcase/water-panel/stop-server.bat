@echo off
echo Stopping http-server on port 3333...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3333 ^| findstr LISTENING') do (
    taskkill /f /pid %%a
    echo Killed process %%a
)
echo Done.
