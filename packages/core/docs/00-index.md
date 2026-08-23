# chavaJs Documentation

Welcome to the chavaJs documentation. chavaJs is a TypeScript web framework
with a Laravel-inspired architecture running on Node.js: service providers,
a dependency-injection container, an Eloquent-style ORM, migrations, seeders,
middleware, session authentication, queues, scheduling, notifications, and an
Inertia + React front end.

The docs are served from your application at `/docs`. Each page is a plain
Markdown file in your project's `docs/` directory — edit one and refresh to
see your changes.

> These pages mirror Laravel's official documentation, adapted to the exact
> APIs and conventions chavaJs exposes. If you know Laravel, almost everything
> here will feel familiar.

## The complete guide

- **Getting started** — [Installation](01-installation), [Configuration](02-configuration), [Architecture](03-architecture)
- **HTTP layer** — [Routing](04-routing), [Controllers](05-controllers), [Requests](06-requests), [Validation](07-validation), [Middleware](08-middleware)
- **Database & ORM** — [Database](09-database), [Migrations](10-migrations), [Eloquent ORM](11-eloquent), [Seeding](12-seeding)
- **Security & identity** — [Authentication](13-auth), [Sessions & CSRF](14-sessions), [Security](26-security), [CORS](29-cors), [Admin Dashboard](30-admin-dashboard), [Permissions & Roles](31-permissions)
- **Background work** — [Events](15-events), [Queues](16-queues), [Mail & Notifications](17-mail-notifications), [Scheduling](18-scheduling)
- **Front end & tooling** — [Frontend](19-frontend), [Console](20-console), [Testing](21-testing), [Deployment](22-deployment)
- **Framework reference** — [Service Container](23-container), [Support Utilities](24-support), [Facades](25-facades), [Security](26-security), [File Storage](27-filesystem), [Localization](28-localization)

## Quick start

```bash
npm install -g @chavajs/cli
chava new my-app
cd my-app
npm install
npm run dev
```

Then open `http://localhost:8080` for the app and `http://localhost:8080/docs`
for this documentation. The `js` command is the artisan equivalent:

```bash
js migrate
js db:seed
js route:list
js tinker
```