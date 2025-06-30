@echo off
rem =============================================
rem Start Univista Web (Next.js) application
rem =============================================

rem Change to the directory where this batch file lives
cd /d "%~dp0"

rem (Optional) install dependencies if node_modules not present
if not exist node_modules (
    echo Installing dependencies...
    npm install
)

rem Run the Next.js production server
echo Starting Univista Web on http://localhost:5000
npm start

rem Keep the window open so you can see logs/errors
pause 