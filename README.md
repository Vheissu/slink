# Slink

Slink is a self-hosted URL shortener built with Laravel 12, PostgreSQL, Redis, and Aurelia 2. It creates short links, groups them with tags, and records enough click data to show what is being used.

## Features

- Shorten URLs with auto-generated slugs
- Link titles and tagging
- Link notes, expiration, and click limits
- Optional password protection on links
- Bulk CSV import (via API + UI upload)
- Bulk actions (activate/deactivate/delete/tag) and CSV export
- Click tracking with basic analytics (device, browser, referrer, country)
- Analytics time ranges, trend chart, exports, and bot filtering
- Queue health indicator and link health checks
- API-first design with Bearer token authentication
- Token scopes (abilities) and audit logging
- Responsive workspace for desktop and mobile

Planned/extended features live in `technical-spec.md`.

## Tech stack

- **Backend:** Laravel 12 (PHP 8.4+)
- **Database:** PostgreSQL 18
- **Cache/Queue:** Redis 8 + Horizon
- **Frontend:** Aurelia 2 + Tailwind CSS 4 + Vite
- **Web server:** Nginx (Docker)

## Quick start (Docker)

```bash
cp .env.example .env

docker compose up --build
```

Open the app at: `http://localhost:8080`

### Seed demo data + API token

```bash
docker compose exec -T app php artisan db:seed
```

If `SLINK_SEED_TOKEN` is set in `.env`, that token will be used. Otherwise the seeder prints a generated token once. Paste it in the app via **Settings → Bearer token** to authorize the UI.

### Run migrations (if needed)

```bash
docker compose exec -T app php artisan migrate
```

## API overview

All API routes are prefixed with `/api/v1` and require a Bearer token unless noted. Link destinations must use HTTP or HTTPS.

- `GET /api/v1/links`: List links
- `POST /api/v1/links`: Create link (slug is auto-generated)
- `POST /api/v1/links/bulk`: Bulk create links
- `POST /api/v1/links/actions`: Bulk actions (activate/deactivate/delete/tag/untag)
- `GET /api/v1/analytics?query=&from=&to=&include_bots=1`: Analytics with filters and time range
- `GET /api/v1/links/{id}/stats`: Link analytics
- `GET /api/v1/audit-logs`: Recent audit activity
- `GET /api/v1/user/stats`: Account stats
- `POST /api/v1/user/tokens`: Create API token
- `DELETE /api/v1/user/tokens/{id}`: Revoke API token
- `GET /{slug}`: Redirect (public)
- `POST /{slug}/verify`: Verify password-protected link (public)

## CSV import format

CSV headers are optional. Supported columns:

- `original_url` (or `url` / `link`): required
- `title`: optional
- `expires_at`: optional
- `max_clicks`: optional

Example:

```csv
original_url,title
https://youtube.com,YouTube
https://news.ycombinator.com,Hacker News
```

## Analytics query operators

Use the analytics filter input with operators:

- `url:` or `link:` or `original_url:`
- `slug:`
- `title:`
- `contains:`

Examples:

- `url:youtube`
- `title:"creator tools"`
- `contains:news slug:hn`

## API token abilities

Tokens can optionally declare abilities (scopes). If omitted, tokens default to full access (`*`).

Available abilities:

- `links:read`, `links:write`
- `tags:read`, `tags:write`
- `analytics:read`
- `user:read`
- `tokens:write`
- `health:read`
- `audit:read`

## Local development (non-Docker)

Docker is the recommended setup. If you prefer local services, you will need:

- PHP 8.4+
- Node.js 20+
- PostgreSQL 18
- Redis 8

High-level steps:

```bash
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
npm install
npm run dev
```

Serve the backend via your preferred web server or `php artisan serve`. Ensure `APP_URL` matches your local URL and that Postgres/Redis connection settings are correct.

## Troubleshooting

- **401 Unauthorized in UI:** Paste a valid token in Settings.
- **Refreshing SPA routes yields 404:** Routes are mapped in `routes/web.php`. If you add new SPA paths, update the route list.
- **CSV import errors:** Ensure each row has a valid URL in the first column or `original_url` header.

## Project structure

- `app/`: Laravel backend
- `routes/`: API and web routing
- `resources/js/src/`: Aurelia 2 SPA
- `resources/css/`: Tailwind CSS
- `docker/`: Nginx and container config

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
composer test
vendor/bin/pint --test
npm audit
composer audit
```

## Health checks

Run on-demand link health checks:

```bash
php artisan links:check-health
```

By default it checks active links that have not been checked in the last 24 hours. Use `--all` to force a full sweep.

## Queue health

The UI shows queue status via:

```
GET /api/v1/health/queue
```

## Contributing

Please see `CONTRIBUTING.md` for guidelines on local setup, conventions, and PRs.

## License

MIT
