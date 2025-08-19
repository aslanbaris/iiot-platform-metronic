@echo off
echo Starting IIOT Platform...
echo.

echo Starting Backend Server...
start "IIOT Backend" cmd /k "cd /d "%~dp0backend" && npm start"

echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo Starting Frontend Server...
start "IIOT Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo IIOT Platform is starting up!
echo Backend: http://localhost:5001
echo Frontend: http://localhost:5174
echo.
echo Press any key to exit this window...
pause >nul