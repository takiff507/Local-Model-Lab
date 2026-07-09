@echo off
setlocal
title Local Model Lab - Launcher
cd /d "%~dp0"
echo.
echo  ============================================
echo    LOCAL MODEL LAB - Starting...
echo  ============================================
echo.
if exist "release\win-unpacked\Local Model Lab.exe" (
  start "" "release\win-unpacked\Local Model Lab.exe"
  exit /b 0
)
npm.cmd run electron-start
pause
