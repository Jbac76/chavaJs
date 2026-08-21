# chavaJs — PHASE8_REPORT

**Date:** 2026-08-10 · **Version:** `1.0.0-rc.1`

This report covers the work performed to complete the Phase 8 items from
[`ai/chavajs-phase8-completion-prompt.md`](./ai/chavajs-phase8-completion-prompt.md)
and the repo-side deliverables of the open-source prompt. The headline is that
the repository was **mid-way through a monorepo migration and was broken**; most
of this phase's effort went into repairing that split so the framework, the
reference app, the installer and CI are green again.

---

## What shipped

### Phase 8A — Postgres & MySQL drivers (`done`)

`PostgresConnection` / `MySQLConnection`, per-driver query + schema grammars,
optional `pg` / `mysql2` peer deps, and the `TEST_ALL_DRIVERS=1` test-matrix
were already present from the pre-migration work. Verified:

- 17 driver unit tests (`tests/Unit/drivers.test.ts`) — grammar resolution,
  placeholder rewrite, `run()` result mapping — pass on the assembled app.
- `docker-compose.test.yml` runs throwaway Postgres 16 + MySQL 8.
- `npm run test:postgres` / `npm run test:mysql` are wired portably.
- CI matrix runs the suite against both engines via GitHub `services:`.

### Phase 8B — `create-chava-app` installer (`done`)

The npx-runnable scaffolder existed but targeted the old single-`src/` layout
and could never locate the framework. Fixed:

- `resolveFrameworkRoot` now locates the checkout via
  `packages/core/src/foundation/Application.ts`.
- The installer **assembles** the framework from `packages/*` into the new
  app's `src/` + `bin/` (core, `src/inertia`, `src/cli`, `bin`) instead of
  copying a monolithic `src/`.
- `template/routes/web.noauth.ts` added; the stale `routes/web.auth.ts` strip
  reference removed — so `--no-auth` genuinely swaps routes and strips the
  auth UI.
- **Verified end-to-end:** scaffold (auth) → `tsc --noEmit` clean → `chava
  migrate` → `chava db:seed` → `chava route:list` boots. The CI `installer` job
  repeats this in a clean directory and asserts the root route renders.

### Phase 8C — Playwright browser tests (`done`)

The spec existed but could not run because (a) Vite 6 emits the manifest under
`.vite/`, which the HTML renderer didn't read, and (b) the e2e server booted in
dev mode and injected missing Vite-dev-server scripts. Fixed both:

- `HtmlRenderer` now reads `public/build/manifest.json` **or**
  `.vite/manifest.json`.
- `e2e-server.ts` boots with `APP_ENV=production` and the suite runs against a
  production asset build.

`npm run test:browser` passes (register → dashboard → inbox → mark-read, inside
a real Chromium).

### Phase 8D — CI (`done`, rewritten for the monorepo)

`.github/workflows/ci.yml` now has four jobs:

1. `typecheck-test-build` — `npm ci`, `npm run assemble`, typecheck, Vitest
   (SQLite), production build.
2. `database-drivers` — matrix over `pg` / `mysql2`, running the full suite
   against the GitHub Actions `services:` Postgres + MySQL containers.
3. `browser` — Playwright against a built reference app.
4. `installer` — `create-chava-app` in a clean temp dir, then typecheck,
   migrate, seed, boot, and `curl` assert the root route.

### Phase 8E — remaining smaller items

- **Multipart file uploads** — already implemented (`src/http/multipart.ts`,
  `Request.file()`); 6 unit tests. PARITY.md updated to `done`.
- **Contextual bindings** — already implemented (`when().needs().give()` + the
  `ContextualBindingBuilder`); PARITY.md updated to `done`.
- **Route caching** — left `planned` with rationale (Node startup is already
  cheap; a serialized route cache buys little). See `ROADMAP.md`.
- **Broadcast channel** — left `planned` (needs a WebSocket/Pusher-equivalent
  story first). See `ROADMAP.md`.

### Monorepo repair (the bulk of the work)

The repo was a broken intermediate migration: `packages/*` had no
`package.json`, `examples/starter` had no `package.json`/`src`/`bin`,
`packages/cli` and `packages/inertia-react` imports still pointed at the flat
layout, `packages/core`'s `Inertia` facade and `InertiaServiceProvider` were
lost, and every root script / CI job failed. Now:

- `packages/core` (`@chavajs/core`), `packages/cli` (`@chavajs/cli`),
  `packages/inertia-react` (`@chavajs/inertia-react`) have real `package.json`
  metadata.
- `scripts/assemble-framework.mjs` merges the packages into an app's `src/` +
  `bin/` (the "embedded framework" model — the same thing the installer does
  for new apps).
- `examples/starter/` has a `package.json`, an assembled `src/`+`bin/`, a root
  `tsconfig`, and is green: **`tsc --noEmit` clean, 208 Vitest tests pass, the
  Playwright spec passes, and the production build succeeds.**
- Root npm workspaces + scripts delegate to the reference app.
- `AI`/open-source repo hygiene: `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md` at the root; issue + PR templates; `ROADMAP.md`.

---

## Still `planned` / deferred (honest status)

| Item | Status this phase |
| --- | --- |
| Publishable `@chavajs/*` npm packages (exports maps, `.d.ts`, Changesets releases) | deferred — the split exists, apps assemble it; publishing is the next packaging step |
| Documentation site (`docs/` VitePress) | deferred (repo-side scope) |
| `@inject()` decorator | `planned` (PARITY.md Phase 1) |
| Route caching | `planned` (PARITY.md Phase 2, low value on Node) |
| Broadcast notification channel | `planned` (PARITY.md Phase 5) |
| Email verification resend/notify UI | `planned` (PARITY.md Phase 4) |
| React Email / MJML mail source | `planned` (PARITY.md Phase 5) |
| npm publish, npm-name reservation, branch protection, docs deploy | **manual, outside this session** — documented in `ROADMAP.md` / `LAUNCH_READINESS.md`-style checklist below |

---

## Release recommendation

**Ship as `1.0.0-rc.1`, not `v1.0.0`.** The framework is feature-complete for
the advertised surface and the mono-repo is green off a fresh checkout — but a
`v1.0.0` announcement is only credible once the packages are *published*
(`@chavajs/core`, `@chavajs/cli`, `@chavajs/inertia-react`, `create-chava-app`),
`npx create-chava-app` works from the registry (not just from a checkout), and
the docs site is live. What to do before the tag:

- [ ] Reserve npm names (`@chavajs/*`, `create-chava-app`) with placeholder publishes.
- [ ] Add Changesets + a `.github/workflows/release.yml` (build → publish → GitHub Release).
- [ ] Scaffold the VitePress docs site; port the README/PARITY content; verify code blocks.
- [ ] Enable branch protection on `main` (full CI + 1 review).
- [ ] Run `npx create-chava-app test-app` on a throwaway machine for all three DB
      engine choices as the final smoke test.
- [ ] Enable GitHub Discussions / Discord and link from the README.
- [ ] Secret-scan the git history for committed `.env` / keys before the first push.