#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

usage() {
  cat <<'EOF'
Usage: ./run_local.sh [--<service>-port PORT ...]

Examples:
  ./run_local.sh --frontend-port 3002 --backend-port 8002
  ./run_local.sh --postgres-port 5434

Any --<service>-port option overrides the matching uppercase environment
variable after .env is loaded, for example --frontend-port overrides
FRONTEND_PORT. If --postgres-port is passed without --db-port, DB_PORT
is set to the same value for local backend connections.
EOF
}

PORT_OVERRIDES=()
POSTGRES_PORT_OVERRIDDEN=0
DB_PORT_OVERRIDDEN=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --*-port)
      if [ "$#" -lt 2 ]; then
        echo "$1 requires a value" >&2
        exit 1
      fi
      option_name="${1#--}"
      env_name="$(printf '%s' "$option_name" | tr '[:lower:]-' '[:upper:]_')"
      PORT_OVERRIDES+=("${env_name}=$2")
      if [ "$env_name" = "POSTGRES_PORT" ]; then
        POSTGRES_PORT_OVERRIDDEN=1
      fi
      if [ "$env_name" = "DB_PORT" ]; then
        DB_PORT_OVERRIDDEN=1
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ ! -f .env ]; then
  echo ".env not found. Create it from .env.example first." >&2
  exit 1
fi

set -a
source .env
set +a

for override in "${PORT_OVERRIDES[@]}"; do
  export "$override"
done

if [ "$POSTGRES_PORT_OVERRIDDEN" -eq 1 ] && [ "$DB_PORT_OVERRIDDEN" -eq 0 ]; then
  export DB_PORT="$POSTGRES_PORT"
fi

: "${POSTGRES_DB:?POSTGRES_DB must be set}"
: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
: "${POSTGRES_PORT:?POSTGRES_PORT must be set}"
: "${BACKEND_PORT:?BACKEND_PORT must be set}"
: "${FRONTEND_PORT:?FRONTEND_PORT must be set}"
: "${DB_NAME:?DB_NAME must be set}"
: "${DB_USER:?DB_USER must be set}"
: "${DB_PASSWORD:?DB_PASSWORD must be set}"
: "${DB_HOST:?DB_HOST must be set}"
: "${DB_PORT:?DB_PORT must be set}"

if lsof -tiTCP:"${BACKEND_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  lsof -tiTCP:"${BACKEND_PORT}" -sTCP:LISTEN | xargs kill -9
fi

docker compose -f docker-compose.yml -f docker-compose.local.yml up -d mapping-postgres

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

./backend/run_local_backend.sh &
BACKEND_PID=$!

./frontend/run_local_frontend.sh &
FRONTEND_PID=$!

wait "$BACKEND_PID" "$FRONTEND_PID"
