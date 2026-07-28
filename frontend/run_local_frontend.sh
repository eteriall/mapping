#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f package.json ]; then
  echo "package.json not found in frontend/. Initialize the Next.js app first." >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

: "${FRONTEND_PORT:?FRONTEND_PORT must be set}"
: "${BACKEND_PORT:?BACKEND_PORT must be set}"

export BACKEND_ORIGIN="http://127.0.0.1:${BACKEND_PORT}"

npm run dev -- --hostname 0.0.0.0 --port "${FRONTEND_PORT}"
