#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  YM -> SoundCloud Transfer Service (Zero-Login)"
echo "=========================================================="

if [ ! -d ".venv" ]; then
    echo "Creating Python virtual environment (.venv)..."
    python3 -m venv .venv
    echo "Installing dependencies..."
    ./.venv/bin/pip install -r requirements.txt
fi

echo "Starting server on http://127.0.0.1:8000..."
# Open browser on macOS
if command -v open >/dev/null 2>&1; then
    (sleep 1.5 && open http://127.0.0.1:8000) &
fi

exec ./.venv/bin/python3 -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
