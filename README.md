# chavaJs

**The Laravel framework for Node.js.**

chavaJs is a full-stack web framework in pure TypeScript that replicates
Laravel's architecture, conventions, ergonomics, and developer experience —
no PHP anywhere.

> **Port the concepts, not the syntax.** Where Laravel uses PHP magic
> (macros, magic methods, static facades), chavaJs replicates the
> developer-facing behavior with idiomatic JavaScript: Proxies, ES modules,
> and a dependency-injection container.

## Table of contents

- [Requirements](#requirements)
- [Stack](#stack)
- [What works right now](#what-works-right-now)
- [Installation & first app](#installation--first-app)
  - [Install the CLI](#install-the-installer)
  - [Create an app (`chava new`)](#create-an-app-chava-new)
  - [What `chava new` produces](#what-chava-new-produces)
  - [Run it](#run-it)
  - [Configuration: `.env` reference](#env-reference)
  - [Configuration: `config/*.ts` reference](#configts-reference)
  - [Developing the framework itself](#getting-started-developing-the-framework-itself)
- [HTTP layer](#http-layer)
  - [Request lifecycle & `bootstrap/app.ts`](#request-lifecycle--bootstrappts)
  - [Routing](#routing)
  - [Controllers](#controllers)
  - [Middleware](#middleware)
  - [The Request object](#the-request-object)
  - [The Response object](#the-response-object)
  - [Validation](#validation)
  - [Sessions & CSRF](#sessions--csrf)
- [Database & ORM](#database--orm)
  - [Connections](#connections)
  - [Migrations & the Blueprint](#migrations--the-blueprint)
  - [Models](#models)
  - [The query builder](#the-query-builder)
  - [Relationships](#relationships)
  - [Factories & seeders](#factories--seeders)
- [Auth & authorization](#auth--authorization)
  - [Guards & configuration](#guards--configuration)
  - [The `Auth` facade](#the-auth-facade)
  - [Password hashing](#password-hashing)
  - [Gates & policies](#gates--policies)
  - [Auth middleware & email verification](#auth-middleware--email-verification)
  - [Auth, end to end](#auth-end-to-end)
- [Services & background work](#services--background-work)
  - [The service container](#the-service-container)
  - [Facades](#facades)
  - [Events & listeners](#events--listeners)
  - [Queues](#queues)
  - [Mail](#mail)
  - [Notifications](#notifications)
  - [Scheduling](#scheduling)
  - [Events, queues, mail & notifications, end to end](#events-queues-mail--notifications-end-to-end)
- [Frontend (Inertia + React)](#frontend-inertia--react)
  - [The Inertia server adapter](#the-inertia-server-adapter)
  - [The React app](#the-react-app)
  - [shadcn/ui, Tailwind & Motion](#shadcnui-tailwind--motion)
  - [Vite dev & production](#vite-dev--production)
- [CLI reference](#cli-reference)
  - [Every command & flag](#every-command--flag)
  - [Tinker, end to end](#tinker-end-to-end)
- [Testing](#testing)
  - [Unit & feature tests](#unit--feature-tests)
  - [Database testing](#database-testing)
  - [Browser tests (Playwright)](#browser-tests-playwright)
  - [CI](#ci)
- [Deployment & production](#deployment--production)
  - [Production build](#production-build)
  - [Process management](#process-management)
  - [Background workers](#background-workers)
  - [Reverse proxy & production notes](#reverse-proxy--production-notes)
- [Laravel → chavaJs cheat-sheet](#laravel--chavajs-cheat-sheet)
- [License](#license)

## Documentation

The complete framework documentation ships inside every app and is served at
`/docs` (opt-in during `chava new`). All 29 pages are also on GitHub:

**Getting started**

| # | Page | |
|---|------|--|
| 00 | Index & learning path | [00-index.md](packages/core/docs/00-index.md) |
| 01 | Installation | [01-installation.md](packages/core/docs/01-installation.md) |
| 02 | Configuration | [02-configuration.md](packages/core/docs/02-configuration.md) |
| 03 | Architecture | [03-architecture.md](packages/core/docs/03-architecture.md) |

**HTTP layer**

| # | Page | |
|---|------|--|
| 04 | Routing | [04-routing.md](packages/core/docs/04-routing.md) |
| 05 | Controllers | [05-controllers.md](packages/core/docs/05-controllers.md) |
| 06 | Requests | [06-requests.md](packages/core/docs/06-requests.md) |
| 07 | Validation | [07-validation.md](packages/core/docs/07-validation.md) |
| 08 | Middleware | [08-middleware.md](packages/core/docs/08-middleware.md) |

**Database & ORM**

| # | Page | |
|---|------|--|
| 09 | Database | [09-database.md](packages/core/docs/09-database.md) |
| 10 | Migrations | [10-migrations.md](packages/core/docs/10-migrations.md) |
| 11 | Eloquent ORM | [11-eloquent.md](packages/core/docs/11-eloquent.md) |
| 12 | Seeding | [12-seeding.md](packages/core/docs/12-seeding.md) |

**Security & identity**

| # | Page | |
|---|------|--|
| 13 | Authentication | [13-auth.md](packages/core/docs/13-auth.md) |
| 14 | Sessions & CSRF | [14-sessions.md](packages/core/docs/14-sessions.md) |
| 15 | Events | [15-events.md](packages/core/docs/15-events.md) |
| 16 | Queues | [16-queues.md](packages/core/docs/16-queues.md) |
| 17 | Mail & Notifications | [17-mail-notifications.md](packages/core/docs/17-mail-notifications.md) |
| 18 | Scheduling | [18-scheduling.md](packages/core/docs/18-scheduling.md) |

**Front end & tooling**

| # | Page | |
|---|------|--|
| 19 | Frontend (Inertia + React) | [19-frontend.md](packages/core/docs/19-frontend.md) |
| 20 | Console (`js` CLI) | [20-console.md](packages/core/docs/20-console.md) |
| 21 | Testing | [21-testing.md](packages/core/docs/21-testing.md) |
| 22 | Deployment | [22-deployment.md](packages/core/docs/22-deployment.md) |

**Framework reference**

| # | Page | |
|---|------|--|
| 23 | Service Container | [23-container.md](packages/core/docs/23-container.md) |
| 24 | Support Utilities | [24-support.md](packages/core/docs/24-support.md) |
| 25 | Facades | [25-facades.md](packages/core/docs/25-facades.md) |
| 26 | Security | [26-security.md](packages/core/docs/26-security.md) |
| 27 | File Storage | [27-filesystem.md](packages/core/docs/27-filesystem.md) |
| 28 | Localization | [28-localization.md](packages/core/docs/28-localization.md) |
| 29 | CORS | [29-cors.md](packages/core/docs/29-cors.md) |

## Requirements

- **Node.js ≥ 18.17** (current LTS recommended)
- npm, pnpm or yarn
- For Postgres/MySQL apps: a running database server
- For browser tests: Playwright's Chromium (`npx playwright install chromium`)

## Stack

| Layer    | Technology                                                            |
| -------- | --------------------------------------------------------------------- |
| Runtime  | Node.js + TypeScript (strict)                                         |
| HTTP     | Node `http` with a Laravel-style router/middleware API on top         |
| Frontend | React 18 + **Inertia.js** + Tailwind CSS + **shadcn/ui** + **Motion** |
| Build    | Vite (with a laravel-vite-plugin-equivalent manifest)                 |
| Tests    | Vitest (+ Playwright for browser specs) with coverage reporting       |
| Cache    | Memory / Redis with unified API                                       |
| Logging  | Structured logging (JSON in production, pretty in dev)               |

## What works right now

This repo is the **source repository**: the framework is split into three
packages (`packages/core`, `packages/cli`, `packages/inertia-react`) and
published as three npm packages:

| Package              | Role                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@chavajs/installer` | The Laravel Installer equivalent — `chava new <name>` downloads the framework and scaffolds a ready-to-run app |
| `@chavajs/core`      | The framework distribution (assembled `src/` + `bin/` + the starter `template/`)                               |
| `@chavajs/cli`       | The console CLI (Artisan equivalent), standalone                                                               |

`examples/starter/` is the canonical reference application. Start a new app
with [`chava new`](#create-an-app-chava-new) — a real app has the framework
assembled into its own `src/` + `bin/`, exactly like a scaffolded Laravel app
bundles its framework.

- **Service container** with automatic constructor injection, `bind` /
  `singleton` / `instance` / `alias`, `call()` method injection, and
  `@inject('binding')` decorator for explicit DI
- **Facades** as Proxy singletons: `Route`, `Inertia`, `Config`, `App`, `DB`,
  `Schema`, `Env`, `Auth`, `Hash`, `Gate`, `Session`, `Event`, `Queue`,
  `Mail`, `Notification`, `Schedule`, `Storage`
- **Config system**: `config/*.ts` + `.env` loading, `Config.get('app.name')`
- **Router**: `Route.get()`, `.post()`, `.resource()`, `.group()`, prefixes,
  named routes, optional params, `where()` constraints, route model binding,
  404/405, route caching (`route:cache` / `route:clear`)
- **Middleware pipeline**: `handle(request, next)` with `web` / `api` groups
- **Eloquent-equivalent ORM**: migrations + Blueprint schema builder,
  Active Record `Model` (casts, fillable, timestamps, soft deletes, events),
  relationships with eager loading (`with()` / `load()`), a fluent query
  builder (`where`, `paginate`, `chunk`, …), Faker factories, and seeders
- **Validation**: Laravel-style `Validator.make(data, 'required|email|max:255')`
  with `unique` / `confirmed` / `exists` / `regex` / custom rules, Form
  Request classes, and `request.validate()`
- **Sessions + CSRF**: signed `chava_session` cookies, flash data / `old()`
  input, Laravel-exact CSRF (the `XSRF-TOKEN` cookie Inertia's axios
  client echoes as `X-XSRF-TOKEN`; 419 on mismatch), and **server-side idle
  expiry** — stale payloads are destroyed, not just cookie-expired
- **Auth**: session guards, Sanctum-style personal access tokens
  (`auth:api`), `Hash` (scrypt), gates + policies (`user.can()`), and the
  `auth` / `guest` / `verified` / `can:` middleware
- **Events + listeners**: `Event.dispatch()`, auto-discovered `app/Listeners/*`
  (by `handle(event: X)` type-hint), and **ShouldQueue listeners** — extend
  `ShouldQueue` and the listener runs as a `CallQueuedListener` job
  (`queue:work`), never inside the request
- **Queues**: `Job` classes, `sync` / `database` / `redis` (BullMQ) drivers,
  retries + **per-attempt exponential backoff** (`backoff = [3, 15, 60]`) +
  failed jobs, `chava queue:work`
- **Mail**: `Mailable` classes, `log` / `array` / `smtp` (Nodemailer)
  drivers, Blade-style email templates
- **Notifications**: `Notification` base with `mail` + `database` channels,
  `Notifiable` models, unread/read tracking
- **Scheduling**: fluent `Schedule` facade (`everyMinute`, `dailyAt`,
  `between()`, `cron()`), `chava schedule:run` / `schedule:list`
- **File Storage**: `Storage` facade with local disk driver, configurable
  disks (`config/filesystem.ts`), `get` / `put` / `delete` / `exists` /
  `copy` / `move` / `stat` / `files` / `allFiles` / `url` / `path`
- **Localization**: `__()` / `trans()` translation helpers, JSON-based
  `lang/*.json` files, dot-notated keys, placeholder interpolation,
  fallback locales
- **Security**: parameterized SQL queries, CSRF protection, signed session
  cookies, HttpOnly/Secure/SameSite, request body size limits (413),
  APP_KEY enforcement in production, mass assignment protection, `npm audit`
  in CI, **rate limiting middleware**, **security headers** (HSTS, CSP,
  X-Frame-Options, X-Content-Type-Options), **global CORS** with origin
  allow-list + preflight handling, **upload hardening** (MIME allow-list,
  size caps, sanitized extensions)
- **Members-only directory**: the public /users listing requires login — nav link hidden for guests, direct hits redirect to /login`n- **Admin dashboard**: full Users CRUD (Laravel resource controller + FormRequest) with a live-search TanStack data table, every verb gated by chava-permissions RBAC **and** a UserPolicy through the Gate
- **Operations**: **graceful shutdown** (SIGTERM drains requests, closes DB
  pools + cache timers, 30s forced-exit guard), consistent machine-readable
  error envelope (`error.code` / `error.details`), `X-Request-ID` correlation
  on every response and error log
- **Inertia server adapter**: `Inertia.render('Home', props)` with the full
  protocol (versioning, partial reloads, shared props incl. `auth.user`)
- **CLI**: `chava serve`, `route:list`, `route:cache`, `route:clear`,
  `migrate`, `migrate:rollback`, `migrate:fresh`, `migrate:status`, `db:seed`,
  `queue:work`, `queue:listen`, `schedule:run`, `schedule:list`, `tinker`,
  `make:model`, `make:migration`, `make:factory`, `make:seeder`, `make:request`,
  `make:policy`, `make:event`, `make:listener`, `make:job`,
  `make:notification`, `make:mail`, `make:controller` (`--resource`,
  `--api`, `--invokable`), `make:middleware`, `make:test`
- **Single-action controllers**: `Route.get('/x', MyController)` resolves
  the class and calls `__invoke()`
- **Frontend**: Inertia React app with shadcn/ui components, Tailwind theming
  (dark mode), Motion page transitions, Login/Register/Dashboard auth UI,
  live `/users` pages fed by the ORM, and a **notification inbox**
  (`/notifications`) with mark-as-read via the Notifiable API + an animated
  unread badge in the nav
- **`chava new <name>`** — the Laravel Installer equivalent: scaffolds
  a ready-to-run app (assembles the framework from `packages/*`, regenerates
  `.env`, pins the package, prompts for database/auth/package-manager)
- **Playwright browser tests** (Dusk-equivalent) against a dedicated test
  database, plus **GitHub Actions CI** (typecheck + audit + tests ×3 engines +
  build + browser + installer boot-check)
- **Production Infrastructure**: Docker development environment, multi-stage
  production Dockerfile, **Kubernetes deployment manifests** with health checks,
  autoscaling, and ingress configuration
- **Observability**: **structured logging** (JSON in production, pretty in dev),
  **health check endpoints** (`/health`, `/health/ready`, `/health/info`),
  comprehensive error handling with request context
- **Caching**: unified cache API with **Memory** and **Redis** drivers,
  `remember()` helper, atomic increment/decrement operations
- **Developer Tools**: VSCode debug configurations, Docker Compose for databases,
  test coverage reporting with thresholds, strict TypeScript configuration

---

## Installation & first app

### Install the installer

```bash
npm i -g @chavajs/installer
```

`@chavajs/installer` is the Laravel Installer equivalent: it scaffolds a
brand-new app (`chava new`) by downloading the framework distribution
(`@chavajs/core`) from the npm registry. Every app it scaffolds also carries
the console CLI as `bin/chava.js` (migrations, generators, the dev server,
queue workers, and so on).

Verify the install:

```bash
chava --version   # 0.1.0 (the installer's version)
```

### Create an app (`chava new`)

```bash
chava new blog
cd blog
```

`chava new` prompts for:

1. **Database engine** — `sqlite` (default), `postgres`, or `mysql`
2. **Auth UI** — whether to scaffold the Inertia login/register pages
3. **Framework docs** — whether to include the documentation, served at `localhost/docs`
4. **Package manager** — npm, pnpm, or yarn

Then it installs dependencies and assembles the framework into the new app's
`src/` + `bin/`.

Flags:

| Flag                     | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `--database=postgres`    | Skip the prompt; pick the DB engine (`sqlite`, `postgres`, `mysql`) |
| `--auth` / `--no-auth`   | Skip the prompt; scaffold (or omit) the auth UI                     |
| `--docs` / `--no-docs`   | Skip the prompt; include (or omit) the framework docs at `/docs`    |
| `--package-manager=pnpm` | Skip the prompt; pick the package manager                           |
| `--skip-install`         | Scaffold files only, don't run the package manager                  |

Running the installer from a checkout of this repo (no global install):

```bash
node packages/installer/bin/chava.js new blog
```

### What `chava new` produces

```
blog/
├── bin/
│   └── chava.js              # the chava CLI, bundled into your app
├── src/                      # the *assembled* framework (from packages/*)
│   ├── foundation/           #   Application, container, request context
│   ├── http/                 #   router, middleware, request, response
│   ├── orm/                  #   Model, Factory, relations
│   ├── database/             #   query builder, schema, migrations, seeders
│   ├── auth/                 #   guards, gate, hash, policies
│   ├── validation/           #   Validator + FormRequest
│   ├── session/  queue/  mail/  notifications/  events/  scheduling/
│   ├── inertia/              #   the Inertia server adapter
│   └── facades.ts            #   Route, Inertia, DB, Auth, … singletons
├── bootstrap/
│   └── app.ts                # application configuration (→ bootstrap/app.php)
├── config/
│   ├── app.ts                #   name, env, debug, url, key
│   ├── database.ts           #   sqlite / postgres / mysql connections
│   ├── auth.ts               #   guards, providers, token model
│   ├── session.ts            #   driver, cookie, lifetime
│   ├── queue.ts              #   sync / database / redis connections
│   ├── mail.ts               #   log / array / smtp transports
│   └── frontend.ts           #   Vite URL/port, asset version
├── routes/
│   ├── web.ts                #   web routes (session + CSRF + Inertia group)
│   ├── api.ts                #   API routes (Bearer-token group)
│   └── console.ts            #   scheduled tasks (Schedule.command / job / call)
├── app/
│   ├── Http/Controllers/     #   controllers
│   ├── Http/Requests/        #   FormRequest classes
│   ├── Http/Middleware/      #   custom middleware
│   ├── Models/               #   User, Post, PersonalAccessToken, …
│   ├── Policies/             #   authorization policies
│   ├── Events/               #   event classes (auto-discovered listeners
│   │                         #     live in app/Listeners)
│   ├── Listeners/            #   auto-discovered by `handle(event: X)`
│   ├── Jobs/                 #   queue jobs (auto-registered for workers)
│   ├── Notifications/        #   notification classes
│   ├── Mail/                 #   mailables
│   └── Providers/            #   AppServiceProvider, RouteServiceProvider
├── database/
│   ├── migrations/           #   timestamped `up()`/`down()` schema files
│   ├── factories/            #   Faker-driven model factories
│   └── seeders/              #   DatabaseSeeder + friends
├── resources/
│   ├── js/                   #   the Inertia React app (app.tsx, Pages/, …)
│   ├── css/                  #   Tailwind entry (app.css)
│   └── views/mail/           #   Blade-style email templates (*.html)
├── storage/
│   ├── framework/sessions/   #   file session driver
│   └── logs/                 #   app + mail logs
├── tests/
│   ├── Unit/                 #   Vitest unit tests
│   ├── Feature/              #   Vitest feature tests (freshApp + HTTP calls)
│   └── Browser/              #   Playwright browser specs
├── public/                   #   static assets + Vite build output (build/)
├── package.json              #   scripts: dev, build, vite, test, …
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env                      #   generated from .env.example
```

The framework is **not** a `node_modules` dependency in the app — it is
assembled into `src/` and `bin/` so an app is a self-contained Laravel-style
project (imports are relative, e.g. `import { Route } from '../src/facades'`).
Edit `app/`, `routes/`, `config/`, `database/`, `resources/` and `tests/` —
never `src/` or `bin/`.

### Run it

```bash
js migrate      # create the database + run migrations
js db:seed      # seed the demo users/posts
npm run dev                    # → http://localhost:8080
```

`js` is the app's Artisan-equivalent command (`php artisan` → `js`) — it runs
the app's own `bin/chava.js`. Inside an app it works bare after `npm i -g
@chavajs/cli`, or as `npx js <command>` with no global install.

`npm run dev` boots two processes: the chavaJs application server on
**:8080** and the Vite dev server on **:5173**. If 8080 is already taken the
app server **auto-moves to the next free port** (8081, 8082, …) and prints
where it landed; Vite does the same from 5173. The Inertia HTML shell always
points at the _actual_ Vite port.

To run the two processes separately:

```bash
js serve        # application server on :8080
npm run vite                   # Vite dev server (if not auto-started)
```

### `.env` reference

`.env` is generated by `chava new`. Every variable has a sensible default in
the matching `config/*.ts` file, so a fresh app works with **zero** `.env`
entries — but this is what you can set:

| Variable              | Default                                       | Used by                                               |
| --------------------- | --------------------------------------------- | ----------------------------------------------------- |
| `APP_NAME`            | `chavaJs`                                     | `config/app.ts` → page titles, `app.name` shared prop |
| `APP_ENV`             | `production`                                  | `config/app.ts` → `app.environment()`                 |
| `APP_DEBUG`           | `false`                                       | `config/app.ts` → error verbosity                     |
| `APP_URL`             | `http://localhost:8080`                       | `config/app.ts` → absolute URL building               |
| `APP_KEY`             | `''`                                          | `config/app.ts` → cookie/encryption keys              |
| `DB_CONNECTION`       | `sqlite`                                      | `config/database.ts`                                  |
| `DB_DATABASE`         | `database/database.sqlite` (sqlite) / `chava` | `config/database.ts`                                  |
| `DB_HOST`             | `127.0.0.1`                                   | `config/database.ts` (pg/mysql)                       |
| `DB_PORT`             | `5432` (pg) / `3306` (mysql)                  | `config/database.ts`                                  |
| `DB_USERNAME`         | `postgres` / `root`                           | `config/database.ts`                                  |
| `DB_PASSWORD`         | `''`                                          | `config/database.ts`                                  |
| `DB_SSL`              | `false`                                       | `config/database.ts`                                  |
| `SESSION_DRIVER`      | `file`                                        | `config/session.ts` (`file` or `array`)               |
| `SESSION_FILES`       | `storage/framework/sessions`                  | `config/session.ts`                                   |
| `SESSION_COOKIE`      | `chava_session`                               | `config/session.ts`                                   |
| `SESSION_LIFETIME`    | `120` (minutes)                               | `config/session.ts`                                   |
| `SESSION_HTTP_ONLY`   | `true`                                        | `config/session.ts`                                   |
| `SESSION_SECURE`      | `false`                                       | `config/session.ts`                                   |
| `SESSION_SAME_SITE`   | `lax`                                         | `config/session.ts`                                   |
| `QUEUE_CONNECTION`    | `sync`                                        | `config/queue.ts`                                     |
| `REDIS_HOST`          | `127.0.0.1`                                   | `config/queue.ts` (redis driver)                      |
| `REDIS_PORT`          | `6379`                                        | `config/queue.ts` (redis driver)                      |
| `MAIL_MAILER`         | `log`                                         | `config/mail.ts`                                      |
| `MAIL_LOG_PATH`       | `storage/logs/chava-mail.log`                 | `config/mail.ts` (log driver)                         |
| `MAIL_FROM_ADDRESS`   | `hello@chava.dev`                             | `config/mail.ts`                                      |
| `MAIL_FROM_NAME`      | `chavaJs`                                     | `config/mail.ts`                                      |
| `MAIL_HOST`           | `smtp.example.com`                            | `config/mail.ts` (smtp)                               |
| `MAIL_PORT`           | `587`                                         | `config/mail.ts` (smtp)                               |
| `MAIL_ENCRYPTION_TLS` | `false`                                       | `config/mail.ts` (smtp)                               |
| `MAIL_USERNAME`       | `''`                                          | `config/mail.ts` (smtp)                               |
| `MAIL_PASSWORD`       | `''`                                          | `config/mail.ts` (smtp)                               |
| `VITE_URL`            | `http://localhost:5173`                       | `config/frontend.ts`                                  |
| `VITE_PORT`           | `5173`                                        | `config/frontend.ts`                                  |

`Env` is the Laravel `env()` equivalent and is used _inside_ the config files:

```ts
// config/app.ts
import { Env } from "../src/config/Env";

export default {
  name: Env.get("APP_NAME", "chavaJs"),
  env: Env.get("APP_ENV", "production"),
  debug: Env.bool("APP_DEBUG", false),
  url: Env.get("APP_URL", "http://localhost:8080"),
  key: Env.get("APP_KEY", ""),
  timezone: "UTC",
};
```

Read any value at runtime with the `Config` facade:

```ts
import { Config } from "../src/facades";
Config.get("app.name"); // 'chavaJs'
Config.get("database.default"); // 'sqlite'
Config.get("mail.default"); // 'log'
Config.get("nope", "fallback"); // 'fallback'
```

### `config/*.ts` reference

Every file exports a plain object; values are read with `Config.get('<file>.<key>')`.

**`config/app.ts`** — `name`, `env`, `debug`, `url`, `key`, `timezone`.

**`config/database.ts`** — the default connection plus one config block per
driver:

```ts
export default {
  default: Env.get("DB_CONNECTION", "sqlite"),
  connections: {
    sqlite: {
      driver: "sqlite",
      database: Env.get("DB_DATABASE", "database/database.sqlite"),
    },
    pg: { driver: "pg", host, port, database, username, password, ssl },
    mysql: { driver: "mysql", host, port, database, username, password, ssl },
  },
};
```

Set `DB_DATABASE=:memory:` (or connect programmatically) for in-memory SQLite
in tests.

**`config/auth.ts`** — guards and providers:

```ts
export default {
  defaults: { guard: "web" },
  guards: {
    web: { driver: "session", provider: "users" },
    api: {
      driver: "token",
      provider: "users",
      token_model: PersonalAccessToken,
      user_relation: "user",
    },
  },
  providers: { users: { driver: "eloquent", model: User } },
  password_timeout: 10800, // seconds a password stays valid in the session
};
```

**`config/session.ts`** — `driver` (`file` | `array`), `files` path, `cookie`
name, `lifetime` (minutes), `http_only`, `secure`, `same_site`.

**`config/queue.ts`** — `default` connection (`sync`) plus `sync`, `database`
(`jobs`/`failed_jobs` tables, `retry_after`), and `redis` (BullMQ, requires
`npm i bullmq ioredis`) connections.

**`config/mail.ts`** — `default` (`log`) plus `log`, `array`, and `smtp`
(Nodemailer, requires `npm i nodemailer`) transports, plus the `from` address
applied to every message that doesn't set one.

**`config/frontend.ts`** — `vite_url`, `vite_port`, and `version` (bump it to
force Inertia clients to hard-reload after deploys).

### Getting started (developing the framework itself)

```bash
# 1. Install dependencies
npm install

# 2. Assemble the framework into the reference app
npm run assemble      # merges packages/* → examples/starter/src + bin

# 3. Run the reference app
cd examples/starter
js migrate
js db:seed
npm run dev           # boots the API server on :8080 AND Vite on :5173

# 4. Open http://localhost:8080
```

```bash
npm test            # run the Vitest suite (SQLite; delegates to examples/starter)
npm run typecheck   # tsc --noEmit
npm run build       # production asset build (writes examples/starter/public/build)
npm run test:postgres   # Vitest against Postgres (needs docker-compose.test.yml up)
npm run test:mysql      # Vitest against MySQL
npm run test:browser    # Playwright browser tests
npm run assemble        # re-merge packages/* into the reference app after edits
```

> Edit framework code in `packages/*/src` — the reference app's `src/` is a
> generated merge (`npm run assemble`), not the source of truth.

---

## HTTP layer

### Request lifecycle & `bootstrap/app.ts`

`bootstrap/app.ts` is Laravel's `bootstrap/app.php`: it is where you configure
middleware groups and register service providers.

```ts
import { AppServiceProvider } from "../app/Providers/AppServiceProvider";
import { RouteServiceProvider } from "../app/Providers/RouteServiceProvider";
import { Application } from "../src/foundation/Application";
import { HandleInertiaRequests } from "../src/inertia/HandleInertiaRequests";
import { StartSession } from "../src/http/middleware/StartSession";
import { VerifyCsrfToken } from "../src/http/middleware/VerifyCsrfToken";

export const app = Application.configure({
  name: "chavaJs",
  providers: [AppServiceProvider, RouteServiceProvider],
  globalMiddleware: [],
  webMiddleware: [StartSession, HandleInertiaRequests, VerifyCsrfToken],
  apiMiddleware: [],
});
```

Every request flows through a middleware pipeline built from the **global**
group plus the group the route belongs to (`web` for `routes/web.ts`,
`api` for `routes/api.ts`). Framework providers are registered before yours,
so `app.make('auth')`, `app.make('config')`, and so on are always available.

### Routing

Routes are registered in `routes/*.ts` with the `Route` facade. The supported
verbs are `get`, `post`, `put`, `patch`, `delete`, and `match`:

```ts
// routes/web.ts
import { Route } from "../src/facades";
import { HomeController } from "../app/Http/Controllers/HomeController";

Route.get("/", [HomeController, "index"]).name("home");
Route.post("/users", [UserController, "store"]).name("users.store");
Route.put("/users/{user}", [UserController, "update"]).name("users.update");
Route.patch("/users/{user}", [UserController, "update"]);
Route.delete("/users/{user}", [UserController, "destroy"]).name(
  "users.destroy",
);
Route.match(["GET", "POST"], "/anything", [AnythingController, "handle"]);
```

**Route parameters** — required `{id}` and optional `{id?}`:

```ts
Route.get("/posts/{post}", [PostController, "show"]); // /posts/123
Route.get("/users/{id?}", [UserController, "index"]); // /users and /users/5
```

**Named routes** — `.name('users.show')`; group prefixes automatically
prepend group names.

**Groups, prefixes & middleware** — fluent chains return a _registrar_ that
snapshots the attributes; nothing leaks into the router's global state:

```ts
Route.middleware("auth")
  .prefix("admin")
  .name("admin.")
  .group(() => {
    Route.get("/dashboard", [AdminController, "index"]); // GET /admin/dashboard, name admin.dashboard
    Route.resource("users", AdminUserController);
  });

Route.group({ prefix: "api", middleware: "api" }, () => {
  Route.get("/ping", [ApiController, "ping"]);
});
```

`Route.resource(name, Controller, options?)` registers the full set of
RESTful routes (`index/create/store/show/edit/update/destroy`) with Laravel's
exact URI conventions — plural collection paths, singular route-model params:

```ts
Route.resource("posts", PostController); // POST /posts, GET /posts/{post}/edit, …
Route.resource("posts", PostController, { only: ["index", "show"] });
Route.resource("posts", PostController, { except: ["destroy"] });
Route.resource("posts", PostController, { names: { index: "posts.all" } });
```

**Route constraints** — `.where()` applies a regex to a param:

```ts
Route.get("/users/{id}", [UserController, "show"]).where({ id: "[0-9]+" });
```

**Route model binding** — declare the param type as a Model class in the
controller signature and the bound model is injected (404 when not found):

```ts
// GET /posts/{post} → the `post` argument is a hydrated Post instance
public async show(request: Request, post: Post) { … }
```

**Single-action (invokable) controllers** — pass the class directly and
chavaJs calls `__invoke()`:

```ts
Route.get("/report", DownloadReportController);
// class DownloadReportController { public async __invoke() { … } }
```

**404 / 405** — unmatched URIs return 404; a matched URI with the wrong
method returns 405.

Inspect the table anytime:

```bash
js route:list
```

### Controllers

Controllers are plain classes under `app/Http/Controllers/`. Methods are
referenced as `[ControllerClass, 'methodName']` — Laravel's
`[Controller::class, 'method']` — and are resolved from the container, so
constructor injection is automatic:

```ts
import { Inertia } from "../../src/facades";
import { PostRepository } from "../../app/Services/PostRepository";

export class PostController {
  public constructor(private readonly posts: PostRepository) {}

  public async index(request: Request) {
    const posts = await this.posts.latest();
    return Inertia.render("Posts/Index", { posts });
  }
}
```

Method arguments are injected _by type_: `Request` (or any subclass) receives
the current request, a Model class receives the bound route model, and
anything else is resolved from the container.

### Middleware

Middleware implements Laravel's `handle(request, next)` contract. `next()`
returns a `Response`; the middleware may inspect/change the request, short-circuit
with its own `Response`, or forward and transform the response:

```ts
import type { Request } from "../../../src/http/Request";
import type { Response } from "../../../src/http/Response";
import type { NextFunction } from "../../../src/http/types";

export class EnsureAdmin {
  public async handle(request: Request, next: NextFunction): Promise<Response> {
    const user = await request.user();
    if (!user || user.getAttribute("is_admin") !== true) {
      return Response.redirect("/");
    }
    return next();
  }
}
```

Groups are declared in `bootstrap/app.ts`: `globalMiddleware` (every route),
`webMiddleware` (session, Inertia, CSRF by default), and `apiMiddleware`.
Per-route middleware uses the same group names or an explicit class:

```ts
Route.get("/dashboard", [DashboardController, "index"]).middleware("auth");
Route.post("/users", [UserController, "store"]).middleware("can:create,users");
Route.get("/webhooks", [WebhookController, "index"]).middleware(EnsureAdmin);
```

**Built-in middleware:**

| Middleware              | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `auth`                  | Require a logged-in user; redirect to `/login` otherwise          |
| `guest`                 | Only allow guests (redirects authenticated users to `/dashboard`) |
| `verified`              | Require a verified email (`email_verified_at` set)                |
| `can:<ability>,<model>` | Route through the Gate (Laravel's `can:` middleware)              |
| `session`               | Start the session (member of the `web` group)                     |
| `csrf`                  | Verify the CSRF token (member of the `web` group)                 |

Generate a new middleware with `chava make:middleware EnsureAdmin`.

### The Request object

The `Request` is a typed wrapper around the Node `IncomingMessage`:

```ts
import { Request } from "../../src/http/Request";

export class UserController {
  public async store(request: Request) {
    request.input("name"); // form/JSON body value
    request.input("name", "default"); // with a fallback
    request.query("page", 1); // querystring value
    request.only(["name", "email"]); // subset of the input
    request.except(["password"]); // input minus keys
    request.json(); // the parsed JSON body (object)
    request.bearerToken(); // the Authorization: Bearer token (or null)
    request.method(); // 'GET' | 'POST' | …
    request.fullUrl(); // scheme + host + path + query
    request.header("x-inertia"); // a header (case-insensitive)
    request.isInertia(); // true for X-Inertia requests
  }
}
```

**Validation on the request** — Laravel's `$request->validate()`:

```ts
const data = await request.validate({ name: "required|max:255" }); // throws on failure
const data = await request.validated(); // from a FormRequest param
```

**Auth & session helpers**:

```ts
const user = await request.user(); // the authenticated Model (or null)
await request.session(); // the SessionStore for this request
request.flash("status", "Saved!"); // flash to the *next* request
request.old("email"); // previously submitted input
request.back(); // → Response.redirect to the previous URL
request.redirect("/dashboard"); // → Response.redirect
```

Controller signature injection makes Form Requests feel like Laravel:

```ts
public async login(request: LoginRequest) {
  const data = await request.validated();
  const ok = await Auth.attempt({ email: data.email, password: data.password });
  if (!ok) return request.back().withErrors({ email: ['These credentials do not match our records.'] });
  return request.redirect('/dashboard');
}
```

### The Response object

Controllers return a `Response` (or a plain value the kernel wraps — an
object becomes JSON, a string becomes HTML):

```ts
Response.json({ ok: true }); // 200 application/json
Response.json(data, 201); // custom status
Response.html("<h1>Hi</h1>"); // 200 text/html
Response.redirect("/dashboard"); // 302 Location
Response.redirect("/login", 301); // custom status
Response.noContent(); // 204

new Response()
  .status(418)
  .header("x-who", "teapot")
  .cookie("theme", "dark", {
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    sameSite: "lax",
  })
  .send("body");
```

The `Response` class mirrors `Illuminate\Http\Response`: `status`,
`header`, `withHeaders`, `contentType`, `json`, `html`, `send`, `redirect`,
`cookie`, and static helpers `json`, `html`, `redirect`, `noContent`.
`Inertia.render()` returns a `Response` subclass that implements the Inertia
protocol (see [Frontend](#frontend-inertia--react)).

### Validation

The `Validator` is a port of Laravel's validator:

```ts
import { Validator } from "../../src/validation/Validator";

const validator = Validator.make(
  { email: "foo", age: "17" },
  { email: "required|email|max:255", age: "required|integer|min:18" },
);

validator.passes(); // false
validator.fails(); // true
validator.errors(); // { email: ['The email field must be a valid email address.'], … }
validator.validate(); // throws ValidationException on failure, returns data
```

Rules are pipe-delimited strings; `:param` values come after a colon:

| Rule                        | Example                                              |
| --------------------------- | ---------------------------------------------------- |
| `required`                  | `required`                                           |
| `email`                     | `email`                                              |
| `min` / `max`               | `min:18`, `max:255`, `min:1` (arrays)                |
| `integer` / `numeric`       | `integer`, `numeric`                                 |
| `string` / `boolean`        | `string`, `boolean`                                  |
| `confirmed`                 | `confirmed` (checks `field` == `field_confirmation`) |
| `unique`                    | `unique:users,email`                                 |
| `exists`                    | `exists:users,id`                                    |
| `regex`                     | `regex:/^[a-z]+$/`                                   |
| `in` / `not_in`             | `in:red,blue`, `not_in:pending`                      |
| `date` / `after` / `before` | `date`, `after:today`                                |
| `array` / `object`          | `array`, `object`                                    |
| `url` / `uuid`              | `url`, `uuid`                                        |
| `same` / `different`        | `same:other_field`                                   |

**Custom rules** — a function `(value) => boolean | string` (returning a
string yields a custom error message):

```ts
Validator.make(data, {
  handle: (v: unknown) =>
    typeof v === "string" && /^[a-z][a-z0-9_]*$/.test(v)
      ? true
      : "The handle must be a valid slug.",
});
```

**Custom messages** — a second options object:

```ts
Validator.make(
  data,
  { email: "required|email" },
  {
    "email.required": "Please enter your email address.",
    "email.email": "That is not a valid email.",
  },
);
```

**Form Request classes** — Laravel's `FormRequest`:

```ts
// app/Http/Requests/LoginRequest.ts
import { FormRequest } from "../../src/validation/FormRequest";

export class LoginRequest extends FormRequest {
  public rules() {
    return { email: "required|email", password: "required" };
  }
  public messages() {
    return { "email.required": "Please enter your email address." };
  }
}
```

Type-hint it on a controller method and it is resolved from the container with
the current request bound; `request.validated()` returns only the validated
data. Use `chava make:request LoginRequest` to scaffold one.

### Sessions & CSRF

Sessions are Laravel-exact. The signed `chava_session` cookie carries the
session id; data lives server-side (`file` driver → `storage/framework/sessions`,
`array` driver → in-memory, used by tests).

**The store API** (`SessionStore` — Laravel's `Illuminate\Session\Store`):

```ts
const store = request.session();

store.put("cart", [1, 2, 3]);
store.get("cart"); // [1, 2, 3]
store.push("cart", 4);
store.pull("key"); // get + forget
store.forget("key"); // delete one
store.flush(); // clear everything
store.has("key"); // boolean

store.flash("status", "Saved!"); // available for the NEXT request only
store.now("status", "Fresh"); // available for THIS request only
store.reflash(); // keep flash data one more request
store.keep(["status"]); // keep specific keys

store.old("email"); // previously submitted input
store.flashInput(request.only("email"));
store.previousUrl(); // the previous request URL
store.token(); // the CSRF token (generated lazily)
store.regenerate(); // new session id (login/logout do this)
store.migrate(); // regenerate id + CSRF token (anti-fixation)
```

**CSRF** follows Laravel exactly: the `XSRF-TOKEN` cookie is set by
`VerifyCsrfToken`, Inertia's axios client echoes it back as the
`X-XSRF-TOKEN` header on every request, and a mismatch yields **419**. The
token is also shared to the frontend as the `csrf_token` prop by
`HandleInertiaRequests`, so `useForm()` submissions are protected out of the
box. CSRF applies to `POST`/`PUT`/`PATCH`/`DELETE` requests in the `web`
group.

---

## Database & ORM

### Connections

`config/database.ts` defines the `default` connection plus named blocks.
SQLite is the default (zero setup); Postgres and MySQL use the `pg` and
`mysql2` drivers behind the scenes:

```ts
import { DB } from "../src/facades";

await DB.table("users").where("is_admin", 1).get(); // default connection
await DB.connection("mysql").table("users").get(); // named connection
```

### Migrations & the Blueprint

Migrations live in `database/migrations/` as timestamped files exporting
`up()` and `down()`:

```ts
// database/migrations/2026_01_01_000000_create_users_table.ts
import { Schema } from "../../src/facades";

export async function up(): Promise<void> {
  await Schema.create("users", (table) => {
    table.id();
    table.string("name");
    table.string("email").unique();
    table.string("password");
    table.boolean("is_admin").default(false);
    table.timestamp("email_verified_at").nullable();
    table.timestamps();
    table.softDeletes();
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists("users");
}
```

Run them with `chava migrate` (or `migrate:fresh` to wipe + rerun,
`migrate:rollback` to undo the last batch, `migrate:status` to list).

**Column types** (`table.*`):

| Method                                         | Notes                                                 |
| ---------------------------------------------- | ----------------------------------------------------- |
| `id()`                                         | `bigIncrements('id')` — auto-incrementing primary key |
| `increments(name)` / `bigIncrements(name)`     | auto-increment PK                                     |
| `string(name, length = 255)`                   | varchar                                               |
| `text(name)`                                   | long text                                             |
| `integer(name)` / `tinyInteger(name)`          | integer                                               |
| `bigInteger(name)`                             | bigint                                                |
| `float(name)` / `double(name)`                 | floating point                                        |
| `decimal(name, total = 8, places = 2)`         | fixed-point                                           |
| `boolean(name)`                                | boolean                                               |
| `date(name)` / `dateTime(name)` / `time(name)` | temporal                                              |
| `timestamp(name)`                              | nullable timestamp                                    |
| `timestamps()`                                 | `created_at` + `updated_at`                           |
| `softDeletes(column = 'deleted_at')`           | nullable deleted-at                                   |
| `rememberToken()`                              | `remember_token` varchar(100) nullable                |
| `json(name)` / `jsonb(name)`                   | JSON storage                                          |
| `uuid(name)`                                   | UUID                                                  |
| `binary(name)`                                 | BLOB                                                  |
| `enum(name, values)`                           | checked enum                                          |
| `foreignId(name)`                              | unsigned bigint for foreign keys                      |

**Modifiers** (chain onto a column): `.nullable()`, `.default(value)`,
`.unsigned()`, `.primary()`, `.unique(name?)`, `.index(name?)`,
`.references(col)`, `.on(table)`, and `.constrained(table?)` (shorthand for
`references('id').on(table)`).

**Table-level builders**: `table.index(cols, name?)`,
`table.uniqueConstraint(cols, name?)`, `table.primaryConstraint(cols, name?)`,
and `table.foreign(cols).references(col).on(table)`.

Example — a full relational schema from the template:

```ts
// personal_access_tokens
await Schema.create("personal_access_tokens", (table) => {
  table.id();
  table.foreignId("user_id").constrained("users").index();
  table.string("name");
  table.string("token", 64).unique();
  table.json("abilities");
  table.timestamp("last_used_at").nullable();
  table.timestamp("expires_at").nullable();
  table.timestamps();
});

// notifications (morph-related to the notifiable)
await Schema.create("notifications", (table) => {
  table.uuid("id").primary();
  table.string("type");
  table.string("notifiable_type");
  table.bigInteger("notifiable_id").unsigned();
  table.text("data");
  table.timestamp("read_at").nullable();
  table.timestamps();
  table.index(["notifiable_type", "notifiable_id"]);
});
```

### Models

Models extend `Model` (Eloquent's `Illuminate\Database\Eloquent\Model`):

```ts
// app/Models/Post.ts
import { Model } from "../../src/orm/Model";
import { User } from "./User";

export class Post extends Model {
  public static fillable = ["user_id", "title", "body"];

  public user() {
    return this.belongsTo(User);
  }
}
```

**Static (query) API:**

```ts
await Post.find(1); // instance or null
await Post.findOrFail(1); // throws when missing
await Post.create({ title: "Hi", body: "…" });
await Post.query().where("user_id", 1).get();
Post.with("user"); // eager-load builder
await Post.latest().paginate(15); // paginator
```

**Instance API:**

```ts
const post = await Post.find(1);
post.getAttribute("title"); // 'Hi'
post.setAttribute("title", "Hello");
post.title; // same as getAttribute (via casts)
await post.update({ title: "Hello" });
await post.delete(); // soft-deletes when the model has soft deletes
await post.save();
post.toArray(); // plain object
post.getKey(); // the primary key value
await post.user(); // relation fetch
```

**Fillable / guarded** — `static fillable = [...]` whitelists mass-assignment
(the `create()`/`update()` path). (Laravel's `$guarded` blacklist is the
inverse and defaults to everything-forbidden.)

**Casts** — `static casts` maps attributes to types, driving `getAttribute`
and JSON serialization:

```ts
export class User extends Model {
  public static casts = {
    is_admin: "boolean",
    email_verified_at: "datetime",
    settings: "json",
  };
}
```

**Timestamps & soft deletes** — `created_at`/`updated_at` are maintained
automatically; when the table has a `deleted_at` column the model
soft-deletes (`delete()` sets `deleted_at`, queries filter it out).

**Model events** — lifecycle hooks can be wired through the
`created`/`updating`/`deleted`/… event names (Laravel model events).

**Custom scopes / accessors** — add methods on the model class; accessors
returned from `getAttribute` can be plain `get` functions or cast-backed.

### The query builder

`Model.query()` and `DB.table('users')` share one fluent builder:

```ts
await User.query()
  .where("is_admin", true)
  .where("age", ">", 21)
  .orWhere("country", "US")
  .orderBy("name")
  .limit(10)
  .get();

await DB.table("users")
  .whereIn("id", [1, 2, 3])
  .whereNull("deleted_at")
  .pluck("email");

await Post.query().with("user").latest().paginate(15);
// { data: Post[], current_page, per_page, total, last_page, … }
```

| Method                                                                | Purpose                   |
| --------------------------------------------------------------------- | ------------------------- |
| `where(col, op?, val)`                                                | equality / comparison     |
| `orWhere(col, op?, val)`                                              | OR branch                 |
| `whereIn(col, values)` / `whereNotIn`                                 | membership                |
| `whereNull(col)` / `whereNotNull`                                     | null checks               |
| `orderBy(col, dir?)` / `latest()` / `oldest()`                        | ordering                  |
| `limit(n)` / `offset(n)` / `take` / `skip`                            | paging                    |
| `count()` / `max(col)` / `min` / `avg` / `sum`                        | aggregates                |
| `pluck(col)`                                                          | column values             |
| `chunk(size, fn)`                                                     | process rows in batches   |
| `exists()`                                                            | boolean                   |
| `join` / `leftJoin`                                                   | joins                     |
| `upsert(values, keys)`                                                | insert-or-update          |
| `first()` / `firstOrFail()` / `find(id)` / `findOrFail(id)` / `get()` | fetch                     |
| `paginate(perPage)`                                                   | paginator with links data |

### Relationships

Declared as methods returning relation objects; call the method to query,
eager-load with `with()` / `load()`:

```ts
// app/Models/User.ts
export class User extends Model {
  public posts() {
    return this.hasMany(Post);
  }
  public profile() {
    return this.hasOne(Profile);
  }
  public roles() {
    return this.belongsToMany(Role); // pivot table roles_users
  }
}

const user = await User.with("posts", "roles").find(1);
user.posts; // the eager-loaded collection
await user.posts(); // fresh query
```

Supported relations: `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`,
`hasManyThrough`, `morphOne`, `morphMany`, `morphTo`. Eager loading avoids
N+1 queries: `User.with('posts').get()` hydrates all posts for the returned
users in a single query.

### Factories & seeders

**Factories** are Faker-driven (the `@faker-js/faker` package is included):

```ts
// database/factories/UserFactory.ts
import { faker } from "@faker-js/faker";
import { Factory } from "../../src/orm/Factory";
import { User } from "../../app/Models/User";

export class UserFactory extends Factory<User> {
  protected model = User;

  public definition() {
    return {
      name: faker.person.fullName(),
      email: faker.internet.email(),
      password: "secret",
    };
  }
}
```

Usage — Laravel's factory API, ported:

```ts
await UserFactory.new().count(10).create(); // ten users
await UserFactory.new().state({ is_admin: true }).createOne();
```

**Seeders** extend `Seeder` and are run with `chava db:seed`:

```ts
// database/seeders/DatabaseSeeder.ts
export class DatabaseSeeder extends Seeder {
  public async run(): Promise<void> {
    await UserFactory.new().count(8).create();
    // …
  }
}
```

Generate stubs with `chava make:model User`, `chava make:factory --model=User`,
and `chava make:seeder UserSeeder`.

---

## Auth & authorization

### Guards & configuration

`config/auth.ts` declares guards and the providers that retrieve users:

- **`web`** guard — `session` driver. `Auth.attempt({ email, password })`
  verifies credentials (scrypt via `EloquentUserProvider.validateCredentials`),
  logs the user in, regenerates the session id + CSRF token (anti-fixation),
  and stores the user id in the session.
- **`api`** guard — `token` driver. Reads `Authorization: Bearer <token>`,
  looks up the `PersonalAccessToken` model by a SHA-256 hash of the token, and
  resolves the user through the configured `user_relation`.

### The `Auth` facade

```ts
import { Auth } from "../../src/facades";

await Auth.user(); // Model | null (default 'web' guard)
await Auth.check(); // boolean
await Auth.guest(); // !check()
await Auth.id(); // the user id (unknown | null)
await Auth.attempt({ email, password }); // boolean — session guard
await Auth.login(user); // session guard — logs in + session migration
await Auth.logout(); // clears the session user
await Auth.guard("api").user(); // switch guard explicitly
```

The same API is available through the current request:

```ts
const user = await request.user();
```

### Password hashing

`Hash` uses **scrypt** from `node:crypto` — no native dependencies:

```ts
import { Hash } from "../../src/facades"; // (Hash is also exported by src/facades)

const hash = await Hash.make("secret");
await Hash.check("secret", hash); // true
await Hash.check("nope", hash); // false
```

Stored hashes look like `scrypt$<salt>$<derived-hex>`.

### Gates & policies

`Gate` is Laravel's authorization gate:

```ts
import { Gate } from "../../src/facades";

// Ability callback: (user, ...args) => boolean
Gate.define("manage-users", (user) => user?.getAttribute("is_admin") === true);

// before/after hooks short-circuit the gate (Laravel's Gate::before / after)
Gate.before((user, ability) => user?.getAttribute("is_superuser") === true);
Gate.after((user, ability, result) => result);
```

Checks:

```ts
await Gate.allows("manage-users"); // for the current user
await Gate.denies("manage-users");
await Gate.any(["view-users", "manage-users"]);
await Gate.check(["view-users", "edit-users"]);
await Gate.authorize("delete", post); // throws 403 when denied
await Gate.forUser(someUser).allows("x"); // evaluate as another user
await user.can("delete", post); // Model::can() — same gate
```

**Policies** — map a model to a policy class with `Gate.policy`; methods are
matched by ability name and receive `(user, ...args)`:

```ts
// app/Policies/UserPolicy.ts
import { Policy } from "../../src/auth/Policy";

export class UserPolicy extends Policy {
  public async delete(user: User, target: User) {
    return (
      user.getAttribute("is_admin") === true ||
      user.getKey() === target.getKey()
    );
  }
}

// app/Providers/AppServiceProvider.ts
import { Gate } from "../../src/facades";
Gate.policy(User, UserPolicy);
```

```ts
// inside a controller
await request.user().can("delete", otherUser); // false
await Gate.authorize("delete", otherUser); // 403 when denied
Route.delete("/users/{user}", [UserController, "destroy"]).middleware(
  "can:delete,users",
);
```

### Auth middleware & email verification

| Middleware              | Behavior                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `auth`                  | unauthenticated → redirect to `/login`                                                  |
| `guest`                 | authenticated → redirect to `/dashboard`                                                |
| `verified`              | requires `email_verified_at`; else redirect to `/dashboard` with a `verify-email` flash |
| `can:<ability>,<param>` | run the gate; 403 when denied                                                           |

The template's email-verification flow: `email_verified_at` is a nullable
timestamp; `verified` middleware checks it. The same column powers the shared
`auth.user` Inertia prop, and the register flow dispatches
`UserRegistered` → welcome notification (see [Services & background work](#services--background-work)).

### Auth, end to end

A Form Request, a controller, and a policy — the Laravel shape with TS:

```ts
// app/Http/Requests/LoginRequest.ts
import { FormRequest } from "../../src/validation/FormRequest";

export class LoginRequest extends FormRequest {
  public rules() {
    return { email: "required|email", password: "required" };
  }
  public messages() {
    return { "email.required": "Please enter your email address." };
  }
}
```

```ts
// app/Http/Controllers/AuthController.ts
import { Auth } from "../../src/facades";
import { LoginRequest } from "../Requests/LoginRequest";

export class AuthController {
  public async login(request: LoginRequest) {
    const data = await request.validated();
    const ok = await Auth.attempt({
      email: data.email,
      password: data.password,
    });
    if (!ok)
      return request
        .back()
        .withErrors({ email: ["These credentials do not match our records."] });
    return request.redirect("/dashboard");
  }
}
```

```ts
// routes/web.ts
Route.get("/login", [AuthController, "create"]).middleware("guest");
Route.post("/login", [AuthController, "login"]).middleware("guest");
Route.post("/logout", [AuthController, "logout"]).middleware("auth");
Route.get("/dashboard", [DashboardController, "index"]).middleware("auth");
```

The `web` middleware group runs `StartSession` + `HandleInertiaRequests` +
`VerifyCsrfToken`, so these forms get session flash, shared `auth.user`/`errors`
props, and CSRF protection automatically.

---

## Services & background work

### The service container

The container (`Application`, accessible as the `App` facade) resolves
everything — controllers, middleware, listeners, providers, and your own
services — with **automatic constructor injection**:

```ts
import { App } from "../../src/facades";

App.bind("post-repo", () => new PostRepository()); // factory (new instance each make)
App.singleton("post-repo", () => new PostRepository()); // cached singleton
App.instance("post-repo", repo); // already-built value
App.alias(PostRepository, "post-repo"); // resolve by class too

const repo = App.make("post-repo"); // resolve by key
const svc = App.make(SomeService); // resolve by class (auto-wired)
await App.call(controller, "method", args); // invoke with container-wired params
```

Resolution inspects constructor parameters by type/name and injects:
`Request` subclasses get the current request, Model classes get route-bound
models, and any other type is resolved recursively from the container.
The framework's own singletons are registered under these keys:
`app`, `config`, `router`, `db`, `schema`, `auth`, `gate`, `session`,
`events`, `queue`, `mail`, `notifications`, `schedule`, `inertia`.

### Facades

Facades are `Proxy`-based static accessors (Laravel's `DB::table(...)`), not
magic-method classes. They forward every property/method call to the live
singleton, so they always reflect the current request/container:

```ts
import {
  App,
  Config,
  Route,
  DB,
  Schema,
  Auth,
  Gate,
  Session,
  Event,
  Queue,
  Mail,
  Notification,
  Schedule,
  Inertia,
  Hash,
  Env,
} from "../src/facades";
```

| Facade         | Backing singleton | Typical use                                        |
| -------------- | ----------------- | -------------------------------------------------- |
| `App`          | `app`             | `App.make(...)`, `App.bind(...)`                   |
| `Config`       | `config`          | `Config.get('app.name')`                           |
| `Route`        | `router`          | `Route.get('/x', [C, 'm'])`                        |
| `DB`           | `db`              | `DB.table('users').where(...)`                     |
| `Schema`       | `schema`          | `Schema.create('users', cb)`                       |
| `Auth`         | `auth`            | `Auth.attempt({...})`, `Auth.user()`               |
| `Gate`         | `gate`            | `Gate.define(...)`, `Gate.authorize(...)`          |
| `Session`      | `session`         | `Session.store()`                                  |
| `Event`        | `events`          | `Event.dispatch(new UserRegistered(user))`         |
| `Queue`        | `queue`           | `Queue.push(new Job(...))`                         |
| `Mail`         | `mail`            | `Mail.to(x).send(new WelcomeMail(u))`              |
| `Notification` | `notifications`   | `Notification.send(user, new N())`                 |
| `Schedule`     | `schedule`        | `Schedule.call(fn).everyMinute()`                  |
| `Inertia`      | `inertia`         | `Inertia.render('Home', props)`                    |
| `Hash`         | —                 | `Hash.make(pw)`, `Hash.check(pw, hash)`            |
| `Env`          | —                 | `Env.get('X')`, `Env.bool('Y')`, `Env.number('Z')` |

### Events & listeners

```ts
// app/Events/UserRegistered.ts
export class UserRegistered {
  public constructor(public readonly user: User) {}
}
```

```ts
// dispatch
import { Event } from "../../src/facades";
await Event.dispatch(new UserRegistered(user));
```

**Auto-discovery** mirrors Laravel's `EventServiceProvider`: every class in
`app/Listeners/*.ts` whose `handle(event: SomeEvent)` method type-hints an
event class is wired up automatically. TypeScript annotations are erased at
runtime, so chavaJs reads the listener's source file and extracts the
`handle()` parameter type at boot — same developer contract, one file read.

```ts
// app/Listeners/SendWelcomeNotification.ts — NO manual registration needed
export class SendWelcomeNotification {
  public async handle(event: UserRegistered): Promise<void> {
    await event.user.notify(new WelcomeNotification());
  }
}
```

Manual registration still works when you need it: `Event.listen(UserRegistered,
ListenerClass)`, `Event.once(...)`, `Event.forget(...)`, `Event.hasListeners(...)`.

**Queued listeners** — extend `ShouldQueue` and `handle()` runs as a
`CallQueuedListener` job on the queue instead of inside the request; a slow or
failing listener can never break the caller. Honor the static
`tries`/`queue`/`connection`/`delay` config:

```ts
import { ShouldQueue } from '../../src/events/queue';

export class SendWelcomeNotification extends ShouldQueue {
  public static tries = 3;
  public async handle(event: UserRegistered): Promise<void> { … }
}
```

### Queues

Jobs extend `Job` and implement `handle()`:

```ts
// app/Jobs/SendWelcomeEmailJob.ts
import { Job } from "../../src/queue/Job";

export class SendWelcomeEmailJob extends Job {
  public constructor(public readonly userId: number) {
    super();
  }
  public async handle(): Promise<void> {
    const user = await User.findOrFail(this.userId); // re-fetched in the worker
    await Mail.send(new WelcomeMail(user));
  }
}
```

Dispatch with the `Queue` facade:

```ts
import { Queue } from "../../src/facades";
await Queue.push(new SendWelcomeEmailJob(1)); // default connection
await Queue.later(60, new SendWelcomeEmailJob(1)); // delayed 60s
await Queue.connection("database").push(job); // named connection
```

**Drivers** (`config/queue.ts`):

| Driver     | Notes                                                       |
| ---------- | ----------------------------------------------------------- |
| `sync`     | runs inline in the request — the default (no worker needed) |
| `database` | `jobs` + `failed_jobs` tables; consumed by a worker         |
| `redis`    | BullMQ — requires `npm i bullmq ioredis`                    |

**Worker options on `Job`:** `tries` (default 3), `backoff` seconds (3),
`timeout` (60), `queue` name (`default`), `delay` seconds. Serialization stores
the class name + the job's own data properties; jobs in `app/Jobs/*.ts` are
auto-registered when a worker boots (`registerJobsFrom`), so a worker process
can rehydrate jobs pushed by another process.

```bash
QUEUE_CONNECTION=database js queue:work --once   # process one job
js queue:work                                    # keep processing
js queue:listen                                  # auto-restarting worker
```

Exhausted jobs land in `failed_jobs` with the exception text.

### Mail

Mailables extend `Mailable` and declare an envelope + content:

```ts
// app/Mail/WelcomeMail.ts
import { Mailable } from "../../src/mail/Mailable";
import type { Envelope, MailableContent } from "../../src/mail/Mailable";

export class WelcomeMail extends Mailable {
  public constructor(private readonly user: User) {
    super();
  }

  public envelope(): Envelope {
    return {
      subject: "Welcome!",
      to: { address: this.user.email, name: this.user.name },
    };
  }

  public content(): MailableContent {
    return { view: "emails.welcome" }; // resources/views/mail/emails/welcome.html
  }
}
```

```ts
import { Mail } from "../../src/facades";
await Mail.send(new WelcomeMail(user));
await Mail.to("boss@example.com")
  .cc("bcc@example.com")
  .send(new WelcomeMail(user));
```

**Drivers** (`config/mail.ts`): `log` (writes to `storage/logs/chava-mail.log`),
`array` (collects messages in memory — `Mail.sent()` in tests), and `smtp`
(Nodemailer, requires `npm i nodemailer`). The configured `from` address is
applied to any message that doesn't set one.

**Templates** — Blade-style `resources/views/mail/*.html` files. Dot-notated
view names map to paths (`emails.welcome` → `resources/views/mail/emails/welcome.html`)
and are rendered with `{{ var }}`-style interpolation against the mailable's
own data properties.

### Notifications

Notifications extend `Notification` and declare their channels in `via()`:

```ts
// app/Notifications/WelcomeNotification.ts
import { Notification } from "../../src/notifications/types";
import type { Mailable } from "../../src/mail/Mailable";
import type {
  NotifiableModel,
  DatabaseNotificationData,
} from "../../src/notifications/types";

export class WelcomeNotification extends Notification {
  public via(_notifiable: NotifiableModel): string[] {
    return ["mail", "database"];
  }
  public toMail(notifiable: NotifiableModel): Mailable {
    return new WelcomeMail(notifiable);
  }
  public toDatabase(_notifiable: NotifiableModel): DatabaseNotificationData {
    return { title: "Welcome to chavaJs!", body: "Your account is ready." };
  }
}
```

Send with `Notification.send(user, notification)` or the notifiable's own
method — `user.notify(new WelcomeNotification())`. Models gain the
`Notifiable` API through the mixin: `user.notifications()`,
`user.unreadNotifications()`, `notification.markAsRead()`. The `database`
channel stores into the `notifications` table (morph-related to the notifiable
model); the `mail` channel forwards to the mail system. The reference app
wires a full inbox at `/notifications` with mark-as-read + "mark all read",
and `HandleInertiaRequests` shares the unread count as
`auth.unreadNotifications` for the nav badge.

### Scheduling

`routes/console.ts` declares scheduled tasks with Laravel's API:

```ts
import { Schedule } from "../src/facades";

Schedule.command("chava route:list").everyMinute();
Schedule.job(new SendWelcomeEmailJob(1)).hourly();
Schedule.call(cleanupExpiredSessions)
  .between("01:00", "05:00")
  .dailyAt("03:00");
Schedule.call(backup).weeklyOn(0, "02:30"); // Sunday 02:30
Schedule.call(report).cron("0 */2 * * *"); // every 2 hours
```

**Frequencies** — `everyMinute`, `everyTwoMinutes`, `everyFiveMinutes`,
`everyTenMinutes`, `everyFifteenMinutes`, `everyThirtyMinutes`, `hourly`,
`hourlyAt(n)`, `daily`, `dailyAt('HH:MM')`, `twiceDaily(1, 13)`, `weekly`,
`weeklyOn(day, time)`, `monthly`, `monthlyOn(day, time)`, `yearly`, plus
`.timezone(tz)` and `.between('05:00', '10:00')` windows.

Run due tasks (put this on a system cron every minute):

```bash
js schedule:run     # run everything due right now
js schedule:list    # show every task + its cron expression
```

### Events, queues, mail & notifications, end to end

Registering a user dispatches an event; an auto-discovered, queued listener
sends a welcome notification through the mail + database channels:

```ts
// app/Events/UserRegistered.ts
export class UserRegistered {
  public constructor(public readonly user: User) {}
}
```

```ts
// app/Listeners/SendWelcomeNotification.ts — auto-discovered by the
// `handle(event: UserRegistered)` type-hint (no manual registration).
// Extending ShouldQueue pushes handle() onto the queue (queue:work) so a
// slow or failing mail transport can never break registration.
import { ShouldQueue } from "../../src/events/queue";

export class SendWelcomeNotification extends ShouldQueue {
  public static tries = 3;

  public async handle(event: UserRegistered): Promise<void> {
    await event.user.notify(new WelcomeNotification());
  }
}
```

```ts
// app/Notifications/WelcomeNotification.ts
export class WelcomeNotification extends Notification {
  public via(): string[] {
    return ["mail", "database"];
  }
  public toMail(notifiable): Mailable {
    return new WelcomeMail(notifiable); // renders resources/views/mail/emails/welcome.html
  }
  public toDatabase(notifiable): DatabaseNotificationData {
    return { title: "Welcome to chavaJs!", body: "Your account is ready." };
  }
}
```

```ts
// app/Jobs/SendWelcomeEmailJob.ts — dispatched with `Queue.push(...)`
export class SendWelcomeEmailJob extends Job {
  public constructor(public readonly userId: number) {
    super();
  }
  public async handle(): Promise<void> {
    const user = await User.findOrFail(this.userId); // models are re-fetched
    await Mail.send(new WelcomeMail(user));
  }
}
```

```ts
// routes/console.ts — Laravel's schedule API, ported
Schedule.command("chava route:list").everyMinute();
Schedule.job(new SendWelcomeEmailJob(1)).hourly();
Schedule.call(cleanup).between("01:00", "05:00").dailyAt("03:00");
```

```bash
QUEUE_CONNECTION=database js queue:work --once  # process one job
js schedule:run                                  # run due tasks
js schedule:list                                 # list all tasks
```

---

## Frontend (Inertia + React)

chavaJs ships with an **Inertia server adapter** (the React
`@inertiajs/react` client is a peer dependency of every new app), so you build
SPA-style pages in React while keeping Laravel-style server routing, auth, and
data. There is no separate API layer to build for pages.

### The Inertia server adapter

```ts
// app/Http/Controllers/HomeController.ts
import { Inertia } from "../../src/facades";

export class HomeController {
  public index() {
    return Inertia.render("Home", { title: "Welcome" });
  }
}
```

`Inertia.render(component, props)` returns a `Response` that implements the
full Inertia protocol:

- **X-Inertia requests** → the JSON page payload
  `{ component, props, url, version }` with the `X-Inertia: true` header.
- **Plain browser loads** → the full HTML shell with the page payload embedded
  in `#app[data-page]` and Vite-managed asset tags.
- **Versioning** — when the client's `X-Inertia-Version` doesn't match, GET
  requests return **409 + X-Inertia-Location** so the client hard-reloads.
- **Partial reloads** — `X-Inertia-Partial-Component` / `X-Inertia-Partial-Data`
  requests get only the requested props.
- **Shared props** — `Inertia.share('key', value)` (or an object) merges data
  into every response. `HandleInertiaRequests` (in the `web` middleware group)
  already shares `app` (name/env/version), `auth.user`, `auth.unreadNotifications`,
  `errors` (from session flash), and `csrf_token`.

Shared props are exposed to the client via `usePage().props`.

### The React app

`resources/js/app.tsx` bootstraps Inertia + React:

```tsx
import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";
import { AppLayout } from "./Layouts/AppLayout";

createInertiaApp({
  title: (title) => (title ? `${title} — chavaJs` : "chavaJs"),
  resolve: (name) => {
    const pages = import.meta.glob("./Pages/**/*.tsx", { eager: true });
    return pages[`./Pages/${name}.tsx`];
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <AppLayout {...props}>
        <App {...props} />
      </AppLayout>,
    );
  },
});
```

`resources/js/Pages/**/*.tsx` maps directly to the component name passed to
`Inertia.render` (`Pages/Home` → `./Pages/Home.tsx`, but chavaJs convention
drops the `Pages/` prefix: `Inertia.render('Home', …)`).

The template ships:

- `Pages/Home.tsx`, `Pages/About.tsx`, `Pages/Dashboard.tsx`
- `Pages/Auth/Login.tsx`, `Pages/Auth/Register.tsx`
- `Pages/Users/Index.tsx`, `Pages/Users/Show.tsx`
- `Pages/Notifications/Index.tsx`
- `Layouts/AppLayout.tsx` (shared chrome: nav, theme toggle, notification badge)
- `Components/ui/*` (button, card, input, label, badge), `Components/field-error.tsx`
- `hooks/use-inertia-transition.ts`, `lib/utils.ts` (`cn` helper)

### shadcn/ui, Tailwind & Motion

The scaffold is pre-themed: Tailwind (with a `tailwind.config.ts` dark-mode
class strategy) + shadcn/ui components + **Motion** (framer-motion successor)
for page transitions and field-error animations. `useForm()` submissions wire
server validation errors into shadcn `Label` + animated `FieldError` fields
(`aria-invalid`, destructive ring, Motion slide/fade). `theme-provider.tsx` /
`theme-toggle.tsx` give light/dark mode with localStorage persistence.

### Vite dev & production

- **Development** — `npm run dev` starts Vite on :5173 (auto-moved if taken);
  `HtmlRenderer` injects the React-refresh preamble, `@vite/client`, and the
  entry module pointing at the _actual_ Vite URL threaded through config.
- **Production** — `npm run build` writes hashed assets and a manifest to
  `public/build/` (`manifest.json` or `.vite/manifest.json`, the
  laravel-vite-plugin convention); `HtmlRenderer` resolves the entry's JS/CSS
  from it and emits `<link>`/`<script>` tags. Serve the app in production mode
  (see [Deployment & production](#deployment--production)).

---

## CLI reference

Run any command with `js <command>` inside an app (the `php artisan`
equivalent — it runs the app's own bundled CLI), or globally with
`chava <command>` after `npm i -g @chavajs/cli`.

> **`new` is not part of the console** — scaffolding lives in
> `@chavajs/installer`. Every app's own `bin/chava.js` (and a global
> `@chavajs/cli`) intentionally omits it.

### Every command & flag

| Command                    | Flags                                                                                                                                                                                         | Purpose                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `new <name>`               | `--database=sqlite\|postgres\|mysql`, `--auth` / `--no-auth`, `--docs` / `--no-docs`, `--package-manager=npm\|pnpm\|yarn`, `--skip-install`, `--framework <path>`, `--core-version <version>` | Scaffold a new app (provided by `@chavajs/installer`, not the console)         |
| `serve`                    | `-p, --port <port>` (default 8080), `-H, --host <host>` (default 127.0.0.1), `--no-vite`                                                                                                      | Dev server (+ Vite unless disabled); auto-moves to the next free port if taken |
| `route:list`               | —                                                                                                                                                                                             | Print the route table (method, URI, action)                                    |
| `route:cache`              | —                                                                                                                                                                                             | Cache the route table for faster boot                                          |
| `route:clear`              | —                                                                                                                                                                                             | Clear the cached route table                                                   |
| `migrate`                  | —                                                                                                                                                                                             | Run pending migrations                                                         |
| `migrate:rollback`         | —                                                                                                                                                                                             | Undo the last migration batch                                                  |
| `migrate:reset`            | —                                                                                                                                                                                             | Roll back every migration                                                      |
| `migrate:fresh`            | `--seed` (re-seed with `DatabaseSeeder` after), `--seeder <class>`                                                                                                                            | Drop all tables, re-run all migrations                                         |
| `migrate:refresh`          | `--seed` / `--seeder <class>`                                                                                                                                                                 | Roll back every migration, then re-run                                         |
| `migrate:status`           | —                                                                                                                                                                                             | List migrations + run status                                                   |
| `db:seed`                  | `--class <class>`                                                                                                                                                                             | Run the seeders (`DatabaseSeeder` by default)                                  |
| `db:wipe`                  | —                                                                                                                                                                                             | Drop all tables without re-running migrations                                  |
| `about`                    | —                                                                                                                                                                                             | Show app name, env, framework version, drivers                                 |
| `queue:work`               | `--once` (process a single job then exit)                                                                                                                                                     | Consume the queue (database/redis)                                             |
| `queue:listen`             | —                                                                                                                                                                                             | Auto-restarting worker                                                         |
| `schedule:run`             | —                                                                                                                                                                                             | Run every due scheduled task                                                   |
| `schedule:list`            | —                                                                                                                                                                                             | List scheduled tasks + cron expressions                                        |
| `tinker`                   | —                                                                                                                                                                                             | Interactive REPL (see below)                                                   |
| `make:model <name>`        | —                                                                                                                                                                                             | `app/Models/<Name>.ts`                                                         |
| `make:migration <name>`    | —                                                                                                                                                                                             | Timestamped `database/migrations/<name>.ts`                                    |
| `make:factory [name]`      | `--model <model>` (derived from the name by default)                                                                                                                                          | `database/factories/<Name>Factory.ts`                                          |
| `make:seeder [name]`       | `--class <class>`                                                                                                                                                                             | `database/seeders/<Name>Seeder.ts`                                             |
| `make:request <name>`      | —                                                                                                                                                                                             | `app/Http/Requests/<Name>Request.ts`                                           |
| `make:policy <name>`       | —                                                                                                                                                                                             | `app/Policies/<Name>Policy.ts`                                                 |
| `make:event <name>`        | —                                                                                                                                                                                             | `app/Events/<Name>Event.ts`                                                    |
| `make:listener <name>`     | —                                                                                                                                                                                             | `app/Listeners/<Name>Listener.ts`                                              |
| `make:job <name>`          | —                                                                                                                                                                                             | `app/Jobs/<Name>Job.ts`                                                        |
| `make:notification <name>` | —                                                                                                                                                                                             | `app/Notifications/<Name>Notification.ts`                                      |
| `make:mail <name>`         | —                                                                                                                                                                                             | `app/Mail/<Name>Mail.ts`                                                       |
| `make:controller <name>`   | `-r, --resource`, `-a, --api` (resource w/o create/edit views), `-i, --invokable` (single-action `__invoke`)                                                                                  | `app/Http/Controllers/<Name>Controller.ts`                                     |
| `make:middleware <name>`   | —                                                                                                                                                                                             | `app/Http/Middleware/<Name>Middleware.ts`                                      |
| `make:test <name>`         | `-u, --unit` (else feature)                                                                                                                                                                   | `tests/Unit\|Feature/<Name>Test.ts`                                            |

`chava --version` inside an app prints the framework version the app was
assembled with; the standalone `@chavajs/cli` reports its own version.
`chava --help` lists commands.

### Tinker, end to end

A Laravel-tinker-style REPL with the whole app loaded. TypeScript is stripped
per line, expressions are awaited, and models print like Laravel's tinker:

```bash
js tinker
```

```
chava> await User.count()
9
chava> user = await User.find(1)
User { id: 1, name: 'Admin User', email: 'admin@chavajs.com', … }
chava> user.posts()  # relations work too
chava> DB.table('users').where('is_admin', 1).pluck('email')
chava> exit()
```

The `DB`, `Schema`, `Config`, `Auth`, `Gate`, `Event`, `Queue`, `Mail`,
`Hash`, `Route`, `Inertia` facades and every `app/Models/*` class are bare
globals. Bare assignments (`user = ...`) persist across lines; `const`/`let`
are per-line. Like Laravel's tinker, this is a developer tool, not a
sandbox — input runs with your host privileges.

---

## Testing

### Unit & feature tests

The app ships with Vitest. Feature tests boot a fresh app against an
in-memory SQLite database and exercise the HTTP layer through
`app.serve(0)` (an ephemeral port — no port collisions):

```ts
// tests/Feature/ExampleTest.ts
import { describe, expect, it } from "vitest";
import { freshApp } from "../helpers/db";

describe("example", () => {
  it("serves a route", async () => {
    const app = await freshApp();
    const server = await app.serve(0);
    const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
    expect(res.status).toBe(200);
    await server.close();
  });
});
```

`freshApp()` re-migrates the in-memory database per test (see
`tests/helpers/db.ts`). Run with `npm test`.

### Database testing

- **SQLite (default)** — tests use `DB_DATABASE=:memory:`.
- **Postgres / MySQL** — point the test env at a running server
  (`docker-compose.test.yml` is provided); the same suite runs against each
  engine with `npm run test:postgres` / `npm run test:mysql` via the
  `scripts/run-tests-driver.mjs` driver.

### Browser tests (Playwright)

Dusk-equivalent browser specs live in `tests/Browser/`. The Playwright
`webServer` boots the app on a dedicated `database/playwright.sqlite`, so
specs never touch your dev database. The e2e server boots in **production
mode**, so run a production build first:

```bash
npx playwright install chromium   # once
npm run build                     # needed so the server can serve the built assets
npm run test:browser
```

### CI

`.github/workflows/ci.yml` runs on every push/PR:

1. `npm run typecheck`
2. the Vitest suite on **Node 18/20/22** against **SQLite, Postgres, and MySQL**
3. a production asset build
4. Playwright browser specs
5. an installer boot-check (scaffold a fresh app with the assembled CLI and
   verify it boots)

---

## Deployment & production

### Production build

```bash
npm install
npm run build          # compiles Vite assets → public/build/ (+ manifest)
js migrate
js db:seed   # only for the first deploy / seed data
```

Set in the production `.env`:

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com
```

`NODE_ENV=production` (or `APP_ENV=production`) makes the app run in
production mode: `HtmlRenderer` serves the built manifest assets instead of the
Vite dev client, and error output is terse when `APP_DEBUG=false`. Bump
`config/frontend.ts` `version` after every deploy to force Inertia clients to
hard-reload (the 409 protocol handles it).

### Process management

Boot the application server directly:

```bash
js serve --port 8080
```

`chava serve` handles `SIGINT`/`SIGTERM` cleanly (closes the HTTP server and
any child Vite process). Run it under a process manager for restarts:

```bash
# pm2
pm2 start bin/chava.js --name chava -- serve --port 8080

# systemd
# ExecStart=/usr/bin/node /srv/app/bin/chava.js serve --port 8080
```

### Background workers

Run a dedicated queue worker on a separate process/instance:

```bash
QUEUE_CONNECTION=database js queue:work
```

The worker auto-registers every job class in `app/Jobs/*.ts` at boot, so jobs
pushed by the web process rehydrate correctly. Scale workers horizontally —
each `queue:work` polls the `jobs` table (database driver) or BullMQ (redis).

Scheduled tasks need a cron entry that runs `schedule:run` every minute:

```
* * * * * cd /srv/app && js schedule:run >> /dev/null 2>&1
```

`schedule:list` prints every task's cron expression for cross-checking.

### Reverse proxy & production notes

- **Proxy** — put nginx/Caddy in front and terminate TLS; forward `Host` and
  `X-Forwarded-*` headers (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`).
- **Cookies** — behind HTTPS, set `SESSION_SECURE=true` and
  `SESSION_SAME_SITE=lax` in production.
- **Static assets** — `public/` is served by the app in production; you can
  also offload `/build/*` to the proxy/CDN for cache-busting (hashed filenames
  are immutable).
- **Scaling** — the app server is stateless between requests except for the
  `file` session driver and local storage; for multi-instance deploys use the
  `array`/external session driver story or stick with a single instance + a
  shared worker tier. Databases (Postgres/MySQL) and Redis are the
  horizontally scalable pieces.

---

## Laravel → chavaJs cheat-sheet

| Laravel (PHP)                                            | chavaJs (TS)                                          |
| -------------------------------------------------------- | ----------------------------------------------------- | --------------------------------- | ---------- |
| `Route::get('/users', [UserController::class, 'index'])` | `Route.get('/users', [UserController, 'index'])`      |
| `Route::resource('users', UserController::class)`        | `Route.resource('users', UserController)`             |
| `Route::middleware('auth')->group(…)`                    | `Route.middleware('auth').group(…)`                   |
| `Inertia::render('Pages/Home', ['users' => $users])`     | `Inertia.render('Home', { users })`                   |
| `config('app.name')`                                     | `Config.get('app.name')`                              |
| `env('APP_ENV')`                                         | `Env.get('APP_ENV')`                                  |
| `app()->bind('x', fn () => new X)`                       | `app.bind('x', () => new X())`                        |
| `$request->input('name')` / `only(['a'])`                | `request.input('name')` / `request.only('a')`         |
| `bootstrap/app.php`                                      | `bootstrap/app.ts`                                    |
| `php artisan serve`                                      | `chava serve`                                         |
| `php artisan route:list`                                 | `chava route:list`                                    |
| `php artisan migrate`                                    | `chava migrate`                                       |
| `php artisan db:seed`                                    | `chava db:seed`                                       |
| `php artisan make:model`                                 | `chava make:model`                                    |
| `User::find(1)` / `User::where('email', $e)`             | `User.find(1)` / `User.where('email', e)`             |
| `$user->posts` (relation property)                       | `user.posts` (after `with('posts')`)                  |
| `User::with('posts')->get()`                             | `User.with('posts').get()`                            |
| `Schema::create('users', fn ($table) => …)`              | `Schema.create('users', (table) => …)`                |
| `UserFactory::new()->count(10)->create()`                | `UserFactory.new().count(10).create()`                |
| `Validator::make($d, ['e' => 'required                   | email'])`                                             | `Validator.make(d, { e: 'required | email' })` |
| `Auth::attempt([...])` / `Auth::user()`                  | `Auth.attempt({...})` / `request.user()`              |
| `$user->can('delete', $post)`                            | `user.can('delete', post)`                            |
| `Gate::policy(User::class, UserPolicy::class)`           | `Gate.policy(User, UserPolicy)`                       |
| `Auth::login($user)`                                     | `Auth.login(user)` (SessionGuard)                     |
| `php artisan make:request` / `make:policy`               | `chava make:request` / `make:policy`                  |
| `Event::dispatch(new UserRegistered($user))`             | `Event.dispatch(new UserRegistered(user))`            |
| `$user->notify(new WelcomeNotification())`               | `user.notify(new WelcomeNotification())`              |
| `$user->unreadNotifications()`                           | `user.unreadNotifications()`                          |
| `Mail::to($x)->send(new WelcomeMail($u))`                | `Mail.to(x).send(new WelcomeMail(u))`                 |
| `Queue::push(new SendWelcomeEmailJob($id))`              | `Queue.push(new SendWelcomeEmailJob(id))`             |
| `Schedule::command('x')->daily()`                        | `Schedule.command('chava route:list').daily()`        |
| `php artisan queue:work` / `schedule:run`                | `chava queue:work` / `chava schedule:run`             |
| `php artisan make:notification` / `make:mail`            | `chava make:notification` / `chava make:mail`         |
| `php artisan make:controller --resource`                 | `chava make:controller PostController --resource`     |
| `php artisan make:middleware` / `make:test --unit`       | `chava make:middleware` / `chava make:test --unit`    |
| `php artisan make:factory --model=User`                  | `chava make:factory --model=User`                     |
| `php artisan tinker`                                     | `chava tinker`                                        |
| `php artisan queue:listen`                               | `chava queue:listen`                                  |
| `Route::get('/x', InvokableController::class)`           | `Route.get('/x', InvokableController)` (`__invoke`)   |
| `Storage::disk('local')->put('f.txt', $c)`              | `Storage.disk('local').put('f.txt', c)`               |
| `__('welcome', ['name' => 'John'])`                      | `await __('welcome', { name: 'John' })`              |
| `Route::cache()` / `Route::clear()`                     | `chava route:cache` / `chava route:clear`             |
| Listener implements `ShouldQueue`                        | `class X extends ShouldQueue` (runs as a queued job)  |
| `$user->notifications` inbox + `markAsRead()`            | `/notifications` page + `markAsRead()`                |
| `Hash::make($pw)` / `Hash::check($pw, $h)`               | `Hash.make(pw)` / `Hash.check(pw, h)` (scrypt)        |
| `Gate::define('x', fn) / Gate::authorize('x')`           | `Gate.define('x', fn) / Gate.authorize('x')`          |
| `$request->validate([...])`                              | `await request.validate({...})`                       |
| `$request->bearerToken()`                                | `request.bearerToken()`                               |
| `Response::json($x)`                                     | `Response.json(x)`                                    |
| `->withErrors([...])`                                    | `request.back().withErrors({...})`                    |
| `->where('id', '[0-9]+')`                                | `Route.get('/users/{id}', …).where({ id: '[0-9]+' })` |
| `Route::middleware('can:delete,users')`                  | `Route…middleware('can:delete,users')`                |

See **[PARITY.md](./PARITY.md)** for the full feature-by-feature mapping and
status, and **[ROADMAP.md](./ROADMAP.md)** for the long-term plan.

## License

MIT
