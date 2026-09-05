@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo   IELTS Listening Simulator - Auto Index & Push
echo ===================================================
echo.

node update-index.js --push %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] An error occurred during index update or git push.
    echo.
) else (
    echo.
    echo [SUCCESS] Operation finished successfully!
    echo.
)

pause
