@echo off
setlocal
cd /d "%~dp0"
where g++ >nul 2>nul
if %errorlevel% equ 0 goto gcc
where cl >nul 2>nul
if %errorlevel% equ 0 goto msvc
echo A C++17 compiler is required for this one-time build.
echo Run this script with g++ on PATH, or from a Visual Studio Developer Command Prompt.
pause
exit /b 1
:gcc
g++ -std=c++17 -O3 -DNDEBUG -Wall -Wextra -Wpedantic native\milo.cpp -o milo.exe
if errorlevel 1 goto failed
goto done
:msvc
cl /nologo /std:c++17 /O2 /EHsc /utf-8 native\milo.cpp /Fe:milo.exe
if errorlevel 1 goto failed
:done
echo Built milo.exe. Try: milo.exe examples\hello.milo
pause
exit /b 0
:failed
echo Build failed. Read the compiler messages above.
pause
exit /b 1
