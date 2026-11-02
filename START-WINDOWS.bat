@echo off
cd /d "%~dp0"
if not exist milo.exe (
    echo Run BUILD-WINDOWS.bat once to create milo.exe.
    pause
    exit /b 1
)
milo.exe %*
pause
