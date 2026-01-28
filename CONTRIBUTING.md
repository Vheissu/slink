# Contributing to Slink

Thanks for taking the time to contribute!

## Quick start

1) Fork and clone the repo.
2) Create a feature branch.
3) Follow the setup steps in `README.md`.

## Development workflow

- Use Docker for local development when possible.
- Keep changes focused and scoped to one purpose.
- Prefer small, reviewable commits.

### Common commands

```bash
docker compose up --build

docker compose exec -T app php artisan migrate

docker compose exec -T app php artisan db:seed

npm install
npm run dev
npm run build
```

## Coding guidelines

- **PHP/Laravel:** Follow Laravel conventions and keep controllers thin.
- **Aurelia:** File names must match component class names and templates.
- **Decorators:** Use TC39 decorators (`@bindable`), avoid legacy experimental decorators.
- **API:** All new endpoints must be under `/api/v1` and use Bearer token auth.
- **Styling:** Use the existing Tailwind + CSS component classes; avoid inline styles.

## Testing

If you add or change backend logic, run:

```bash
php artisan test
```

If your change affects the frontend, run:

```bash
npm run build
```

## Submitting a PR

- Explain the problem and the solution.
- Include screenshots or recordings for UI changes.
- Note any migrations or new environment variables.

## Reporting issues

Please include:

- Steps to reproduce
- Expected vs actual behavior
- Logs or console errors
- Environment details (OS, Docker version, browser)
