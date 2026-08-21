# Coding Agent Prompt: Complete Phase 8 for chavaJs

Copy everything below into your coding agent. Run this **before** the open-source packaging prompt — chavaJs is feature-complete through Phase 7, but per its own `PARITY.md`, several items block a credible v1.0 announcement: single-database-engine support being the biggest one.

---

## CONTEXT FOR THE AGENT

chavaJs (a Laravel-equivalent framework in TypeScript, with an Inertia + React + Tailwind + shadcn + Motion frontend) is done through Phase 7. Read `PARITY.md`, `CHANGELOG.md`, and `README.md` in the repo root first to load full context on what exists before writing any code. Do not re-implement anything already marked `done` — this phase closes out the remaining `planned` items and hardens what's there for public release.

---

## PHASE 8A — Postgres & MySQL Drivers (highest priority)

This is the single biggest adoption blocker. Most real Laravel-migrating developers run Postgres or MySQL in production, not SQLite.

1. Implement `PostgresConnection` and `MySQLConnection` against the existing `Connection` seam (`src/database/Connection.ts` or equivalent) — same interface as `SQLiteConnection`, so the query builder, schema builder, and ORM require **zero changes**.
2. Use `pg` for Postgres and `mysql2` for MySQL as optional peer dependencies (not bundled — mirror how `bullmq`/`nodemailer` are already optional per the changelog), so a SQLite-only project isn't forced to install them.
3. Extend the SQL grammar layer per-driver where syntax diverges from the existing SQLite grammar:
   - Auto-increment/identity column syntax (`SERIAL`/`GENERATED ALWAYS AS IDENTITY` for Postgres, `AUTO_INCREMENT` for MySQL)
   - Upsert syntax (`ON CONFLICT` vs `ON DUPLICATE KEY UPDATE`)
   - `RANDOM()` vs `RAND()` for `inRandomOrder()`
   - Boolean/JSON column type mapping
   - Identifier quoting (`"col"` vs `` `col` ``)
   - `LIMIT`/`OFFSET` placement and pagination differences, if any
4. `config/database.ts` already supports a `connection` switch per the existing pattern — extend it to accept `pg`/`mysql` values, each with host/port/database/username/password/ssl options read from `.env`.
5. Migrations, the query builder, and the ORM must pass the **exact same test suite** against all three engines. Set up a parameterized/matrix test run (e.g., Vitest with a `DB_CONNECTION` env matrix) so `npm test` can run against SQLite by default (no external service needed) and optionally against Postgres/MySQL when `TEST_ALL_DRIVERS=1` is set with connection env vars provided.
6. Add `docker-compose.test.yml` spinning up throwaway Postgres and MySQL containers for local/CI testing of the new drivers.
7. Update `PARITY.md`: move Postgres/MySQL drivers from `planned` to `done`, and note any per-driver SQL deviations discovered along the way.
8. Update `README.md`'s setup instructions to show `.env` configuration for all three engines, not just SQLite.

## PHASE 8B — `chava new` Installer

1. Build a standalone, npx-runnable scaffolding CLI (`create-chava-app`, or `chava new` if kept inside the main CLI — prefer a separate npx-runnable package since that's the standard Node ecosystem convention and matches the earlier packaging plan).
2. `npx create-chava-app my-app` should:
   - Prompt (or accept flags) for: database engine (sqlite/postgres/mysql), whether to include the auth scaffolding UI, and package manager preference (npm/pnpm/yarn)
   - Copy a maintained starter template (not the framework's own dev repo) containing: `bootstrap/app.ts`, `config/*`, example `routes/web.ts` with the resource route from the README, the auth UI (Login/Register/Dashboard) if selected, `.env.example` pre-filled for the chosen DB engine, and a working `package.json` with correct dependency versions pinned (not `latest`)
   - Run `npm install` (or the chosen package manager) automatically, with a `--skip-install` flag to opt out
   - Print clear next-steps output: `cd my-app`, migrate/seed commands, `npm run dev`, and the local URL
3. The generated app must actually boot and pass `npm run typecheck` immediately after scaffolding with zero manual fixes — verify this in CI (see 8D).
4. Keep the starter template in a `templates/` (or separate `create-chava-app/template/`) directory versioned alongside the framework so template and framework core don't drift apart across releases.

## PHASE 8C — Playwright Browser Tests

1. Add Playwright, configured against the existing example/demo app (the one with Login/Register/Dashboard/Notifications from Phase 7).
2. Cover, at minimum, real browser flows the Vitest feature tests can't: full register → login → dashboard → logout journey; CSRF/session cookie behavior across a real navigation (not just HTTP assertions); the notification inbox mark-as-read Motion animation completing and the item actually leaving the DOM; the theme toggle (dark mode) persisting across a page reload; a form validation error appearing without a full page reload (proving Inertia's SPA behavior works, not just that the server returns the right payload).
3. These are genuinely different from the existing Vitest HTTP tests — the point is verifying client-side behavior (Inertia's partial reloads, Motion's `AnimatePresence`, React state) actually works in a real browser, not just that the server returns correct payloads.
4. Add `npm run test:e2e` script; keep these separate from the fast Vitest unit/feature suite so CI can run them in parallel.

## PHASE 8D — CI (GitHub Actions)

1. `.github/workflows/ci.yml`: on every PR and push to `main` —
   - Install deps, `npm run typecheck`, `npm test` (Vitest, SQLite — fast, no services needed)
   - A second job matrix running `npm test` against Postgres and MySQL via service containers (`services:` block in the Actions YAML, not the docker-compose file — that one's for local dev)
   - A third job running the Playwright suite (`npm run test:e2e`) against a built version of the example app
   - A fourth job scaffolding a fresh app via `create-chava-app` in a clean temp directory and verifying it typechecks and boots (`curl` the root route and assert 200) — this is the single most important CI check for user trust, since it's exactly what a new user's first five minutes look like
2. Fail the build on any of the above failing. Require this workflow to pass before merge (branch protection — actual GitHub setting, note it in a comment/PR description since the agent can't configure repo settings directly unless it has gh CLI access).
3. Cache `node_modules`/npm cache between runs for speed.

## PHASE 8E — Remaining Smaller `planned` Items

Address these if time allows, in priority order (skip and leave as `planned` in `PARITY.md` if not, but don't leave the file inaccurate):

1. **Multipart file uploads** on `Request` (`request.file()` — currently parsing is `planned` per PARITY.md Phase 2). This is commonly needed (avatar uploads, etc.) and worth closing before v1.
2. **Route caching** — lower priority; Node's startup cost is already low compared to PHP's per-request bootstrap, so this is less urgent than it is in Laravel. Fine to leave `planned` with a note explaining why it's lower priority for a Node runtime.
3. **Contextual bindings** (`when().needs()`) in the container.
4. **Broadcast notification channel** — only pursue if you also want to scaffold a WebSocket/Pusher-equivalent story; otherwise explicitly mark `wontfix` with rationale rather than leaving it as a stale `planned`.

## DELIVERABLES

- All code changes with tests (unit + feature + the new Playwright e2e suite)
- `PARITY.md` updated to reflect true status of every item touched
- `CHANGELOG.md` entry (`## [0.7.0] or [1.0.0-rc.1]`) following the existing format/voice
- `README.md` updated: multi-database setup instructions, `create-chava-app` usage replacing the current manual clone-based getting-started steps
- A short `PHASE8_REPORT.md` at repo root summarizing what shipped, what's still `planned`/`wontfix` and why, and an honest recommendation on whether the project is ready to be tagged `v1.0.0` or should ship as `v1.0.0-rc.1` / stay in `0.x` a bit longer

Do not mark anything `done` in `PARITY.md` that doesn't have a passing test proving it.
