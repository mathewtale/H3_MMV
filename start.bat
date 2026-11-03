@echo off
title M-Space
cd /d "%~dp0"

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Start Docker Desktop and try again.
    pause
    exit /b 1
)

echo Starting M-Space...
docker compose up -d --build
if errorlevel 1 (
    echo Could not start the containers.
    pause
    exit /b 1
)

echo Waiting for the frontend...
:wait
curl -s -o nul http://localhost:5170 || (timeout /t 1 >nul & goto wait)

start "" http://localhost:5170