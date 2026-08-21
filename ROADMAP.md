# chavaJs Roadmap

Statuses: `planned` · `in-progress` · `done` · `wontfix`. Every item also lives
in [`PARITY.md`](./PARITY.md) with its Laravel-equivalent mapping.

## Done

- [x] Publishable `@chavajs/*` packages (`@chavajs/core`, `@chavajs/cli`, `@chavajs/installer`).
- [x] Documentation site served at `/docs` (26 pages, built into the framework distribution).
- [x] `@faker-js/faker` moved to devDependencies.
- [x] `bin/chava.js` graceful tsx error message.
- [x] Multi-connection migrations (`--database` flag).
- [x] Soft deletes scope leak fix (qualified column names).
- [x] Queue serialization (`__chava_model` / `__chava_date` markers).
- [x] Request body size limits + 413 handling.
- [x] Session ID validation (strict 64-char hex).
- [x] `APP_KEY` enforcement in production.
- [x] Mass assignment safety (`isFillable()` blocks empty fillable+guarded).
- [x] Peer dep ranges fixed (`^` instead of `>=`).
- [x] ORM relations: hasMany, hasOne, belongsTo, belongsToMany, hasManyThrough, morphMany, morphTo.

## Next up

- [ ] **`@inject()` decorator** support as an explicit alternative to
      by-name constructor injection (`planned` in PARITY.md).
- [ ] **Route caching** (`planned` in PARITY.md). Lower priority than
      in Laravel — Node's startup cost is already small compared to PHP's
      per-request bootstrap.
- [ ] **Broadcast notification channel** (`planned` in PARITY.md).
      Only sensible once a WebSocket/Pusher-equivalent story exists.
- [ ] **Email verification resend/notify UI** (`planned` in PARITY.md).
      `EnsureEmailIsVerified` + `email_verified_at` already exist; the resend
      flow and UI are missing.
- [ ] **React Email / MJML** as an alternative mail-template source
      (`planned` in PARITY.md).
- [ ] **`good first issue`s**: context-free candidates — the smaller
      `planned` items above are self-contained.

## Recurring

- [ ] Keep `npm run test:postgres` / `test:mysql` green via
      `docker-compose.test.yml` (CI matrix).
- [ ] Keep the scaffolded app template in sync with `examples/starter`
      (the reference implementation).

## Won't fix (deliberate deviations)

- Route caching via a serialized route file — noted as `planned` but documented
  as lower-value on a Node runtime; revisit only if benchmarks demand it.
- PHP/Blade/Composer parity — the framework is a *concept* port, not a syntax
  port (see PARITY.md deviations).
