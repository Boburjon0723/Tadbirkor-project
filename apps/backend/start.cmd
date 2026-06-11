@echo off
cd /d "%~dp0"

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo .env yaratildi. DATABASE_URL va JWT_SECRET ni tekshiring.
    ) else (
        echo .env topilmadi.
        exit /b 1
    )
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4003.*LISTENING"') do (
    echo Port 4003 band. PID %%a to'xtatilmoqda...
    taskkill /F /PID %%a >nul 2>&1
)

echo Go backend: http://localhost:4003/api
go run ./cmd/api
