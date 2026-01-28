
# Slink

**URL Shortening Platform**

*Technical Specification Document*


---

## Executive Summary

Slink is a modern, self-hosted URL shortening platform built with Laravel and PostgreSQL, containerised using Docker. The application provides a clean, beautiful interface for creating, managing, and tracking shortened URLs with comprehensive analytics.

The name Slink combines the concepts of shortening and linking while evoking speed and elegance. Alternative names considered include Brevio (from brevity), Linc, and Zipwarp.

---

## Technology Stack

### Backend

| Component | Technology |
|-----------|------------|
| Framework | Laravel 12.x (PHP 8.4+) |
| Database | PostgreSQL 18 |
| Cache | Redis 8.x |
| Queue | Laravel Horizon with Redis |
| Web Server | Nginx (latest alpine) with PHP-FPM |
| Scheduler | Laravel Task Scheduling (cron) |

### Frontend

| Component | Technology |
|-----------|------------|
| JavaScript Framework | Aurelia 2 |
| CSS Framework | Tailwind CSS 4.x |
| Build Tool | Vite 6.x |
| Icons | Heroicons / Lucide |
| Charts | Chart.js 4.x or ApexCharts |

### Infrastructure

| Component | Technology |
|-----------|------------|
| Containerisation | Docker with Docker Compose |
| Reverse Proxy | Traefik (latest) or Nginx |
| SSL | Let's Encrypt (via Traefik/Certbot) |

---

## Core Features

### URL Management

- Create shortened URLs with auto-generated or custom slugs
- Bulk URL shortening via CSV import
- QR code generation for each shortened URL
- Link expiration dates and click limits
- Password-protected links
- Link grouping and tagging for organisation

### Analytics Dashboard

- Real-time click tracking
- Geographic breakdown by country and city
- Device and browser statistics
- Referrer tracking
- Time-based analytics with customisable date ranges
- CSV/PDF export of analytics data

### User Management

- User registration and authentication (Laravel Breeze/Fortify)
- Two-factor authentication (2FA)
- API key management for programmatic access
- Role-based permissions (admin, user, guest)

### Additional Features

- RESTful API with rate limiting
- Webhook notifications for link events
- Custom domain support
- Link health monitoring (detect broken destinations)
- Bot and crawler filtering

---

## Database Schema

The following tables represent the core database structure. All tables include standard Laravel timestamps (created_at, updated_at) and use UUIDs as primary keys for security.

### users

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | varchar(255) | Display name |
| email | varchar(255) | Unique email address |
| password | varchar(255) | Hashed password |
| role | enum | admin, user, guest |
| two_factor_secret | text | Encrypted 2FA secret |
| email_verified_at | timestamp | Email verification timestamp |

### links

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users |
| original_url | text | The destination URL |
| slug | varchar(32) | Unique short code |
| title | varchar(255) | Optional link title |
| password | varchar(255) | Optional hashed password |
| expires_at | timestamp | Optional expiration date |
| max_clicks | integer | Optional click limit |
| is_active | boolean | Link enabled/disabled |

### clicks

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| link_id | uuid | Foreign key to links |
| ip_address | inet | Visitor IP (hashed for privacy) |
| user_agent | text | Browser user agent string |
| referer | text | HTTP referer header |
| country | varchar(2) | ISO country code |
| city | varchar(255) | City name |
| device_type | varchar(32) | desktop, mobile, tablet |
| browser | varchar(64) | Parsed browser name |
| os | varchar(64) | Operating system |
| is_bot | boolean | Bot/crawler detection flag |

### tags

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users |
| name | varchar(64) | Tag name |
| color | varchar(7) | Hex colour code |

### link_tag (pivot)

| Column | Type | Description |
|--------|------|-------------|
| link_id | uuid | Foreign key to links |
| tag_id | uuid | Foreign key to tags |

### api_tokens

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | Foreign key to users |
| name | varchar(255) | Token name/description |
| token | varchar(64) | Hashed API token |
| abilities | json | Permission scopes |
| last_used_at | timestamp | Last API call timestamp |
| expires_at | timestamp | Optional expiration |

---

## API Endpoints

All API endpoints are prefixed with `/api/v1` and require authentication via Bearer token except where noted.

### Links

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /links | List all links (paginated) |
| POST | /links | Create a new short link |
| GET | /links/{id} | Get link details |
| PATCH | /links/{id} | Update link properties |
| DELETE | /links/{id} | Delete a link |
| GET | /links/{id}/stats | Get link analytics |
| POST | /links/bulk | Create multiple links |

### Tags

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /tags | List all tags |
| POST | /tags | Create a new tag |
| DELETE | /tags/{id} | Delete a tag |

### User

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /user | Get current user profile |
| GET | /user/stats | Get account statistics |
| POST | /user/tokens | Create new API token |
| DELETE | /user/tokens/{id} | Revoke API token |

### Public (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /{slug} | Redirect to original URL |
| POST | /{slug}/verify | Verify password for protected link |

---

## Docker Configuration

The application runs as a multi-container Docker setup managed by Docker Compose. The following services are included:

### Services

| Service | Image | Purpose |
|---------|-------|---------|
| app | Custom (PHP 8.4-FPM) | Laravel application |
| nginx | nginx:alpine | Web server and static files |
| postgres | postgres:18-alpine | Primary database |
| redis | redis:8-alpine | Cache and queue backend |
| horizon | Custom (same as app) | Queue worker management |
| scheduler | Custom (same as app) | Cron job runner |

### Volumes

- **postgres_data**: Persistent database storage
- **redis_data**: Persistent cache/queue storage
- **app_storage**: Laravel storage directory

### Environment Variables

Key environment variables are managed via a `.env` file (not committed to version control). Critical variables include:

| Variable | Description |
|----------|-------------|
| APP_KEY | Laravel encryption key (generated) |
| APP_URL | Base URL for the application |
| DB_CONNECTION | Set to `pgsql` |
| DB_HOST | PostgreSQL container hostname |
| DB_PASSWORD | Database password |
| REDIS_HOST | Redis container hostname |
| QUEUE_CONNECTION | Set to `redis` |
| SESSION_DRIVER | Set to `redis` |

---

## UI/UX Design Guidelines

Slink prioritises a clean, modern aesthetic with excellent usability. The design philosophy centres on minimalism with purposeful colour accents.

### Colour Palette

| Name | Hex | Usage |
|------|-----|-------|
| Deep Navy | #1a1a2e | Primary backgrounds, headers |
| Royal Blue | #16213e | Secondary backgrounds |
| Ocean Blue | #0f3460 | Accent elements |
| Electric Pink | #e94560 | CTAs, highlights, alerts |
| Soft White | #f8f9fa | Text on dark, light backgrounds |
| Success Green | #10b981 | Success states, active links |
| Warning Amber | #f59e0b | Warnings, expiring links |

### Typography

- **Primary font**: Inter (clean, highly readable sans-serif)
- **Monospace font**: JetBrains Mono (for URLs and codes)
- Font sizes following Tailwind defaults with 1.5 line height

### Key Interface Elements

- **Dashboard**: Card-based layout with key metrics at top, recent links below
- **Link creation**: Prominent input field with instant preview of shortened URL
- **Analytics**: Interactive charts with hover states, filterable date ranges
- **Mobile responsive**: Collapsible sidebar, touch-friendly buttons
- **Dark mode**: Default theme with optional light mode toggle
- **Microinteractions**: Subtle animations on copy, create, and delete actions

---

## Aurelia 2 Frontend Architecture

The frontend uses Aurelia 2, a modern JavaScript framework with excellent TypeScript support and a clean component model.

### Key Packages

```json
{
  "dependencies": {
    "aurelia": "^2.0.0",
    "@aurelia/router": "^2.0.0",
    "@aurelia/fetch-client": "^2.0.0",
    "@aurelia/store-v1": "^2.0.0"
  }
}
```

### Component Structure

```
src/
├── main.ts
├── my-app.ts
├── resources/
│   ├── elements/
│   │   ├── link-card.ts
│   │   ├── analytics-chart.ts
│   │   ├── url-input.ts
│   │   └── tag-badge.ts
│   ├── value-converters/
│   │   ├── date-format.ts
│   │   └── truncate.ts
│   └── binding-behaviors/
├── pages/
│   ├── dashboard/
│   ├── links/
│   ├── analytics/
│   └── settings/
├── services/
│   ├── api.ts
│   ├── auth.ts
│   └── notification.ts
└── store/
    ├── state.ts
    └── actions.ts
```

### API Integration

Using Aurelia's fetch client with interceptors for authentication:

```typescript
import { IHttpClient } from '@aurelia/fetch-client';

export class ApiService {
  constructor(@IHttpClient private http: IHttpClient) {
    this.http.configure(config => {
      config
        .withBaseUrl('/api/v1')
        .withInterceptor({
          request(request) {
            request.headers.set('Authorization', `Bearer ${token}`);
            return request;
          }
        });
    });
  }
}
```

---

## Project Structure

The application follows standard Laravel conventions with some additional organisation for clarity.

```
slink/
├── app/
│   ├── Http/Controllers/
│   ├── Models/
│   ├── Services/
│   └── Jobs/
├── database/
│   ├── migrations/
│   └── seeders/
├── resources/
│   ├── views/
│   ├── css/
│   └── js/              # Aurelia 2 app lives here
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
├── routes/
├── tests/
├── docker/
│   ├── nginx/
│   └── php/
├── docker-compose.yml
└── Dockerfile
```

---

## Development Phases

### Phase 1: Foundation (Weeks 1-2)

1. Docker environment setup with all services
2. Laravel installation and configuration
3. Database migrations and models
4. Authentication scaffolding
5. Aurelia 2 project setup with Vite

### Phase 2: Core Features (Weeks 3-4)

1. Link creation and redirection logic
2. Click tracking and analytics collection
3. Basic dashboard and link management UI
4. API endpoint implementation

### Phase 3: Polish and Advanced Features (Weeks 5-6)

1. Analytics dashboard with charts
2. QR code generation
3. Bulk operations and CSV import
4. UI refinement and responsive design

### Phase 4: Testing and Deployment (Weeks 7-8)

1. Comprehensive test suite (unit, feature, browser)
2. Performance optimisation and caching
3. Security audit and hardening
4. Documentation and deployment guide

---

## Recommended Laravel Packages

| Package | Purpose |
|---------|---------|
| laravel/horizon | Queue monitoring dashboard |
| laravel/sanctum | API token authentication |
| spatie/laravel-permission | Role and permission management |
| simplesoftwareio/simple-qrcode | QR code generation |
| jenssegers/agent | User agent parsing |
| stevebauman/location | IP geolocation |
| league/csv | CSV import/export |
| barryvdh/laravel-dompdf | PDF generation |

---

## Security Considerations

- All passwords hashed using bcrypt (Laravel default)
- API tokens hashed before storage
- Rate limiting on all public endpoints
- CSRF protection on web routes
- XSS protection via Blade escaping
- SQL injection protection via Eloquent ORM
- IP addresses hashed for GDPR compliance
- Content Security Policy headers
- HTTPS enforced in production

---

## Performance Optimisations

- Redis caching for frequently accessed data
- Database indexing on slug, user_id, and created_at columns
- Queue-based click processing to avoid blocking redirects
- Eager loading to prevent N+1 queries
- CDN for static assets
- Gzip compression via Nginx
- OPcache enabled for PHP
- Connection pooling for PostgreSQL

---

*End of Document*