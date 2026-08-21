# Contributing to chavaJs

Thanks for considering a contribution. chavaJs ports Laravel's architecture
and conventions to TypeScript — the guiding principle for any change is
**"port the concepts, not the syntax."** If you're unsure how a Laravel
feature should map to idiomatic JavaScript, check `PARITY.md` first; it
documents every existing mapping and the reasoning behind deliberate
deviations.

## Before you start

- Check open issues and `PARITY.md` (status: `planned`) so you don't
  duplicate work already in progress.
- For anything larger than a small bugfix, open an issue first to discuss
  the approach — this is especially true for anything touching auth,
  sessions, or the ORM's SQL generation, where subtle correctness bugs are
  easy to introduce and hard to spot in review.
- Small fixes (typos, docs, obvious bugs with tests) can go straight to a PR.

## Local setup

```bash
git clone <repo-url>
cd chavajs
npm install
cp .env.example .env
node bin/chava.js migrate
node bin/chava.js db:seed
npm run dev
```

## Running the test suite

```bash
npm test            # Vitest — unit + feature tests, SQLite by default
npm run typecheck   # tsc --noEmit, strict mode — must pass with zero errors
```

If your change touches the database layer (query builder, schema builder,
ORM, migrations), it must pass against **all three supported database
engines**, not just the SQLite default:

```bash
docker compose -f docker-compose.test.yml up -d   # spins up throwaway Postgres + MySQL
TEST_ALL_DRIVERS=1 npm test
docker compose -f docker-compose.test.yml down
```

If your change touches frontend behavior (Inertia navigation, Motion
animations, form error rendering), add or update a Playwright test rather
than relying on the Vitest HTTP feature tests — those only prove the server
returns the right payload, not that the browser behaves correctly.

```bash
npm run test:e2e
```

## Coding standards

- **TypeScript strict mode, no `any`** in framework core code
  (`packages/core` / `src/`). If you genuinely need an escape hatch, use
  `unknown` and narrow it, and explain why in a comment.
- Match the existing code's naming and structure conventions — chavaJs
  deliberately mirrors Laravel's directory and class-naming conventions
  (`app/Http/Controllers`, `app/Models`, PascalCase class files) even where
  that's slightly unusual for a JS project. This consistency is the point.
- New Laravel-parity features should come with a `PARITY.md` entry (status,
  notes on any deviation) and a `CHANGELOG.md` entry following the existing
  format — see recent entries for the expected voice (what was added, why,
  and any bugs the change fixed).
- Every new public API (a new facade method, a new CLI command, a new
  Blueprint column type, etc.) needs a test. PRs without tests for new
  behavior will be asked to add them before merge.
- If you're implementing something Laravel does with PHP magic (macros,
  magic methods), don't try to replicate the magic literally — replicate the
  *developer-facing behavior* using idiomatic JS (Proxies, decorators, ES
  modules). Document the approach in `PARITY.md`'s deviations section if it's
  non-obvious.

## Commit / PR process

- Sign off your commits (`git commit -s`) — chavaJs uses the Developer
  Certificate of Origin (DCO) instead of a CLA. This is a lightweight
  attestation that you have the right to submit the contribution under the
  project's MIT license; it adds a `Signed-off-by:` trailer to your commit
  message automatically.
- Keep PRs focused — one feature or fix per PR makes review much faster.
- Fill out the PR template, including which database engine(s) you tested
  against if the change touches the database layer.
- CI must pass (typecheck, Vitest across all three DB engines, Playwright,
  and — if your change touches the installer — a scaffold-and-boot check)
  before a PR can be merged.
- Be patient during review — auth, session, and ORM correctness bugs are
  taken seriously here, and reviewers may ask for additional tests or a
  closer look at edge cases (see `CHANGELOG.md` for examples of the kind of
  subtle bugs that have shipped before, like the session-fixation issue
  fixed in a past release — we'd rather catch these in review).

## Reporting bugs

Use the bug report issue template. Include your Node version, database
engine, and — if reproducible — a minimal failing test case; that's usually
the fastest path to a fix.

**Security vulnerabilities should not be filed as public issues** — see
`SECURITY.md` for the private reporting process, especially for anything
related to auth, sessions, CSRF, or password hashing.

## Code of Conduct

This project follows the Contributor Covenant. See `CODE_OF_CONDUCT.md`.
