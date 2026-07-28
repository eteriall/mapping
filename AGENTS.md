# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Django service container and local scripts.
- `backend/server/`: Django project root (`manage.py`, `server/settings.py`, `server/urls.py`).
- `frontend/`: React/Vite + Nginx container assets (`Dockerfile`, `nginx.conf`, local run script).
- `docker-compose.yml`: Local multi-service stack (`mapping-backend`, `mapping-frontend`, `mapping-postgres`).
- `.env.example`: Required environment variables template for local and Docker runs.
- `venv/`: Local Python virtual environment (do not commit generated changes).

## Build, Test, and Development Commands
- `cp .env.example .env`: Create local environment file before running services.
- `docker compose up --build`: Build and start backend, frontend, and Postgres together.
- `docker compose down -v`: Stop stack and remove volumes.
- `./backend/run_local_backend.sh`: Run Django locally (requires `BACKEND_PORT` and DB env vars).
- `./frontend/run_local_frontend.sh`: Run Vite dev server locally (requires `FRONTEND_PORT`).
- Backend dependency install (local): `pip install -r backend/requirements.txt`.
- Lint Python: `ruff check backend`.
- Format Python: `ruff format backend`.

## Coding Style & Naming Conventions
- Python: use Ruff for linting and formatting, always format code to PEP 8, use 4-space indentation, `snake_case` for functions/variables, and `PascalCase` for classes.
- Every function must have a docstring with one sentence describing what it does.
- Docstrings should describe behavior only; do not document arguments in docstrings.
- Shell scripts: `set -euo pipefail`; keep scripts idempotent and explicit about required env vars.
- Config files: prefer explicit values over hidden defaults; keep service names aligned with compose (`mapping-*`).
- Avoid fallback behavior. Prefer hard failures with clear errors over silent defaults.
- Keep Django settings environment-driven for portability across local and container environments.
- Keep code straightforward: do not introduce many helper functions.
- If logic is used only once inside another function, keep it inline unless the user asks to extract it.
- When registering Django models in admin, always use Unfold admin model classes.

## Testing Guidelines
- Always add or update tests for every code change.
- Always run tests locally before considering work complete.
- Always run Ruff checks before considering work complete.
- NEVER write Django migration files manually.
- ALWAYS generate migrations using `python backend/server/manage.py makemigrations`.
- For backend additions, use Django `TestCase` under `backend/server/<app>/tests.py` or `tests/` packages.
- Name tests by behavior (example: `test_login_rejects_invalid_password`).
- Run backend tests with `python backend/server/manage.py test` once tests are added.

## Commit & Pull Request Guidelines
- Current history is minimal (`Initial commit`); use short, imperative commit subjects (example: `Add Postgres env validation`).
- Keep commits scoped to one concern (infra, backend feature, frontend feature).
- PRs should include:
  - What changed and why.
  - Any env/config updates (`.env.example`, ports, service names).
  - Verification steps and command output summary.
  - Screenshots for UI-visible frontend changes.

## Security & Configuration Tips
- Never commit `.env` or secrets.
- Rotate `DJANGO_SECRET_KEY` outside development.
- Restrict `DJANGO_ALLOWED_HOSTS` to trusted hosts per environment.
- If a required command or tool is blocked by restricted network access, ask the user for permission before proceeding.
