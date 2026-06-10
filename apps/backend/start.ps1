# Go backend ishga tushirish (port 4003)
# Ishlatish: .\start.ps1   yoki   powershell -File start.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "`.env` yaratildi (.env.example dan). DATABASE_URL va JWT_SECRET ni tekshiring." -ForegroundColor Yellow
    } else {
        Write-Host "`.env` topilmadi. Avval `.env.example` dan nusxa oling." -ForegroundColor Red
        exit 1
    }
}

$port = 4003
$listeners = netstat -ano 2>$null | Select-String ":$port\s+.*LISTENING"
if ($listeners) {
    $procId = ($listeners[0].ToString() -split '\s+')[-1]
    if ($procId -match '^\d+$') {
        Write-Host "Port $port band (PID $procId). Eski jarayon to'xtatilmoqda..." -ForegroundColor Yellow
        Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

$go = Get-Command go -ErrorAction SilentlyContinue
if (-not $go) {
    $fallback = "C:\Program Files\Go\bin\go.exe"
    if (Test-Path $fallback) {
        $go = $fallback
    } else {
        Write-Host "Go topilmadi. https://go.dev/dl/ dan o'rnating." -ForegroundColor Red
        exit 1
    }
} else {
    $go = $go.Source
}

Write-Host "Go backend ishga tushmoqda: http://localhost:$port/api" -ForegroundColor Green
& $go run ./cmd/api
