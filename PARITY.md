# Laravel → chavaJs Parity Map

Every Laravel concept mapped to its chavaJs equivalent, its status, and any
deliberate deviations. Statuses: `planned` · `in-progress` · `done` · `wontfix`.

---

## Phase 1 — Foundation & Service Container

| Laravel | chavaJs | Status | Notes |
| --- | --- | --- | --- |
| `bootstrap/app.php` | `bootstrap/app.ts` | `done` | `Application.configure({ providers, webMiddleware, … })` |
| `Illuminate\Container\Container` | `src/container/Container.ts` | `done` | `bind` / `singleton` / `instance` / `alias` / `make` / `call` |
| Automatic constructor resolution | `make(Class)` auto-wiring | `done` | TypeScript types are erased at runtime, so we resolve **constructor parameters by name** (`constructor(config: Config)` → binding `config`) — the same strategy Angular 1 used. Explicit `@inject()` decorator support is `planned`. |
| Service providers (`register()` / `boot()`) | `src/container/ServiceProvider.ts` | `done` | `boot()` is async |
| Facades (`Cache::get()`, `DB::table()`) | Proxy-based facades (`src/container/Facade.ts`) | `done` | `Route.get()`, `Inertia.render()`, `Config.get()` — see `src/facades.ts`. Real facades, not magic methods. |
| `config/*.php` + `env()` | `config/*.ts` + `Env.get()` | `done` | Dotenv-backed `.env` loading; `Config.get('app.name')` |
| Contextual bindings (`when(…)->needs(…)`) | `container.when(X).needs('y').give(z)` | `done` | `ContextualBindingBuilder` in `src/container/Container.ts`; resolves constructor params by name against the contextual table |
| `App::basePath()` etc. | `app.path()`, `publicPath()`, `storagePath()` | `done` | |

## Phase 2 — Routing & HTTP

| Laravel | chavaJs | Status | Notes |
| --- | --- | --- | --- |
| `routes/web.php` / `routes/api.php` | `routes/web.ts` / `routes/api.ts` | `done` | Loaded inside `web` / `api` middleware groups by `RouteServiceProvider` |
| `Route::get/post/put/patch/delete/resource/group` | same surface on the `Route` facade | `done` | `resource()` registers the standard 7 routes + names |
| Named routes (`->name()`) | `route.name('users.index')` | `done` | |
| Route params `{id}`, optional `{id?}` | same | `done` | |
| `->where()` constraints | `route.where({ id: '[0-9]+' })` | `done` | |
| Route model binding | `Route.model('user', User)` → `{user}` resolves to a User (404 on miss) | `done` | `findOrFail` under the hood; misses become 404s |
| Middleware (`handle($request, $next)`) | `handle(request, next)` | `done` | Global / group / route-level; `handle(request, next)` exactly |
| `web` / `api` middleware groups | `groupMiddleware('web', …)` | `done` | |
| `VerifyCsrfToken` / session middleware | `StartSession` + `VerifyCsrfToken` in the `web` group | `done` | XSRF cookie + `X-XSRF-TOKEN` header flow, 419 on mismatch | |
| `Illuminate\Http\Request` | `src/http/Request.ts` | `done` | `input()`, `only()`, `except()`, `header()`, `cookie()`, `file()` (multipart), `expectsJson()`, `_method` spoofing |
| `request->validate()` | `request.validate(rules)` | `done` | Inline validation via the Validator; Form Requests for classes |
| Controllers (`index/show/create/store/edit/update/destroy`) | class-based controllers + single-action | `done` | Method injection of `request` and route params |
| 404 / 405 handling | kernel `abort()` | `done` | 405 includes `Allow` header |
| Multipart file uploads (`$request->file()`) | `src/http/multipart.ts` bundled into `Request.file()` | `done` | Dependency-free `multipart/form-data` parser; returns an `UploadedFile` (`getClientOriginalName`, `getSize`, `content`, …) |
| Route caching | — | `planned` | Lower priority than in Laravel — Node's startup cost is already small vs PHP's per-request bootstrap, so a serialized route cache buys little here |

## Phase 3 — Database & ORM (Eloquent)

| Laravel | chavaJs | Status | Notes |
| --- | --- | --- | --- |
| Schema builder + migrations (`up()` / `down()`) | `Schema.create('users', cb)` in `database/migrations/*.ts` | `done` | Full Blueprint API (`id`, `string`, `text`, `boolean`, `decimal`, `enum`, `foreignId()->constrained()`, `timestamps`, `softDeletes`, …); SQLite grammar; batch tracking in a `migrations` table |
| `DB::table()` / `DB::select()` | `DB.table('users')` | `done` | `DatabaseManager` + `Connection` seam (SQLite on `node:sqlite`, plus Postgres `pg` and MySQL `mysql2`) |
| Query builder | `src/database/query/Builder.ts` | `done` | `where` / `orWhere` / `whereIn` / `whereNull` / `whereBetween` / nested closures / joins / `groupBy` + `having` / `orderBy` / `limit` / `paginate` / `chunk` / aggregates / `insert` / `update` / `delete` / soft-delete scopes (`withTrashed`, `onlyTrashed`) |
| Active Record `Model` | `src/orm/Model.ts` | `done` | Direct attribute access (`user.name`), `$fillable`/`$guarded`, casts, timestamps, soft deletes, dirty tracking, accessors/mutators (`getXAttribute`/`setXAttribute`), events + observers |
| `User::find()` / `findOrFail()` / `create()` / `save()` / `delete()` | same surface | `done` | Static passthroughs include `firstOrCreate`, `updateOrCreate`, `paginate`, `chunk`, `pluck`, aggregates |
| Relationships | `src/orm/relations/*` | `done` | `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` (pivot + `pivot` relation), `hasManyThrough`, `morphMany`, `morphTo` |
| Eager loading (`with()`, `load()`) | same | `done` | Nested `with('posts.author')` supported |
| Model events / observers | `Model.on('created', fn)` / `Model.observe(Observer)` | `done` | `creating/created/updating/updated/saving/saved/deleting/deleted/restoring/restored` |
| Factories (Faker) | `src/orm/Factory.ts` + `database/factories/*` | `done` | `UserFactory.new().count(10).state({...}).for($user).create()` |
| Seeders | `src/database/Seeder.ts` + `database/seeders/*` | `done` | `call([...])` chaining supported |
| Transactions | `connection.transaction(fn)` | `done` | Savepoints for nesting; migrations run inside transactions |
| Schema introspection (`hasTable`, `hasColumn`) | `Schema.hasTable()`, `Schema.hasColumn()` | `done` | |
| Postgres / MySQL drivers | `PostgresConnection` / `MySQLConnection` (`src/database/connections/`) | `done` | Optional peer deps `pg` / `mysql2`; per-driver grammars (auto-increment, `ON CONFLICT` vs `ON DUPLICATE KEY`, identifier quoting, `RANDOM()` vs `RAND()`); same `Connection` interface, swap via `config/database.ts` + `.env`. Matrix-tested via `TEST_ALL_DRIVERS=1` / `docker-compose.test.yml` |

## Phase 4 — Auth, Validation, Authorization

| Laravel | chavaJs | Status | Notes |
| --- | --- | --- | --- |
| `Validator::make($data, $rules)` | `Validator.make(data, rules, messages)` in `src/validation/Validator.ts` | `done` | Pipe-delimited rule strings (`required|email|max:255`), `unique:table,column` (ignores current row), `exists`, `confirmed`, `regex`, `sometimes`, `nullable`, custom rules; Laravel-exact messages (`validation.required` etc.) |
| Form Requests (`$this->validate()`, `authorize()`) | `src/validation/FormRequest.ts` | `done` | `rules()` / `authorize()` / `messages()`; failures throw `ValidationException` (422 for JSON, redirect-back with flashed `errors` + `old` input for HTML/Inertia) |
| `request->validate()` | `request.validate()` | `done` | Shorthand for inline validation |
| Sessions (`StartSession`, flash, `old()`, CSRF) | `src/session/*` + `StartSession` + `VerifyCsrfToken` | `done` | File/array drivers, signed cookies, flash + reflash + keep, CSRF token, session regeneration on login |
| `XSRF-TOKEN` cookie + `X-XSRF-TOKEN` header | `VerifyCsrfToken` sets the cookie; accepts `_token` input, `X-CSRF-TOKEN`, and `X-XSRF-TOKEN` | `done` | This is how Breeze + Inertia work in the browser (Inertia's axios client echoes the cookie); no meta tag |
| Session auth (`Auth::attempt()`, `login()`, `logout()`) | `Auth.attempt()`, `SessionGuard` | `done` | `AuthManager` with per-request guards, `request.user()` |
| Sanctum personal access tokens | `TokenGuard` + `PersonalAccessToken` model + `user.createToken()` | `done` | Tokens stored sha256-hashed, `expires_at` support, `auth:api` guard |
| Guards / providers | `AuthManager` + `UserProvider` (config `guards` + `providers`) | `done` | `session` and `token` guards; `users` provider keyed off the User model |
| `Hash::make()` / `Hash::check()` | `Hash.make()` / `Hash.check()` (scrypt) | `done` | |
| Gates (`Gate::define()`, `before()`) | `Gate.define()`, `gate.before()`, `request.user().can()` | `done` | Per-request gate; `authorize` throws 403 |
| Policies (`php artisan make:policy`, auto-discovery) | `app/Policies/*` + `Gate.policy(Model, Policy)` | `done` | Method names map to abilities (`view/update/delete`); `UserPolicy` shipped |
| `auth` / `guest` / `verified` / `can:` middleware | `Authenticate` (`auth` / `auth:api`), `RedirectIfAuthenticated`, `EnsureEmailIsVerified`, `Can` | `done` | Middleware params supported (`auth:api`, `can:delete,user`) |
| Email verification | `EnsureEmailIsVerified` + `email_verified_at` column | `done` | Verified-at set by seed; resend/notify UI `planned` |

## Phase 5 — Jobs, Queues, Events, Notifications, Scheduling

| Laravel | chavaJs | Status | Notes |
| --- | --- | --- | --- |
| Events + Listeners (`Event::dispatch`, auto-discovery) | `Event.dispatch()` / `Event.listen()` in `src/events/Dispatcher.ts` | `done` | Listeners in `app/Listeners/*.ts` are auto-discovered by the `handle(event: SomeEvent)` type-hint, read from source (types are erased at runtime) — Laravel's EventServiceProvider discovery contract |
| Event classes | `app/Events/*.ts` (e.g. `UserRegistered`) | `done` | Plain classes carrying payload |
| `once()` / `forget()` | `Event.once()` / `Event.forget()` | `done` | |
| Jobs (`ShouldQueue`) | `Job` base in `src/queue/Job.ts` | `done` | `tries`, `backoff`, `timeout`, `queue`, `delay`; serialization stores class + data; `app/Jobs/*` auto-discovered by `queue:work` |
| ShouldQueue **listeners** | `ShouldQueue` marker base + `CallQueuedListener` job (`src/events/queue.ts`) | `done` | A listener extending `ShouldQueue` is dispatched as a job instead of running in the request (mail can never break signup). Events are serialized with `SerializesModels`-style markers (models become class + key, re-fetched on the worker). Static `connection` / `queue` / `delay` / `tries` config honoured |
| Queue drivers (sync / database / redis) | `QueueManager` + `SyncDriver` / `DatabaseDriver` / `RedisDriver` | `done` | Database driver: `jobs` + `failed_jobs` tables, reservation, retries with backoff, failed-jobs tracking; Redis (BullMQ) is optional (`npm i bullmq ioredis`) |
| `Queue::push()` / `Queue::later()` | `Queue.push(job)` / `Queue.later(sec, job)` | `done` | |
| `php artisan queue:work` / `queue:listen` | `chava queue:work` (`--once`, `--stop-when-empty`, `--tries`) | `done` | Consumes the database queue; `queue:listen` (long-running watcher) is a thin wrapper later |
| Mailables | `Mailable` base in `src/mail/Mailable.ts` | `done` | `envelope()` / `content()`, fluent `to()/cc()/bcc()`, default `From` from `config/mail.ts` |
| Mail drivers (smtp / log / array) | `MailManager` + `LogDriver` / `ArrayDriver` / `SmtpDriver` | `done` | `log` writes to `storage/logs/chava-mail.log`; SMTP via Nodemailer is optional (`npm i nodemailer`) |
| `Mail::to(...)->send(...)` | `Mail.to(...).cc(...).send(mailable)` | `done` | Chain recipients win over the envelope's `to` |
| Blade email templates | JS template renderer (`src/mail/Template.ts`) | `done` | `{{ }}` escaped, `{!! !!}` raw, `@if`, `@each`; views in `resources/views/mail/*.html`. React Email/MJML integration `planned` |
| Notifications (`via()`, `toMail()`, `toDatabase()`) | `Notification` base in `src/notifications/types.ts` | `done` | Mail + database channels; broadcast channel `planned` |
| `Notifiable` trait | `Notifiable` base class (extend it, e.g. `User extends Notifiable`) | `done` | `notify()`, `notifications()`, `unreadNotifications()`, `markAllAsRead()` |
| Database notifications table | `notifications` migration (morph `notifiable_type`/`notifiable_id`) | `done` | `data` stored as JSON, cast back on read |
| Task scheduler (`Schedule::command()->daily()`) | `Schedule` facade in `src/scheduling/Scheduler.ts` | `done` | Fluent frequency API: `everyMinute`, `everyFiveMinutes`, `hourlyAt`, `dailyAt`, `twiceDaily`, `weeklyOn`, `monthly`, `between()`, `timezone()`, `cron()`; tasks in `routes/console.ts` |
| `schedule:run` / `schedule:list` | `chava schedule:run` / `chava schedule:list` | `done` | Cron expression matcher (steps, ranges, lists) + human-readable descriptions |
| Model events for register flows | `AuthController.register` dispatches `UserRegistered` → auto-discovered listener → welcome notification | `done` | End-to-end demo |

## Phase 6 — CLI (`chava`, Artisan-equivalent)

| Laravel | chavaJs | Status |
| --- | --- | --- |
| `php artisan serve` | `chava serve` (auto-starts Vite) | `done` |
| `php artisan route:list` | `chava route:list` | `done` |
| `make:model` / `make:migration` / `make:factory` / `make:seeder` / `make:request` / `make:policy` / `make:event` / `make:listener` / `make:job` / `make:notification` / `make:mail` / `make:controller` / `make:middleware` / `make:test` | `chava make:*` | `done` | Stub-based generators; `make:controller` supports `--resource`, `--api`, `--invokable`; `make:test` defaults to Feature, `--unit` for unit tests; `make:factory` takes `--model` (name optional) and emits a faker-driven definition skeleton; `make:seeder` accepts a name or `--class`. All generators share one helper module (`src/cli/helpers/generators.ts`) |
| `migrate` / `migrate:rollback` / `migrate:fresh` / `migrate:status` | same | `done` | |
| `db:seed` (with `--class`) | `chava db:seed` | `done` | Accepts default or named seeder exports |
| `tinker` | `chava tinker` (`src/cli/commands/tinker.ts`) | `done` | REPL with the app loaded: TS is stripped (typescript `transpileModule`) and run in a vm sandbox, expressions are awaited, results print model-aware (`User { id: 1, … }`); facades (`DB`, `Schema`, …) and every `app/Models/*` class are bare globals |
| `queue:work` / `queue:listen` / `schedule:run` / `schedule:list` | `chava queue:work` / `queue:listen` / `schedule:run` / `schedule:list` | `done` | `queue:listen` spawns a fresh `queue:work --once` per batch (Laravel semantics — picks up changed job code) |
| Single-action controllers (`make:controller --invokable`) | `__invoke()` dispatch in `HttpKernel` | `done` | `Route.get('/x', MyController)` resolves the class and calls `__invoke` |

## Phase 7 — Frontend (Inertia + React + Tailwind + shadcn + Motion)

| Laravel | chavaJs | Status |
| --- | --- | --- |
| `Inertia::render('Pages/Home')` | `Inertia.render('Home', props)` | `done` |
| Inertia protocol (JSON payloads, 409 versioning, partial reloads) | `src/inertia/` | `done` |
| `HandleInertiaRequests` middleware | `src/inertia/HandleInertiaRequests.ts` | `done` (subclass to add your own `share()`) | Also shares `auth.unreadNotifications` (the nav badge) |
| laravel-vite-plugin (dev HMR + manifest assets) | dev-server injection + `public/build/manifest.json` reader | `done` |
| `resources/js/Pages/*` (Breeze-style) | same | `done` |
| Tailwind + shadcn/ui theming (CSS variables, class dark mode) | `tailwind.config.ts` + `resources/css/app.css` + `components.json` | `done` (Button, Card, Input, Badge, Label installed) |
| Motion page transitions | `useInertiaTransition()` hook + layout `motion.div` | `done` |
| Auth scaffolding UI (login/register/dashboard) | `resources/js/Pages/Auth/*` + `Dashboard.tsx` | `done` | shadcn forms + Motion transitions; shared `auth.user` / `errors` / `csrf_token` props |
| `useForm()` + backend error mapping | `useForm` + `errors` shared prop wired to shadcn fields | `done` | Auth forms use `Label` + animated `FieldError` (+ `aria-invalid`); the inbox mark-all action surfaces server errors in a Motion banner |
| Database-channel notification inbox | `NotificationController` + `resources/js/Pages/Notifications/Index.tsx` | `done` | Lists read + unread, per-item `markAsRead()` and `markAllAsRead()` via the Notifiable API, ownership-checked (403); optimistic exit animations + stagger |
| `routes/console.php` scheduling | `routes/console.ts` | `done` | Registered from `RouteServiceProvider` alongside `web`/`api` groups; consumed by `chava schedule:run` / `schedule:list` |

## Phase 8 — Testing, Docs, DX

| Laravel | chavaJs | Status |
| --- | --- | --- |
| `phpunit` + `$this->get('/')` HTTP tests | Vitest + `app.serve(0)` feature tests | `done` |
| Dusk browser tests | Playwright (`playwright.config.ts` + `tests/Browser/*.spec.ts`) | `done` |
| `laravel new` installer | `chava new <name>` (standalone `@chavajs/cli`) | `done` | Assembles the framework from `packages/*` into the new app's `src/` + `bin/`; prompts, `--database` / `--auth` / `--package-manager` flags; dry-run verified (typecheck + migrate + seed + boot) |
| CI (GitHub Actions) | `.github/workflows/ci.yml` | `done` | typecheck + Vitest (SQLite) + production build; Postgres + MySQL matrix via service containers; Playwright browser job; `chava new` scaffold + typecheck + migrate + seed + boot check |
| Concept-mapping reference table | this file + README | `done` | |

---

## Deliberate deviations

1. **Constructor injection by parameter name, not type reflection.** TS erases types, so the container resolves `constructor(config: Config)` by looking up a binding named `config` (falling back to `Config`). Mirrors Angular-1-style DI; documented in `src/support/reflect.ts`.
2. **`Route` is a Proxy facade, not a static class.** `Route.get()` forwards to the container's `router` singleton. Identical DX, idiomatic JS.
3. **Route-level `->middleware()` chains** are expressed via the registrar (`Route.middleware('auth').get(...)`), matching Laravel 11 conventions, rather than a mutating method on the Route object.
4. **Static model methods return the base `Model` type** rather than the subclass (TypeScript can't infer `User.create()` → `Promise<User>` without generics on every static). Subclass-aware typing is a known DX trade-off; instance-level typing is exact.
5. **Model attribute access is dynamic**: per-attribute properties are installed at hydration/fill time (a `[attribute: string]: unknown` index signature types them), matching Laravel's magic `$attributes` access without PHP magic.
6. **No PHP, no Blade, no Composer** — by design. Email templates use a tiny JS renderer (Blade-style `{{ }}` / `@if` / `@each`) over plain HTML in `resources/views/mail/`; React Email / MJML integration is planned as an alternative content source.
7. **Config values are evaluated once per process.** `config/*.ts` modules run when first imported, so environment-driven settings (`QUEUE_CONNECTION`, `MAIL_MAILER`, …) are fixed for the lifetime of a process — unlike Laravel, where `env()` reads at call time. This mirrors how a booted app behaves in production (env doesn't change mid-process) and avoids re-reading `.env` on every lookup; tests that need different drivers boot in separate processes/files.
8. **The `XSRF-TOKEN` cookie is signed but not encrypted.** Laravel runs `EncryptCookies` over it and decrypts in `VerifyCsrfToken`; chavaJs signs the session cookie and exposes the raw token cookie. Same developer behavior, one less middleware layer — the token is not a secret (it's sent in every request); the session id stays HttpOnly and signed.
9. **Apps embed the framework; packages are the canonical split.** The framework ships as three packages (`packages/core`, `packages/cli`, `packages/inertia-react`), and apps consume it by *assembly* — `chava new` merges the packages into the app's own `src/` + `bin/`. App code therefore imports `../src/...` relative to its own framework copy, exactly like a scaffolded Laravel app uses its bundled framework. `scripts/assemble-framework.mjs` regenerates `examples/starter`'s copy; published `@chavajs/*` npm packages with `exports` maps are planned follow-up work.
