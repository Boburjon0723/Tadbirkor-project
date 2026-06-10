#!/usr/bin/env bash
# Go backend ishga tushirish (port 4003)
# Ishlatish: ./start.sh   yoki   bash start.sh

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env
    echo ".env yaratildi (.env.example dan). DATABASE_URL va JWT_SECRET ni tekshiring."
  else
    echo ".env topilmadi." >&2
    exit 1
  fi
fi

PORT=4003
if command -v netstat >/dev/null 2>&1; then
  PID=$(netstat -ano 2>/dev/null | grep ":${PORT}.*LISTENING" | awk '{print $NF}' | head -1 || true)
  if [[ -n "${PID:-}" && "$PID" =~ ^[0-9]+$ ]]; then
    echo "Port $PORT band (PID $PID). Eski jarayon to'xtatilmoqda..."
    taskkill //F //PID "$PID" 2>/dev/null || kill -9 "$PID" 2>/dev/null || true
    sleep 1
  fi
fi

GO_BIN="${GO_BIN:-go}"
if ! command -v "$GO_BIN" >/dev/null 2>&1; then
  if [[ -x "/c/Program Files/Go/bin/go.exe" ]]; then
    GO_BIN="/c/Program Files/Go/bin/go.exe"
  else
    echo "Go topilmadi. https://go.dev/dl/ dan o'rnating." >&2
    exit 1
  fi
fi

echo "Go backend ishga tushmoqda: http://localhost:${PORT}/api"
exec "$GO_BIN" run ./cmd/api
