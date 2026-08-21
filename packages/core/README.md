# @chavajs/core

**The chavaJs framework** — the Laravel-equivalent full-stack framework for
Node.js, in pure TypeScript. This package is the *framework distribution*.

chavaJs replicates Laravel's architecture, conventions, and developer
experience: the service container + facades, Eloquent-equivalent ORM,
router/middleware pipeline, validation, sessions + CSRF, auth, events, queues,
mail, notifications, scheduling, an Inertia + React frontend — no PHP anywhere.

> **Port the concepts, not the syntax.** Where Laravel uses PHP magic
> (macros, magic methods, static facades), chavaJs replicates the
> developer-facing behavior with idiomatic JavaScript: Proxies, ES modules,
> and a dependency-injection container.

## How apps consume it

Applications are **assembled copies**, not npm consumers: `chava new` (from
[`@chavajs/installer`](https://www.npmjs.com/package/@chavajs/installer))
downloads this package and merges it into the app's own `src/` + `bin/`,
alongside the starter template. A scaffolded app therefore bundles its
framework and never needs `@chavajs/core` as a runtime dependency — the same
model Laravel apps use with `vendor/`.

```bash
npm i -g @chavajs/installer
chava new blog
cd blog
js migrate
npm run dev          # → http://localhost:8080
```

## What's inside the package

```
bin/chava.js        # the chava console CLI (Artisan equivalent)
src/                # the assembled framework
├── foundation/     #   Application, container, request context
├── http/           #   router, middleware, request, response
├── orm/            #   Model, Factory, relations
├── database/       #   query builder, schema, migrations, seeders
├── auth/           #   guards, gate, hash, policies
├── validation/     #   Validator + FormRequest
├── session/  queue/  mail/  notifications/  events/  scheduling/
├── inertia/        #   the Inertia server adapter
├── cli/            #   the console command implementations
└── facades.ts      #   Route, Inertia, DB, Auth, … singletons
template/           # the starter app template used by the installer
```

## Feature highlights

- **Service container** — automatic constructor injection, `bind` /
  `singleton` / `instance` / `alias`, `call()` method injection
- **Facades** as Proxy singletons: `Route`, `Inertia`, `Config`, `App`, `DB`,
  `Schema`, `Env`, `Auth`, `Hash`, `Gate`, `Session`, `Event`, `Queue`,
  `Mail`, `Notification`, `Schedule`
- **Router** — `Route.get()`, `.post()`, `.resource()`, `.group()`, named
  routes, optional params, `where()` constraints, route model binding, 404/405
- **Eloquent-equivalent ORM** — migrations + Blueprint schema builder, Active
  Record `Model` (casts, fillable, timestamps, soft deletes, events),
  relationships with eager loading, fluent query builder, Faker factories,
  seeders
- **Validation** — Laravel-style rule strings (`'required|email|max:255'`),
  `unique` / `confirmed` / `exists` / `regex`, Form Request classes
- **Sessions + CSRF** — signed cookies, flash data, Laravel-exact CSRF
- **Auth** — session guards, Sanctum-style personal access tokens, `Hash`
  (scrypt), gates + policies, `auth` / `guest` / `verified` / `can:` middleware
- **Events, queues, mail, notifications, scheduling** — auto-discovered
  listeners, `sync`/`database`/`redis` (BullMQ) queue drivers, mail transports
  via Nodemailer, Blade-style email templates
- **Inertia + React** — full server adapter protocol (versioning, partial
  reloads, shared props) powering the scaffolded shadcn/ui frontend
- **Console CLI** — `serve`, `route:list`, `migrate*`, `db:seed`, `make:*`
  generators, `queue:work`, `queue:listen`, `schedule:run`/`list`, `tinker`

## Requirements

- Node.js ≥ 18.17
- Database drivers (optional peer dependencies): `pg` for Postgres, `mysql2`
  for MySQL, `ioredis` for Redis queues, `bullmq` for Redis queue backend,
  `nodemailer` for SMTP mail. SQLite is built in.

## Related packages

- `@chavajs/installer` — the `chava new` scaffolding command
  (downloads this package at scaffold time).
- `@chavajs/cli` — the console CLI, distributed standalone
  (this package already carries it as `bin/` + `src/cli/`).

## License

MIT