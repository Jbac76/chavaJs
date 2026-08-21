# Changelog

All notable changes to chavaJs are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0-rc.1] — 2026-08-10 — Monorepo repair: packages split + working reference app

### Changed

**The framework is split into a monorepo, and apps consume it by assembly.**
- `packages/core` (`@chavajs/core`), `packages/cli` (`@chavajs/cli`) and
  `packages/inertia-react` (`@chavajs/inertia-react`) are now real packages
  with `package.json` metadata. The reference app (`examples/starter`) and
  freshly scaffolded apps embed the framework as `src/` + `bin/`, assembled
  from the packages — exactly what the installer does for new apps.
- `scripts/assemble-framework.mjs` merges `packages/*/src` (+ cli `bin`) into
  an app's `src/` and `bin/`. `npm run assemble` regenerates
  `examples/starter`. The canonical framework source is `packages/*/src`, not
  the assembled copies.
- Root `package.json` now has npm workspaces and delegates `typecheck` /
  `test` / `build` / `test:browser` / `test:postgres` / `test:mysql` to the
  assembled reference app.

**Repaired a broken intermediate migration.** The pre-rc.1 structure was a
half-finished split: packages lacked `package.json`, `examples/starter` had no
`package.json`/`src`/`bin`, `packages/cli` and `packages/inertia-react` imports
still pointed at the old flat layout, and root scripts/CI could not run. All of
that is fixed — typecheck, the Vitest suite (208 tests) and the Playwright
browser spec are green again.

### Added

- **`create-chava-app` now assembles the framework from `packages/*`** instead
  of copying a monolithic `src/`. Scaffold → typecheck → migrate → seed →
  boot verified end-to-end. `--no-auth` now actually swaps in the auth-free
  routes (`routes/web.noauth.ts`) and strips the auth UI.
- **Missing `Inertia` facade restored** in `src/facades.ts`, and
  `InertiaServiceProvider` is registered again in `Application` — both were
  dropped during the split.
- **Vite 6 manifest handling** — the HTML renderer now reads the manifest from
  `public/build/manifest.json` *or* the Vite 6 `.vite/manifest.json` location,
  so production asset lookup works on current Vite.
- **Playwright e2e server boots in production mode** (`APP_ENV=production`) so
  the browser spec exercises the built assets, not a missing Vite dev server.
- **CI**: `.github/workflows/ci.yml` now runs typecheck + Vitest (SQLite) +
  production build, a Postgres/MySQL matrix via `services:`, the Playwright
  browser suite, and a `create-chava-app` scaffold → typecheck → migrate →
  seed → boot check.
- **Community + repo files**: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md` moved to the repo root; `.github/ISSUE_TEMPLATE/*` and
  `.github/PULL_REQUEST_TEMPLATE.md` added; `ROADMAP.md` added.

### Fixed

- `packages/cli/bin/chava.js` no longer references its own nonexistent path
  (works from the assembled app via `src/cli`).
- Root `.gitignore` covers the assembled framework copies and storage so the
  packages stay the single source of truth.

## [0.7.0] — 2026-08-09 — Renamed to chavaJs + Phase 8: installer, browser tests, CI

### Changed

**The framework is now chavaJs** (was Lumen.js)
- The CLI is `chava` (`bin/chava.js`): `chava serve`, `chava make:model`,
  `chava tinker`, `chava new`, …
- The brand, package name (`chavajs`), session cookie (`chava_session`),
  mail log file, tinker prompt (`chava> `), event serialization markers
  (`__chava_model` / `__chava_date`), and the `CHAVA_SESSION_KEY` env var
  were all renamed — 70+ files, zero `lumen` references remain

### Added (Phase 8)

**`chava new <name>`** — the Laravel Installer equivalent
- Copies the framework into a fresh directory, skipping `node_modules`,
  `.git`, `storage`, `public/build`, the dev database and the lockfile
- Renames the package, regenerates `.env` from `.env.example`, and creates
  the `storage/{logs,framework/*}` layout with `.gitkeep` files
- The copy is a manual directory walk (not `cpSync`), so the destination
  may live inside the source, and locked files are warned-and-skipped

**Playwright browser tests** (Dusk-equivalent)
- `playwright.config.ts` + `tests/Browser/auth.spec.ts`: registers through
  the real UI, lands on the dashboard, opens the inbox, and marks the
  welcome notification read
- A webServer script boots the app on a dedicated `playwright.sqlite`
  database (migrate + seed + serve on :4173), so specs never touch dev data
- `npm run test:browser` (after `npx playwright install chromium`)

**GitHub Actions CI** (`.github/workflows/ci.yml`)
- Typecheck, unit/feature tests, and production build on every push/PR,
  plus a Playwright browser job

**Testing**
- Scaffold unit tests (tree exclusions, package rename, `.env`
  regeneration, storage layout) + the passing browser spec

## [0.6.0] — 2026-08-09 — Phase 7: notification inbox + form polish + Motion

### Added

**Notification inbox (database channel)**
- `NotificationController` (`index` / `markRead` / `markAllRead`) + routes in
  `routes/web.ts` — read and unread notifications for the signed-in user,
  built entirely on the Notifiable API (`unreadNotifications()`,
  `markAsRead()`, `markAllAsRead()`)
- Inertia page `resources/js/Pages/Notifications/Index.tsx`: unread badge,
  relative timestamps, deep links, per-item **Mark read** (optimistic exit
  animation) and **Mark all as read** via `useForm`, with server errors
  surfaced in an animated banner
- Ownership-checked: marking another user's notification as read is a 403
  (`AuthorizationException`), never a silent no-op
- `HandleInertiaRequests` now shares `auth.unreadNotifications`, powering an
  animated **Inbox** nav badge (spring pop on count change)

**shadcn form polish (useForm errors → shadcn fields)**
- New `Label` primitive and an animated `FieldError` component
  (`AnimatePresence` slide/fade + `role="alert"`)
- Login/Register rebuilt on them: `Label` + `FieldError` + `aria-invalid`
  + destructive ring on invalid fields, Motion submit buttons
  (`whileTap` / `whileHover`)

**Richer Motion**
- Notification list stagger + `AnimatePresence` exit (items glide out as
  they're marked read), spring-pop unread counts, form-error transitions

**Testing**
- 4 inbox feature tests (list as unread, single mark-read, ownership 403,
  mark-all) — full suite green

## [0.5.1] — 2026-08-09 — ShouldQueue listeners + generator polish

### Added

**ShouldQueue listeners (Laravel's ShouldQueue contract, ported)**
- A listener extending `ShouldQueue` (`src/events/queue.ts`) is dispatched
  as a `CallQueuedListener` job instead of running inside the request — a
  slow or failing mail transport can never break registration
- Events are serialized Laravel-style: model instances become
  `{ class, key }` markers (SerializesModels) and are re-fetched when the
  job runs; `Date`s become ISO markers; nested payloads round-trip
- The listener's static `connection` / `queue` / `delay` / `tries` config
  is honoured (`queue:work --tries` still overrides); the `sync` connection
  runs the job inline
- `queue:work` auto-registers `CallQueuedListener`, so a separate worker
  process rehydrates queued listeners (models re-fetched from its DB)
- `SendWelcomeNotification` now extends `ShouldQueue` (the demo app);
  `make:listener` stubs hint at the pattern

**`make:factory` / `make:seeder` polish**
- `chava make:factory --model=User` (the name becomes optional; defaults to
  `{Model}Factory`) and the generated factory has a faker-driven definition
  skeleton (`faker.person.fullName()`, …) ready to uncomment
- `chava make:seeder` accepts a name or `--class`, and its stub shows
  commented `UserFactory` / `User.create` examples

**Shared generator helpers**
- New `src/cli/helpers/generators.ts` consolidates the duplicated `write` /
  `pascal` / `snake` / `pluralize` / `timestamp` helpers (plus a new
  `classWithSuffix`) previously copy-pasted across make.ts / make-more.ts /
  make-more2.ts — one import for every generator

**Testing**
- 9 new tests: queued-events unit suite (serialization round-trip,
  dispatch-to-queue routing, worker processing, static config, sync
  fallback), a register → queued job → worker delivery feature test, factory
  / seeder stub shapes, and the naming helpers — full suite green

### Fixed

- `make-more.ts`'s `write()` printed Windows paths with backslashes (its
  `replaceAll` searched for two literal backslashes) — consolidated into the
  shared helper which normalizes to `/`

## [0.5.0] — 2026-08-09 — Phase 6: the rest of the `chava` CLI

### Added

**`chava tinker`** — a Laravel tinker REPL with the application loaded
- TypeScript is stripped per line (`typescript.transpileModule`) and evaluated
  in a persistent vm sandbox, so state survives across lines
  (`user = await User.find(1)` then `user.name`)
- Expressions are awaited automatically; results print model-aware
  (`User { id: 1, name: 'Admin User', … }`, arrays of models, plain values)
- The app, every facade (`DB`, `Schema`, `Config`, `Auth`, `Gate`, `Event`,
  `Queue`, `Mail`, `Hash`, `Route`, `Inertia`, …) and every `app/Models/*`
  class are available as bare globals; `exit()` / `.exit` to leave
- Lines are queued internally so piped (non-TTY) input evaluates in order
  without racing slow async calls

**`make:*` generators** (stub-based, following Laravel's shapes)
- `chava make:controller` — plain, `--resource` (all 7 methods, plural
  collection paths + singular `{model}` param), `--api` (no create/edit),
  and `--invokable` (single-action `__invoke`)
- `chava make:middleware` — `handle(request, next)` class in
  `app/Http/Middleware/` with a commented example guard
- `chava make:test` — Feature test (default, with `freshApp`) or `--unit`

**`chava queue:listen`** — Laravel-style queue supervisor
- Spawns a fresh `queue:work --once` worker per batch, so changed job code
  is picked up without restarting (the point of `queue:listen` vs the
  long-running `queue:work`)
- Options: `--connection`, `--queue`, `--tries`, `--sleep`; the worker argv
  builder is exported and unit-tested

**Single-action controller dispatch**
- `HttpKernel` now dispatches a plain controller class by calling its
  `__invoke(request, …)` method (Laravel: `make:controller --invokable`)
  — `Route.get('/dashboard', ShowDashboard)` works

**Testing**
- 14 new tests: generator stubs (resource/api/invokable/middleware/test),
  tinker eval (expressions, TS annotations, await, state persistence,
  multi-statement blocks, error propagation), `queue:listen` argv, and an
  `__invoke` HTTP dispatch feature test — 154 total, all green

### Fixed

- The tinker eval no longer races: node:repl fires the next piped line
  immediately, so slow evaluations (DB calls) ran out of order — the eval
  now chains every line so callbacks fire in sequence
- `make:controller` resource stubs use Laravel's plural collection paths
  (`/products/{product}`), and the `update` redirect is a real template
  literal (the generated `\`/products/${product}\`` was previously a literal
  string)

## [0.4.0] — 2026-08-09 — Phase 5: events, queues, notifications, mail, scheduling

### Added

**Events**
- `Event` dispatcher with `listen()` / `dispatch()` / `once()` / `forget()`
  and class listeners auto-wired from the container
- Auto-discovery: listeners in `app/Listeners/*.ts` whose
  `handle(event: SomeEvent)` type-hints an event class are wired up at boot
  (types are erased at runtime, so the type name is read from source —
  Laravel's EventServiceProvider contract)

**Queue**
- `Job` base with `tries` / `backoff` / `timeout` / `queue` / `delay`,
  payload serialization, and rehydration (`Queue.register(JobClass)`)
- Drivers: `sync` (in-process), `database` (jobs + failed_jobs tables,
  reservation, retries with backoff, failed-jobs tracking), and optional
  `redis` (BullMQ — `npm i bullmq ioredis`)
- `chava queue:work` (with `--once`, `--stop-when-empty`, `--tries`,
  `--sleep`) — auto-discovers `app/Jobs/*` so a separate worker process can
  rehydrate serialized jobs

**Mail**
- `Mailable` base (`envelope()` / `content()`), fluent `to()/cc()/bcc()`,
  default `From` from `config/mail.ts`
- Drivers: `log` (writes `storage/logs/chava-mail.log`), `array` (test
  collection via `Mail.sent()`), and optional `smtp` (Nodemailer —
  `npm i nodemailer`)
- `Mail.to(...).cc(...).send(mailable)` recipient chains (chain wins over
  the envelope `to`)
- Blade-style template renderer (`{{ }}` escaped, `{!! !!}` raw, `@if`,
  `@each`) with views in `resources/views/mail/*.html`

**Notifications**
- `Notification` base (`via()`, `toMail()`, `toDatabase()`) with `mail` and
  `database` channels; broadcast channel planned
- `Notifiable` base class: `notify()`, `notifications()`,
  `unreadNotifications()`, `markAllAsRead()` (morph-relationed to a
  `notifications` table with JSON `data`)

**Scheduling**
- Fluent scheduler: `everyMinute`, `everyFiveMinutes`, `hourlyAt`,
  `dailyAt`, `twiceDaily`, `weeklyOn`, `monthly`, `between()`, `timezone()`,
  `cron()`; tasks registered in `routes/console.ts` (Laravel's
  `routes/console.php`)
- `chava schedule:run` + `chava schedule:list`; cron matcher with steps,
  ranges and lists

**App wiring (the end-to-end demo)**
- `UserRegistered` event dispatched on register → auto-discovered
  `SendWelcomeNotification` listener → `WelcomeNotification` via `mail` +
  `database` channels → `WelcomeMail` (view template) + a notification row
- `SendWelcomeEmailJob` (queued, re-retrieves the user in `handle()`),
  `chava make:event/listener/job/notification/mail` generators
- `jobs` / `failed_jobs` / `notifications` migrations; `.env.example` queue
  + mail settings

**Testing**
- 26 new tests: event dispatcher (incl. auto-discovery), queue drivers
  (sync, database, delays, retries → failed_jobs), notifications
  (morph relation, read/unread), mail (array driver, chains, template
  renderer), scheduler (cron, frequency API, between windows), a register →
  notification → mail feature test — 139 total, all green

### Fixed

- `Event.listen(SomeClass, …)` now keys listeners by the class name
  (previously `event.constructor.name` on a class resolved to `Function`)
- Class listeners are constructed via the container before `handle()` is
  called (a class is a function, so it was previously invoked bare)
- Cron matcher now supports bare-asterisk steps (`*/5`)
- The mail template renderer evaluates `@each`/`@if` bodies before `{{ }}`
  so loop variables resolve (previously loop bodies rendered `undefined`)
- `DatabaseNotification.data()` method removed — the `data` column shadows
  it (Laravel accesses it as the casted `$notification->data` attribute)
- Mail recipient chains no longer duplicate the envelope `to` — chain
  recipients replace it (cc/bcc still append)

### Fixed (code review pass)

- `chava queue:work --tries N` now actually caps attempts: the effective
  tries is passed into `DatabaseDriver.fail()` instead of being re-derived
  from the serialized payload (which always carried the job's original value)
- Event auto-discovery is guarded by a single shared promise, so concurrent
  first dispatches can't race discovery and miss listeners; the `handle()`
  type-hint scan is line-anchored so comments can't trigger bindings
- Removed dead `fromQueue`/`replyToQueue` fields from `Mailable` (never
  assigned; they leaked `undefined` entries into template view data)
- Cron `*/n` day-of-week steps now check Sunday as both `0` and `7`, so the
  normalization can't flip the modulo result
- `Schedule.command()` spawns a quoted command line on Windows (the node
  path was losing its quotes and cmd tried to run `C:\Program`) and strips
  the leading `chava` token (the command string is Laravel-style)
- `PARITY.md` documents the config-once-per-process deviation

## [0.3.0] — 2026-08-09 — Phase 4: validation, sessions, and auth

### Added

**Validation**
- Laravel-style `Validator.make(data, rules, messages)` with pipe-delimited
  rule strings: `required`, `email`, `max:255`, `min`, `string`, `numeric`,
  `integer`, `boolean`, `date`, `confirmed`, `unique:table,column`,
  `exists:table,column`, `regex`, `sometimes`, `nullable`, custom rules
- `FormRequest` base with `rules()`, `authorize()`, `messages()`; validated
  data + authorization wired into controllers via method injection
- `ValidationException` (422 JSON / redirect-back with flashed errors)

**Sessions**
- `SessionStore` port: flash data, `old()` input, CSRF token, regeneration,
  `_previous_url`; file + array drivers behind `config/session.ts`
- `StartSession` middleware (load → run → save, cookie survives exceptions)
- Signed session cookies (HMAC over the session id) with `lifetime`/`httpOnly`/
  `sameSite`/`secure` config
- `VerifyCsrfToken` with Laravel's exact token sources: `_token` input,
  `X-CSRF-TOKEN` header, or `X-XSRF-TOKEN` header (echoed from the
  `XSRF-TOKEN` cookie Inertia's axios client sends); 419 on mismatch

**Auth**
- `Hash` (scrypt) with `make()` / `check()`
- `SessionGuard` (login, logout, remember via session) + `TokenGuard`
  (Sanctum-style personal access tokens, sha256-hashed, expiry support)
- `AuthManager` with per-request guards and multiple providers
  (`config/auth.ts`)
- Gates + Policies: `Gate.define()`, `before()`, policy classes with
  auto-method mapping, `user.can()`, `request.user().can()`, 403 on denial
- Middleware: `Authenticate` (`auth` / `auth:api`), `RedirectIfAuthenticated`
  (`guest`), `EnsureEmailIsVerified` (`verified`), `Can` (`can:ability,param`)

**Request/controller surface**
- `request.validate()`, `request.user()`, `request.session()`, `request.is()`
- `Controller.authorize()`, `request.user().can()`

**App wiring**
- `User` model: `can()`/`cannot()`, `createToken()`/`tokens()`, hidden
  password, casts; `PersonalAccessToken` model + migration
- `UserPolicy` (admin-only delete, self-delete allowed); `AuthController`
  (login/register/logout), `DashboardController`, `ApiController`
  (issue + consume tokens); `LoginRequest`/`RegisterRequest` Form Requests
- Seeder now hashes passwords (demo accounts `admin@chava.dev` /
  `member@chava.dev`, password `password`)
- `chava make:request` + `make:policy` generators

**Frontend**
- Login / Register / Dashboard Inertia pages (shadcn forms, Motion
  transitions, shared `auth.user` / `errors` / `csrf_token` props)
- Auth-aware nav (Dashboard/Logout for users, Login/Register for guests),
  policy-gated delete button on the users list

**Testing**
- 39 new tests: validator, hash, gate, auth guards + full HTTP feature tests
  (register/login/logout, duplicate email, CSRF 419, XSRF cookie flow, API
  token issue + consume, policy 403/302) — 112 total, all green

### Fixed

- `BelongsTo` eager loading now collects keys from the parent's foreign key
  (e.g. `user_id`), not the parent id — token → user loading returned null
- CSRF for Inertia forms now works in the browser: the framework sets the
  `XSRF-TOKEN` cookie (like Laravel Breeze) and accepts the `X-XSRF-TOKEN`
  header; the `csrf-token` meta tag is no longer emitted (matches Breeze,
  per the Inertia docs)
- `Migrator.dropAllTables` disables SQLite foreign keys during the drop pass
  (`migrate:fresh` no longer fails with a FOREIGN KEY constraint error)
- Session flash data is aged on load only (Laravel semantics) so errors
  flashed for the next request survive exactly one round trip
- The API token endpoint runs under the session middleware, so token
  issuance works over cookie sessions
- The feature-test helper uses `getSetCookie()` (two cookies are now set per
  response), and the seeder creates a known `member@chava.dev` account
- **Session fixation protection**: login/logout now call `session.migrate(true)`
  (Laravel semantics), rotating the session id AND the CSRF token — the
  previous code only regenerated the id, leaving the pre-login token valid
- Exception responses (403/404/422/500) now carry the session cookie —
  previously only the validation-redirect path re-attached it, so a 403 or
  500 after a token rotation left the client with a stale cookie

## [0.2.0] — 2026-08-09 — Phase 3: the Eloquent-equivalent ORM

### Added

**Database layer**
- `Connection` seam + `SQLiteConnection` built on Node's built-in `node:sqlite`
  (zero native dependencies), with `DatabaseManager` (`DB.table(...)`) and
  `config/database.ts`
- Query builder with Eloquent's full fluent surface: `where`/`orWhere`/`whereIn`/
  `whereNull`/`whereBetween`/`whereColumn`/nested closures/joins/`groupBy`+
  `having`/`orderBy`/`limit`/`paginate`/`chunk`/aggregates/`insert`/`update`/
  `delete`, compiled to parameterized SQL
- Schema builder: Blueprint API (`id`, `string`, `text`, `boolean`, `decimal`,
  `enum`, `foreignId()->constrained()`, `timestamps()`, `softDeletes()`, …),
  SQLite grammar, `Schema.create/table/drop/hasTable/hasColumn`
- `Migrator`: `up()`/`down()` migration files with batch tracking, transactions,
  and `migrate` / `migrate:rollback` / `migrate:fresh` / `migrate:status`

**ORM (Eloquent-equivalent)**
- Active Record `Model`: direct attribute access, `fillable`/`guarded`, casts,
  timestamps, soft deletes (+ `withTrashed`/`onlyTrashed` scopes), dirty
  tracking, accessors/mutators (`getXAttribute`/`setXAttribute`), model events
  and observers, `firstOrCreate`/`updateOrCreate`, static query passthroughs
- Relationships: `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` (with pivot
  hydration), `hasManyThrough`, `morphMany`, `morphTo`; eager loading via
  `with()` (nested) and lazy `load()`
- `Factory` (Faker) with `new()`, `count()`, `state()`, `for()`, `make()`,
  `create()`, `createMany()`; `Seeder` base with `call()`

**App wiring + CLI**
- `User`/`Post` models, users + posts migrations, factories, and a
  `DatabaseSeeder` (8 users, 2 posts each)
- `chava make:model`, `make:migration`, `make:factory`, `make:seeder`
- Route model binding: `Route.model('user', User)` → 404 on miss
- `GET /users` (paginated, eager-loaded) and `GET /users/{user}` Inertia pages
  with Motion animations; Home page updated to feature the ORM

**Testing**
- 35 new tests: query builder, model, relations, migrator, factories + a
  seeded HTTP feature test (73 total, all green)

### Fixed

- `compileWheres` now joins clauses with `and`/`or` (consecutive `and` clauses
  previously produced invalid SQL)
- `quoteColumn` no longer quotes the `*` wildcard (`"roles".*` was invalid)
- `Model.setAttribute` installs the per-attribute accessor, so direct writes
  after `create()` (`user.name = ...`) persist correctly
- `serializeAttribute` applies casts on output (`is_admin` serializes as a
  boolean, not `1`)
- `BelongsToMany` cleans pivot columns into a `pivot` relation on direct
  `get()`/`first()`, not just eager loading
- `Migrator.fresh()` no longer fails when the `migrations` table doesn't exist
- `db:seed` accepts both default and named seeder exports
- ColumnDefinition fluent modifiers (`nullable()`, `unique()`, …) now chain on
  the column object as Laravel's do
- `withTrashed()` / `onlyTrashed()` remove only the soft-delete scope clause,
  preserving user wheres (previously every where was wiped)
- Relation fluent constraints now apply: `user.posts().where(...).get()` keeps
  the `where` (the query builder is memoized per relation, Laravel-style)
- `inRandomOrder()` emits `order by RANDOM()` instead of quoting the function
- Grouped `paginate()` totals are correct (count wraps the grouped select in a
  subquery, like Laravel)

## [0.1.0] — 2026-08-09 — Phase 1 + Phase 2 skeleton

The first working increment: the framework foundation and a bootable full-stack
"hello world" proving the whole stack end-to-end.

### Added

**Foundation**
- `Application` with Laravel 11-style `bootstrap/app.ts` configuration
- Service container (`bind` / `singleton` / `instance` / `alias` / `make` /
  `call`) with automatic constructor resolution by parameter name
- Proxy-based facades: `Route`, `Inertia`, `Config`, `App`, plus `Env`
- `config/*.ts` files + dotenv `.env` loading with dot-notation access
- `ServiceProvider` lifecycle (`register()` / async `boot()`)

**HTTP**
- Router: `get/post/put/patch/delete/options/any/match`, `resource()`
  (7 routes + names), `group()`, prefixes, named routes, optional params,
  `where()` constraints, 404/405 handling
- Middleware pipeline with global / group / route middleware
  (`handle(request, next)`), `web` and `api` groups
- `Request` wrapper (`input()`, `only()`, `except()`, cookies, headers,
  `expectsJson()`, `_method` spoofing, bearer tokens)
- `Response` wrapper (JSON/HTML/redirects/cookies), controller dispatch with
  method injection
- Static asset serving from `public/`

**Inertia adapter**
- `Inertia.render()` with the full protocol: JSON payloads, 409 + 
  `X-Inertia-Location` versioning, partial-reload props, shared props
- `HandleInertiaRequests` middleware
- HTML shell renderer with Vite dev-server injection (HMR) and production
  manifest resolution

**CLI**
- `chava serve` (auto-starts the Vite dev server in local env)
- `chava route:list`

**Frontend**
- Inertia React app (`resources/js/app.tsx`) with Breeze-style layout
- Tailwind + shadcn/ui theming (Laravel-red token system, class dark mode),
  `components.json` configured
- shadcn primitives: Button, Card, Input, Badge; theme toggle (next-themes)
- Motion page transitions via `useInertiaTransition()`
- Home + About pages demonstrating server → client data flow

**Testing & docs**
- Vitest suite: container, config, router, request unit tests + HTTP feature
  tests (36 tests)
- `PARITY.md` (Laravel → chavaJs mapping), README, this changelog

### Fixed

- Async controller methods now resolve correctly (`HttpKernel.dispatch` awaits
  `app.call(...)`); previously an `async index()` would have been serialized
  as an empty object.
- The container no longer throws for constructor parameters that have a
  default value or are optional.
- The static file server path-traversal guard now uses a separator-bounded
  check, so sibling directories can never escape `public/`.
- The Inertia page layout is applied the way Laravel Breeze does it (a wrapper
  returning the layout element), fixing `usePage` inside layouts.
- `chava route:list` shows the root route as `/`.

### Commands

```bash
npm install
npm run dev        # chava serve + Vite dev server (hot reload)
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit && vite build (production assets)
```
