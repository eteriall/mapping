#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/server"

pip install -r "$SCRIPT_DIR/requirements.txt"

cd "$PROJECT_DIR"

: "${BACKEND_PORT:?BACKEND_PORT must be set}"

python manage.py migrate
python manage.py seed_studio
python manage.py collectstatic --noinput
gunicorn server.wsgi:application --reload --bind 0.0.0.0:${BACKEND_PORT}
