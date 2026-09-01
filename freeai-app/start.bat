@echo off
title FreeAI IDE
cd /d "%~dp0"
echo Starting FreeAI IDE...
call npm install --silent 2>nul
call npx electron . --no-sandbox
