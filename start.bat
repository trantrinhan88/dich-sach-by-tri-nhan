@echo off
title Dich Anh Viet - Dev Server
cd /d "%~dp0"
echo.
echo  ====================================
echo   DICH ANH VIET - Khoi dong server
echo  ====================================
echo.
echo  Thu muc: %~dp0
echo  URL: http://localhost:3000
echo.
npm run dev
pause
