# chavaJs Roadmap

Statuses: `planned` · `in-progress` · `done` · `wontfix`. Every item also lives
in [`PARITY.md`](./PARITY.md) with its Laravel-equivalent mapping. This file
tracks the *next* work, not the history (see `CHANGELOG.md` for what shipped).

## Next up (post-v1.0.0-rc.1)

- [ ] **Publishable `@chavajs/*` packages.** The monorepo split exists
      (`packages/core`, `packages/cli`, `packages/inertia-react`) and apps
      consume the framework by *assembly* (`create-chava-app` merges the
      packages into the app's `src/` + `bin/`). Publishing true npm packages
      with `exports` maps, `.d.ts` types, and Changesets-driven releases is the
      remaining packaging step.
- [ ] **Documentation site** under `docs/` (VitePress): Getting Started,
      Concepts (routing/ORM/auth), Digging Deeper (queues/events/mail),
      Frontend (Inertia/shadcn/Motion), Testing, and the Laravel → chavaJs
      cheat-sheet ported from `README.md` + `PARITY.md`.
- [ ] **`@inject()` decorator** support as an explicit alternative to
      by-name constructor injection (`planned` in PARITY.md Phase 1).
- [ ] **Route caching** (`planned` in PARITY.md Phase 2). Lower priority than
      in Laravel — Node's startup cost is already small compared to PHP's
      per-request bootstrap.
- [ ] **Broadcast notification channel** (`planned` in PARITY.md Phase 5).
      Only sensible once a WebSocket/Pusher-equivalent story exists.
- [ ] **Email verification resend/notify UI** (`planned` in PARITY.md Phase 4).
      `EnsureEmailIsVerified` + `email_verified_at` already exist; the resend
      flow and UI are missing.
- [ ] **React Email / MJML** as an alternative mail-template source
      (`planned` in PARITY.md Phase 5).
- [ ] **`good first issue`s**: context-free candidates — the smaller
      `planned` items above are self-contained.

## Recurring

- [ ] Keep `npm run test:postgres` / `test:mysql` green via
      `docker-compose.test.yml` (CI matrix).
- [ ] Keep the `create-chava-app` template in sync with `examples/starter`
      (the reference implementation).

## Won't fix (deliberate deviations)

- Route caching via a serialized route file — noted as `planned` but documented
  as lower-value on a Node runtime; revisit only if benchmarks demand it.
- PHP/Blade/Composer parity — the framework is a *concept* port, not a syntax
  port (see PARITY.md deviations).