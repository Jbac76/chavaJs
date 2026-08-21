# chavaJs — Master Plan: Documentation, Tests & Framework Fixes

Goal: Make the documentation **extremely detailed and comprehensive**, fix all
failing tests, and address critical framework issues. Every API, every method,
every configuration option, every usage pattern, every edge case documented.

Status legend: `[ ]` pending · `[~]` in progress · `[x]` done.

---

## Part A — Fix Failing Relation Tests

### A1. hasManyThrough tests fail (returns empty)

**Root cause:** The `hasManyThrough` default key convention generates
`user_id` as `firstKey`, but the test schema has `country_id` on users.
The explicit keys fix the query but the test may also have issues with
`Country` model resolution (no `tableName` set, different Model subclass).

**Fix:**
- [ ] Verify Country model has `tableName = 'countries'` set
- [ ] Ensure `user.update({ country_id })` persists correctly
- [ ] Debug the generated SQL query to confirm the JOIN and WHERE are correct
- [ ] Ensure the test creates posts AFTER linking users to countries

### A2. morphMany/morphTo tests fail

**Root cause:** Multiple issues:
1. `PostWithImages` class doesn't set `tableName` — defaults to
   `post_with_imageses` instead of `posts`
2. `Post.create()` returns a `Post` instance, not `PostWithImages` —
   the `images()` method doesn't exist on the base class
3. The cast `(await Post.create(...)) as PostWithImages` is TypeScript-only
   and doesn't add runtime methods

**Fix:**
- [ ] Add `tableName = 'posts'` to `PostWithImages` class
- [ ] Add `tableName = 'users'` to `UserWithImages` class
- [ ] For morphMany tests, instantiate `PostWithImages` directly or add
      a helper that hydrates the correct subclass
- [ ] Ensure `Image` and `Video` tables don't have FK constraints that
      block inserts (they use `imageable_id`/`imageable_type`, not real FKs)
- [ ] Verify morphTo eager loading works across mixed parent types
      (Post + User)

### A3. Verification

- [ ] Run `npx vitest run tests/Unit/relations.test.ts` — all 19 tests green
- [ ] Run full test suite — no regressions

---

## Part B — Critical Framework Issues

### B1. Migration system does not support multiple database connections

**Issue:** Laravel supports `php artisan migrate --database=mysql` to run
migrations on a specific connection. chavaJs has no equivalent.

**Fix:**
- [ ] Add `--database` flag to `js migrate`, `js migrate:rollback`,
      `js migrate:fresh`, `js migrate:reset`
- [ ] Update `Migrator` class to accept a connection parameter
- [ ] Default to the configured `DB_CONNECTION` when no flag is provided
- [ ] Document multi-connection migration workflow

### B2. Mass assignment default may be unsafe

**Issue:** It's unclear whether `fillable` is optional. If not set, is mass
assignment allowed or blocked? Laravel defaults to blocking when neither
`fillable` nor `guarded` is defined.

**Fix:**
- [ ] Audit `Model.fill()` / `create()` / `update()` behavior when
      `fillable` is empty and `guarded` is empty
- [ ] Default to blocking mass assignment (empty fillable + empty guarded =
      nothing mass-assignable)
- [ ] Document: "If neither fillable nor guarded is set, mass assignment
      is blocked. Set guarded = [] to allow all."
- [ ] Add warning in docs when fillable is empty and guarded is empty
- [ ] Add test: `Model.create({ unknown: 'value' })` should not set
      unknown attributes when fillable is empty

### B3. Soft deletes are incomplete (documentation)

**Issue:** The docs mention `delete()` soft-deletes but don't document
`restore()`, `forceDelete()`, `withTrashed()`, `onlyTrashed()`.

**Fix:**
- [ ] Verify `restore()`, `forceDelete()`, `withTrashed()`, `onlyTrashed()`
      exist in Model.ts
- [ ] Add complete soft deletes section to 11-eloquent.md with examples
      for every method
- [ ] Add `trashed()` instance method documentation
- [ ] Add test coverage for all soft delete operations

### B4. Missing failed_jobs migration

**Issue:** The template has `create_jobs_table` but no `create_failed_jobs_table`.
The database queue driver stores failed jobs in `failed_jobs` — without the
table, `queue:work` will crash on job failure.

**Fix:**
- [ ] Create `2026_02_02_000001_create_failed_jobs_table.ts` migration
- [ ] Add to the template's migration list
- [ ] Verify `queue:failed` reads from this table correctly
- [ ] Add test: queue a job that throws, verify it appears in `queue:failed`

### B5. Queue serialization of event listeners will break

**Issue:** Queued listeners extend `ShouldQueue`. Event objects may contain
model instances. Standard JSON serialization strips prototypes/methods.
`event.user` would become a plain object, not a User model.

**Fix:**
- [ ] Implement `toQueue()` / `fromQueue()` serialization on Job/Event classes
- [ ] Store model primary keys, not full model instances
- [ ] Re-fetch models inside `handle()` after deserialization
- [ ] Add `serializeForQueue()` helper that extracts PKs from model properties
- [ ] Document the serialization contract for queued events

### B6. No explicit async error handling for middleware/controllers

**Issue:** If a controller or middleware throws, does the kernel catch it
and return a clean 500? Without one, rejected promises crash the process
or leak stack traces.

**Fix:**
- [ ] Audit `Kernel.handleException()` — verify it catches all errors
- [ ] Ensure 500 response is returned for unhandled exceptions
- [ ] Ensure `APP_DEBUG=false` hides stack traces in production
- [ ] Add global error handler documentation
- [ ] Add test: controller that throws, verify 500 response

### B7. No request body size limits documented/implemented

**Issue:** Node's http server has no default body limit. Multipart parsing
especially needs max file size, max field count, max total request size.

**Fix:**
- [ ] Verify `MAX_BODY_SIZE = 10MB` in Request.ts is enforced
- [ ] Add max file size limit to multipart parser
- [ ] Add max field count limit
- [ ] Add max total request size limit
- [ ] Document body size limits in 06-requests.md
- [ ] Return 413 Payload Too Large when exceeded
- [ ] Add test: oversized body should be rejected

### B8. Potential session file path traversal

**Issue:** If session IDs from cookies are not strictly validated/signed,
an attacker could forge `../../some/path` and cause arbitrary file I/O.

**Fix:**
- [ ] Validate session IDs match `[a-zA-Z0-9_-]{32,}` or similar strict format
- [ ] Verify session ID is signed/verified before use
- [ ] Add `SessionStore.load()` validation
- [ ] Add test: forged session ID should be rejected
- [ ] Document session security in 14-sessions.md

### B9. APP_KEY defaults to empty string

**Issue:** If `APP_KEY` is empty, session cookie signing and CSRF token
generation may be weak or broken. Laravel refuses to run without one.

**Fix:**
- [ ] Generate a secure random key during `chava new` scaffolding
- [ ] Fail fast in production if APP_KEY is missing (throw on boot)
- [ ] Add validation: `if (APP_ENV === 'production' && !APP_KEY) throw`
- [ ] Document APP_KEY generation and importance
- [ ] Add `js app:key:generate` command (or document manual generation)

### B10. Auto DI depends on TypeScript decorator metadata

**Issue:** Container resolves constructor params "by type/name" but plain
TypeScript doesn't preserve parameter types without `emitDecoratorMetadata`.
tsx/esbuild don't emit it by default.

**Fix:**
- [ ] Audit `paramNamesOf()` in reflect.ts — confirm it uses AST/parsing
      not decorator metadata
- [ ] If it uses AST parsing (reads .ts source files), document this
      limitation clearly
- [ ] If it uses decorator metadata, add required tsconfig flags to docs
- [ ] Provide fallback: explicit `Container.bind()` for all non-trivial types
- [ ] Document: "Auto-wiring reads parameter names from source. For compiled
      deployments, use explicit bindings."

### B11. Framework is scaffolded into src/ instead of installed as dependency

**Issue:** Apps import from `../src/orm/Model` not `@chavajs/core`. This
means framework updates require re-scaffolding, no dependency resolution,
no security patches via npm.

**Fix:**
- [ ] Add `main`, `module`, `types`, `exports` fields to package.json
- [ ] Build framework to `dist/` with compiled JS + `.d.ts` declarations
- [ ] Add index.ts entry point exporting all public APIs
- [ ] Update app template imports to use `@chavajs/core`
- [ ] Document the dual-mode: src (dev) vs dist (published)
- [ ] Long-term: consider making @chavajs/core a proper npm dependency

### B12. Event listener auto-discovery reads source files (fragile)

**Issue:** TypeScript annotations are erased at runtime, so chavaJs reads
listener source files to extract `handle()` parameter types. This breaks
when source is bundled, minified, deployed as JS, or in serverless.

**Fix:**
- [ ] Add explicit registration fallback: `Event.listen(UserRegistered, UserListener)`
- [ ] Make auto-discovery optional (config flag: `events.discover: false`)
- [ ] Document: "Auto-discovery reads .ts source files. For production,
      use explicit `Event.listen()` registration."
- [ ] Add `Event.listen()` as the recommended production pattern
- [ ] Test: verify explicit registration works when source is unavailable

### B13. Peer dependency ranges are too loose

**Issue:** `>=8.0.0` allows future incompatible majors. Should use `^`.

**Fix:**
- [ ] Change all peer deps to caret ranges:
      `"pg": "^8.0.0"`, `"mysql2": "^3.0.0"`, `"bullmq": "^5.0.0"`,
      `"ioredis": "^5.0.0"`, `"nodemailer": "^6.0.0"`
- [ ] Verify these work with current versions

### B14. @faker-js/faker should not be a core runtime dependency

**Issue:** Faker is used for factories/seeders. It should be dev or optional,
not required at runtime.

**Fix:**
- [ ] Move `@faker-js/faker` from core dependencies to:
      - Dev dependency of starter template, OR
      - Optional peer dependency
- [ ] Make factory classes gracefully degrade without faker
- [ ] Document: "Install @faker-js/faker for model factories"

### B15. @inertiajs/core not declared as dependency

**Issue:** `src/inertia/` imports from `@inertiajs/core` but it's not in
dependencies or peerDependencies.

**Fix:**
- [ ] Add `"@inertiajs/core": "^1.0.0"` to peerDependencies
- [ ] Document: "Inertia requires @inertiajs/core and @inertiajs/react"
- [ ] Verify imports work correctly

### B16. typescript and tsx are runtime dependencies

**Issue:** These should be devDependencies. Shipping raw .ts source with
tsx as runtime is a serious architecture issue.

**Fix:**
- [ ] Move `typescript` and `tsx` to devDependencies
- [ ] Publish compiled JavaScript + .d.ts (not raw .ts)
- [ ] Remove tsx requirement for runtime
- [ ] Update bin scripts to use compiled JS

### B17. bin/js.js not registered in package.json

**Issue:** The tarball contains `bin/js.js` but package.json only declares
`"chava": "bin/chava.js"`.

**Fix:**
- [ ] Add `"js": "bin/js.js"` to package.json bin field, OR
- [ ] Remove `bin/js.js` if not needed
- [ ] Verify both binaries work after fix

### B18. No files allowlist in package.json

**Issue:** No `"files"` field means npm publishes everything including
src/, docs/, template/, test artifacts.

**Fix:**
- [ ] Add `"files"` field to package.json:
      `["dist", "bin", "README.md", "LICENSE"]`
- [ ] Verify tarball contents are minimal and intentional
- [ ] Target: <50 files, <200 kB unpacked for core

### B19. @chavajs/core is not really a core framework package

**Issue:** The tarball contains framework code + CLI + docs + template +
React pages + migrations + seeders + controllers + frontend. It's everything
in one package.

**Fix:**
- [ ] Split into proper packages:
      - `@chavajs/core` — framework runtime only (orm, http, auth, etc.)
      - `@chavajs/cli` — console tooling only
      - `@chavajs/starter` — scaffolding template
- [ ] Remove docs/, template/, React pages from core
- [ ] Document the package architecture

### B20. @chavajs/core is not importable as npm package

**Issue:** No `main`, `module`, `types`, `exports` fields. No compiled
entry file. `import { Application } from '@chavajs/core'` will fail.

**Fix:**
- [ ] Add to package.json:
      ```json
      "main": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "exports": {
        ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
        "./*": "./dist/*"
      }
      ```
- [ ] Create `src/index.ts` entry point exporting all public APIs
- [ ] Build to dist/ with tsc
- [ ] Verify `import { Model } from '@chavajs/core'` works

### B21. Raw TypeScript published, not compiled JavaScript

**Issue:** Tarball has only `src/*.ts`. No dist/, no .d.ts. TypeScript
consumers get no types, JS consumers can't use it.

**Fix:**
- [ ] Build framework: `tsc` → `dist/`
- [ ] Generate `.d.ts` declaration files
- [ ] Publish dist/ not src/
- [ ] Verify TypeScript types work for consumers

### B22. SQLite :memory: connection handling is fragile

**Issue:** In-memory SQLite databases disappear when connection closes.
If DB manager opens new connections per query, data vanishes.

**Fix:**
- [ ] Verify DatabaseManager reuses connections (connection caching)
- [ ] Add test: create table, insert data, query in same test — data persists
- [ ] Document: "SQLite :memory: requires a persistent connection"

### B23. No transaction support for migrations

**Issue:** If migration 3 of 5 fails, database is left in partial state.
MySQL DDL is non-transactional, SQLite has limited transactional DDL.

**Fix:**
- [ ] Wrap each migration in a transaction where the driver supports it
- [ ] Document: "MySQL DDL is non-transactional. Test migrations before deploy."
- [ ] Add `--force` flag documentation for production safety

### B24. npm run serve/dev relies on global js

**Issue:** Starter template uses `"serve": "js serve"` which requires
global `js` install. Should use local path.

**Fix:**
- [ ] Change starter template scripts to:
      `"serve": "node bin/chava.js serve"`
      `"dev": "node bin/chava.js serve"`
- [ ] Or use `npx` fallback
- [ ] Verify both global and local paths work

### B25. Schedule.command uses global chava

**Issue:** `Schedule.command('chava route:list')` fails if chava isn't global.

**Fix:**
- [ ] Change to `Schedule.command('node bin/chava.js route:list')`
- [ ] Or provide app-local resolution
- [ ] Document the correct pattern

### B26. Mail API typo

**Issue:** `Mail.to('boss@example.com').cc('bcc@example.com')` — the argument
to `.cc()` is labeled as `bcc`. Copy-paste bug.

**Fix:**
- [ ] Fix to `Mail.to('boss@example.com').bcc('bcc@example.com')`
- [ ] Verify `.bcc()` method exists on RecipientChain
- [ ] Fix in all docs and examples

### B27. Inertia component naming is inconsistent

**Issue:** Convention drops `Pages/` prefix but this is unexplained and
differs from default Inertia/Laravel.

**Fix:**
- [ ] Document the naming convention clearly
- [ ] Explain why it differs from Laravel Inertia
- [ ] Add example showing the resolution path

### B28. Auth guard token abilities not enforced

**Issue:** `PersonalAccessToken` stores abilities as JSON but no middleware
enforces them (`abilities:read`).

**Fix:**
- [ ] Add `abilities` middleware that checks token abilities
- [ ] Document: `Route.middleware('auth:api,abilities:read')`
- [ ] Add test: token with limited abilities cannot access restricted routes

### B29. Version mismatch in README

**Issue:** Published package is 0.0.3 but README describes v1.0.0-rc.1.

**Fix:**
- [ ] Update README to match actual published version
- [ ] Remove stale version references
- [ ] Add versioning policy documentation

### B30. Package split contradicts documentation

**Issue:** README says framework is split into 3 packages but core tarball
contains everything.

**Fix:**
- [ ] Complete the actual package split
- [ ] Update README to match reality
- [ ] Verify each package is independently publishable and importable

### B31. No license file in tarball

**Issue:** package.json says `"license": "MIT"` but no LICENSE file in tarball.

**Fix:**
- [ ] Add `LICENSE` file to packages/core/
- [ ] Include in `"files"` field
- [ ] Verify it appears in tarball

---

## Part C — Documentation Deep Overhaul

### C0. New doc pages to create

- [ ] `23-container.md` — Service Container reference (bind, singleton,
      instance, alias, when/needs/give, make, call, auto-wiring, resolution
      order, error handling)
- [ ] `24-support.md` — Support utilities (dot notation, exceptions
      hierarchy, reflection/auto-wiring, helpers)
- [ ] `25-facades.md` — Complete facade reference (all 14 facades, how
      they work, creating custom facades)

### C1. 00-index.md — Expand

- [ ] Add feature matrix table (what's included vs Laravel equivalent)
- [ ] Add "Who is chavaJs for?" section
- [ ] Add comparison table: chavaJs vs Laravel vs Express vs NestJS
- [ ] Add quick-links to every doc page
- [ ] Add troubleshooting FAQ section

### C2. 01-installation.md — Expand

- [ ] Document Node.js version requirements in detail (>= 18.17)
- [ ] Document npm scope `@chavajs` and why two packages
- [ ] Add complete directory tree with every file explained
- [ ] Add "from checkout" dev workflow (clone, npm link, chava new --framework)
- [ ] Document `--docs` / `--no-docs` flags
- [ ] Document `--skip-install` flag
- [ ] Add troubleshooting: common install errors

### C3. 02-configuration.md — Expand

- [ ] Document `Config.all()`, `Config.set()`, `Config.load()` methods
- [ ] Document `Env.load()`, `Env.get()`, `Env.bool()`, `Env.number()` methods
- [ ] Add every config file with every option explained
- [ ] Document dot-notation access: `Config.get('database.default')`
- [ ] Document environment variable casting rules (bool, number)
- [ ] Add config-in-provider pattern

### C4. 03-architecture.md — Expand

- [ ] Document `Container.bind()`, `singleton()`, `instance()`, `alias()`
- [ ] Document `Container.when(concrete).needs(param).give(value)`
- [ ] Document `Container.bound()`, `Container.make()`, `Container.call()`
- [ ] Document resolution order: instances > singletons > bindings > auto-wire
- [ ] Document auto-wiring mechanics (parameter name resolution)
- [ ] Document `Application` class: `bootstrap()`, `serve()`, path helpers
- [ ] Document `ServiceProvider` lifecycle: register() then boot()
- [ ] Document `Pipeline` class (middleware engine)
- [ ] Document `Application.configure()` factory method
- [ ] Document error handling: what happens when resolution fails

### C5. 04-routing.md — Expand

- [ ] Document `Route.as()` alias method
- [ ] Document `Router.has(name)`, `Router.route(name)`, `Router.getRoutes()`
- [ ] Document resource controller `only`/`except`/`names` options fully
- [ ] Document `RouteRegistrar` fluent API
- [ ] Document 405 Method Not Allowed response (Allow header)
- [ ] Document route parameter `{param}` (required) vs `{param?}` (optional)
- [ ] Add examples for every verb: get, post, put, patch, delete, options
- [ ] Document route model binding: how it resolves, custom keys, fallback
- [ ] Document middleware parameter syntax: `middleware:auth,api`

### C6. 05-controllers.md — Expand

- [ ] Document `Controller` base class and `authorize()` method
- [ ] Document automatic response conversion rules:
      object → JSON, string → text/plain, null/undefined → 204
- [ ] Document `Response.noContent()` helper
- [ ] Add complete controller example with DI, validation, authorization
- [ ] Document single-action (invokable) controllers with `__invoke`
- [ ] Document middleware on controllers

### C7. 06-requests.md — Expand

- [ ] Document `Request.get()` alias for `input()`
- [ ] Document `UploadedFile.content` (Buffer) and `tempPath` properties
- [ ] Document `Request.id` (UUID), `originalUrl`, `ip`, `rawBody`
- [ ] Document `Request.body`, `headers`, `cookies` direct properties
- [ ] Document 10 MB body size limit (`MAX_BODY_SIZE`)
- [ ] Document content type handling: JSON, form-urlencoded, multipart
- [ ] Document dot-notation in `input()`: `request.input('user.name')`
- [ ] Document `only()`/`except()` accept both arrays and rest params
- [ ] Add complete request examples for every method

### C8. 07-validation.md — Expand

- [ ] Document `Validator.make(data, rules)` standalone usage
- [ ] Document `Validator.extend(name, callback)` for global custom rules
- [ ] Document `ValidatorInstance.sometimes()` conditional rules
- [ ] Document `errorsFirst()`, `errors()`, `passes()`, `fails()` methods
- [ ] Document `FormRequest.messages()` and `attributes()` methods
- [ ] Document custom rule 4-parameter signature: `(value, params, data, attribute)`
- [ ] Document `unique` rule ignore ID syntax: `unique:users,email,1,id`
- [ ] Document validation error format: `{ field: ['message'] }`
- [ ] Add standalone validator example (outside request context)

### C9. 08-middleware.md — Expand

- [ ] Document `MiddlewareFunction` type: `(request, next, ...params) => Response`
- [ ] Document `MiddlewareClass` interface
- [ ] Document functional middleware (not just class-based)
- [ ] Document `Pipeline` class (middleware execution engine)
- [ ] Document `HandleInertiaRequests` shared data (user, flash, errors)
- [ ] Document middleware error handling (what happens on throw)
- [ ] Document static asset serving behavior
- [ ] Add functional middleware example

### C10. 09-database.md — Expand

- [ ] Document `DB.raw()` for raw expressions
- [ ] Document `DB.pluck()`, `DB.value()` methods
- [ ] Document `DB.distinct()` queries
- [ ] Document nested where clauses with closures
- [ ] Document `DB.whereColumn()` column-to-column comparison
- [ ] Document `leftJoin()`, `rightJoin()`, `crossJoin()`
- [ ] Document `DB.chunk()` for batch processing
- [ ] Document driver requirements: `npm i pg`, `npm i mysql2`
- [ ] Document SQLite `:memory:` for testing
- [ ] Document `DB.table()` returns a Builder
- [ ] Add examples for every join type

### C11. 10-migrations.md — Expand

- [ ] Document `Blueprint.dropColumn()`, `dropIndex()`, `dropForeign()`
- [ ] Document `Blueprint.renameColumn()` (if supported)
- [ ] Document `Blueprint.after()` (MySQL-specific)
- [ ] Document `Blueprint.check()` constraint
- [ ] Document `Migrator.wipe()` method
- [ ] Document `Migrator.reset()` return value
- [ ] Document migration batch tracking internals
- [ ] Add `Schema.table()` alter examples (add/drop columns)
- [ ] Add `--force` production warning
- [ ] Document multi-connection migration (after B1 fix)

### C12. 11-eloquent.md — Expand (major)

- [ ] Document accessors/mutators: `get{Name}Attribute()` / `set{Name}Attribute()`
- [ ] Document `timestamp` cast type
- [ ] Document `Model.getConnection()`, `getTable()`, `getKeyName()`, `getKey()`
- [ ] Document `Model.getMorphClass()`
- [ ] Document dirty tracking: `isDirty()`, `getDirty()`, `getOriginal()`, `wasChanged()`
- [ ] Document `Model.exists()` and `wasRecentlyCreated()`
- [ ] Document `Model.rawAttributes()` for raw access
- [ ] Document `Model.newInstance()` and `createRaw()`
- [ ] Document `Model.setRelation()` and `getRelation()`
- [ ] Document `Model.relationInstance()`
- [ ] Document `registerMorphClass()` / `resolveMorphClass()` morph map
- [ ] Document `Model.query()` static method
- [ ] Document `Model.pluck()`, `Model.value()`, `Model.latest()`, `Model.oldest()`
- [ ] Document `Model.limit()`, `Model.take()`
- [ ] Document `Model.forceFill()` with example
- [ ] Document full `CastType` union type
- [ ] Document `hidden` attribute exclusion in serialization
- [ ] Add complete accessor/mutator example
- [ ] Add complete dirty tracking example
- [ ] Document `hasManyThrough` key conventions in depth
- [ ] Document polymorphic morph map registration
- [ ] Document mass assignment safety (after B2 fix)
- [ ] Complete soft deletes section (after B3 fix)

### C13. 12-seeding.md — Expand

- [ ] Document `Seeder.call()` for composing seeders
- [ ] Document class-based `Factory` base class
- [ ] Document `Factory.state()`, `Factory.for()`, `Factory.count()`
- [ ] Document `Factory.makeOne()`, `createOne()`, `makeMany()`, `createMany()`
- [ ] Document `Factory.faker` property
- [ ] Document `Factory.make()` vs `Factory.create()`
- [ ] Show `DatabaseSeeder` using `this.call()` pattern
- [ ] Add Factory class example with states

### C14. 13-auth.md — Expand

- [ ] Document `Gate.denies()`, `Gate.check()`, `Gate.any()`, `Gate.none()`
- [ ] Document `Gate.can()` alias for `allows()`
- [ ] Document `Gate.before()` and `Gate.after()` callbacks
- [ ] Document `AuthManager.guard()` method
- [ ] Document `SessionGuard.setUser()` and session key format
- [ ] Document `TokenGuard` how it works
- [ ] Document `UserProvider` interface
- [ ] Clarify `Hash` is a direct import, not a facade
- [ ] Add `Gate.before()` and `Gate.after()` examples
- [ ] Document token abilities middleware (after B28 fix)

### C15. 14-sessions.md — Expand

- [ ] Document `SessionStore.push()` for array values
- [ ] Document `SessionStore.pull()` get-and-forget
- [ ] Document `SessionStore.flush()` clear all
- [ ] Document `SessionStore.invalidate()` destroy session
- [ ] Document `SessionStore.migrate()` regenerate ID
- [ ] Document `SessionStore.now()` current-request-only flash
- [ ] Document `SessionStore.reflash()` and `keep()` for flash persistence
- [ ] Document `SessionStore.token()` and `regenerateToken()` for CSRF
- [ ] Document session handlers: File and Array
- [ ] Document `SessionManager.driver()` and `store()` methods
- [ ] Document flash data aging mechanism
- [ ] Document session ID validation (after B8 fix)

### C16. 15-events.md — Expand

- [ ] Document `Dispatcher.listen()` for string events
- [ ] Document `Dispatcher.forget()` to remove listeners
- [ ] Document `Dispatcher.once()` for one-time listeners
- [ ] Document `Dispatcher.hasListeners()` and `listenerCounts()`
- [ ] Document functional listeners (not just classes)
- [ ] Document `dispatch()` return value
- [ ] Document event serialization for queued listeners
- [ ] Document listener auto-discovery mechanism and limitations
- [ ] Document explicit registration as production recommendation (after B12 fix)

### C17. 16-queues.md — Expand

- [ ] Document `Job.timeout` and `Job.delay` properties
- [ ] Document `Job.serialize()` and `Job.fromPayload()` format
- [ ] Document `registerJob()` and `registerJobsFrom()` functions
- [ ] Document `QueueDriver` interface
- [ ] Document `DatabaseDriver` and `RedisDriver` internals
- [ ] Document `SyncDriver` behavior
- [ ] Document `QueueManager.connection()` method
- [ ] Document job auto-registration in workers
- [ ] Document failed jobs table schema (after B4 fix)
- [ ] Add complete job class example with all properties
- [ ] Document queue serialization for models (after B5 fix)

### C18. 17-mail-notifications.md — Expand

- [ ] Document `Mail.sent()` for testing (array driver)
- [ ] Document `Mail.to().bcc().send()` BCC usage (after B26 fix)
- [ ] Document `MailMessage` and `MailRecipient` types
- [ ] Document `NotificationManager.channel()` method
- [ ] Document `DatabaseChannel` what gets written
- [ ] Document `Notifiable` mixin methods
- [ ] Document notification `toArray()` for database channel
- [ ] Document custom notification channels
- [ ] Add testing with array mail driver example

### C19. 18-scheduling.md — Expand

- [ ] Document `ScheduledEvent.timezone()` per-event timezone
- [ ] Document `ScheduledEvent.between()` time window
- [ ] Document `ScheduledEvent.isDue()` check
- [ ] Document `ScheduledEvent.getDescription()` and `getExpression()`
- [ ] Document `Scheduler.dueEvents()` and `runDue()`
- [ ] Document overnight time window behavior
- [ ] Document command scheduling with local path (after B25 fix)
- [ ] Add `timezone()` and `between()` examples

### C20. 19-frontend.md — Expand

- [ ] Document `InertiaServiceProvider` registration
- [ ] Document `HtmlRenderer` server-side HTML shell
- [ ] Document `HandleInertiaRequests` shared data in detail
- [ ] Document Inertia response protocol: `{ component, props, url, version }`
- [ ] Document `config/frontend.ts` configuration
- [ ] Document SSR support status
- [ ] Add complete page component with form handling example
- [ ] Add validation error handling in Inertia pages
- [ ] Document component naming convention (after B27 fix)

### C21. 20-console.md — Expand

- [ ] Document custom command file structure completely
- [ ] Document Commander integration (options, arguments, help)
- [ ] Document `js queue:failed` output format
- [ ] Document `--id` vs `--all` for queue:retry
- [ ] Document exit codes
- [ ] Document `--docs / --no-docs` flag for `chava new`
- [ ] Document auto-discovery of commands from `app/Console/Commands/`
- [ ] Add complete custom command example

### C22. 21-testing.md — Expand

- [ ] Document `Request.create()` for unit testing
- [ ] Document standalone `Validator.make()` testing
- [ ] Document testing with array mail driver: `Mail.sent()`
- [ ] Document testing with Sync queue driver
- [ ] Document testing middleware in isolation
- [ ] Document testing Gates and Policies
- [ ] Document `ArraySessionHandler` for tests
- [ ] Document test database migration setup pattern
- [ ] Document Feature test server lifecycle

### C23. 22-deployment.md — Expand

- [ ] Document `Application.version` and `Application.serve()` method
- [ ] Document static asset serving behavior
- [ ] Document MIME types table
- [ ] Document error handling in production (`isDebug()`)
- [ ] Add Docker deployment example
- [ ] Add systemd service file example
- [ ] Add deployment verification steps
- [ ] Document graceful shutdown behavior
- [ ] Document worker process management
- [ ] Document APP_KEY requirement (after B9 fix)

### C24. New: 23-container.md — Service Container

- [ ] Complete `Container` API: bind, singleton, instance, alias, when, make, call, bound
- [ ] `ContextualBindingBuilder`: when().needs().give()
- [ ] Auto-wiring: how parameter names resolve from the container
- [ ] Resolution order: instances → singletons → bindings → auto-wire
- [ ] `Application` class as container: all methods
- [ ] `ServiceProvider` lifecycle: register() then boot()
- [ ] Error handling: `BindingResolutionException`
- [ ] Practical examples: binding interfaces, contextual overrides

### C25. New: 24-support.md — Support Utilities

- [ ] `getPath(source, path, fallback)` dot notation utility
- [ ] `hasPath(source, path)` existence check
- [ ] `deepMerge(target, source)` deep merge
- [ ] Exception hierarchy: RuntimeException, NotFoundException,
      MethodNotAllowedException, ValidationException, AuthorizationException,
      BindingResolutionException
- [ ] When each exception is thrown by the framework
- [ ] Custom error handling patterns
- [ ] Reflection utilities: `isClass()`, `paramNamesOf()`, auto-wiring

### C26. New: 25-facades.md — Complete Facade Reference

- [ ] All 14 facades with underlying class and methods
- [ ] How facades work: Proxy-based, resolve from container
- [ ] Creating custom facades: `facade<T>(accessor)`
- [ ] `Hash` and `Validator` — direct imports, NOT facades
- [ ] When to use facades vs direct imports
- [ ] Facade testing patterns

### C27. Cross-cutting documentation concerns

- [ ] Every doc page has consistent structure:
      Title, Introduction, Quick Example, Full Reference, Methods Table,
      Examples, Tips, Next Steps
- [ ] Every code example uses consistent import paths
- [ ] Every API method has a table entry with signature, params, return type
- [ ] Cross-link related pages (e.g., routing → middleware → controllers)
- [ ] Add "See also" links at the bottom of every page
- [ ] Verify every example against actual source code

---

## Part D — Housekeeping

### D1. Git repository

- [ ] Initialize git repository: `git init`
- [ ] Create `.gitignore` (node_modules, dist, .env, storage/*.db, etc.)
- [ ] Create initial commit with all source files
- [ ] Set up branch strategy (main for stable, develop for work)
- [ ] Consider adding GitHub remote for collaboration

### D2. Verification

- [ ] Run `npx vitest run` — all tests green
- [ ] Run `npx tsc --noEmit` — typecheck clean
- [ ] Run `node scripts/pre-publish.mjs` — 20/20 checks green
- [ ] Scaffold fresh app with `--docs`, verify every doc page renders
- [ ] Spot-check 10 random code examples against source for accuracy
- [ ] Verify every documented method actually exists in the source
- [ ] Verify package tarball contents are minimal and correct
- [ ] Verify all peer dependencies are declared correctly

---

## Execution Order

1. **Part A** — Fix failing tests first (unblocks everything else)
2. **Part B (B1-B12)** — Critical framework fixes (security, correctness)
3. **Part B (B13-B31)** — Package/dependency fixes (publishability)
4. **Part D1** — Git repo setup
5. **Part C** — Documentation overhaul (depends on framework being correct)
6. **Part D2** — Final verification
