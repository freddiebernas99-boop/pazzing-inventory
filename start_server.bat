@echo off
title Pazings Inventory & Sales System - Local Server
color 1F

echo ========================================================
echo   PAZINGS INVENTORY & SALES MANAGEMENT SYSTEM
echo   Browser-local Client & Local Static Server
echo ========================================================
echo.
echo Starting local static server on Windows...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

pause
