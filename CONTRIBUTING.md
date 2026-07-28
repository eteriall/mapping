# Contributing

Thanks for helping improve Mapping.

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Use an issue to discuss large features or architectural changes first.
- Never include credentials, private media, or personal data in an issue,
  commit, fixture, or screenshot.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Follow the local development instructions in [README.md](README.md). Copy
`.env.example` to `.env`; do not commit `.env`.

## Making changes

- Keep each change focused on one concern.
- Add or update tests for every code change.
- Give every Python function a one-sentence behavior docstring.
- Use Unfold model admin classes when registering Django models.
- Do not write Django migrations by hand. Generate them with:

  ```bash
  python backend/server/manage.py makemigrations
  ```

- Avoid silent fallback behavior; fail with a clear error when required
  configuration is missing.

## Verification

Before submitting a pull request, run:

```bash
ruff check backend
ruff format --check backend
python backend/server/manage.py test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
```

Include the commands you ran and their results in the pull request. For
visible UI changes, include before-and-after screenshots.

## Pull requests

A useful pull request explains:

- What changed and why
- Related issues
- Environment or configuration changes
- Verification performed
- User-visible effects and screenshots, when applicable

By contributing, you agree that your contributions will be distributed under
the project's [MIT License](LICENSE).
