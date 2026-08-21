# Coding Agent Prompt: Open-Source chavaJs for Public Release

Copy everything below into your coding agent. Run this **after** the Phase 8
completion prompt — chavaJs should have Postgres/MySQL support, CI, the
`create-chava-app` installer, and Playwright tests in place before public
announcement, since SQLite-only support and no CI are hard adoption blockers.

---

## CONTEXT FOR THE AGENT

chavaJs is a Laravel-equivalent framework in TypeScript (Inertia + React +
Tailwind + shadcn/ui + Motion on the frontend). Read `PARITY.md`,
`CHANGELOG.md`, `README.md`, and `PHASE8_REPORT.md` (if present) in the repo
root first — do not redo work already done. This phase is packaging,
licensing, publishing, and documentation infrastructure only. **Do not add
new framework features in this phase.**

**Naming decision required first:** the project has been referred to as both
"chavaJs" and "Lumen.js" across different working documents. Before doing
anything else, confirm with the maintainer (ask, don't assume) which name is
final, and do a quick sanity check that the npm package name and GitHub org
name are actually available before proceeding — renaming after packages are
published is expensive (broken imports for every early adopter, stale
Google-indexed docs, split GitHub stars). This prompt uses **chavaJs** /
`chava` (CLI binary) throughout since that's what the current codebase uses;
substitute the confirmed name everywhere below if it changes.

---

## PHASE A — LICENSING & LEGAL BASICS

1. The README already states MIT — confirm a proper `LICENSE` file exists at
   repo root with the correct copyright holder name and year (ask the
   maintainer who/what entity should be named, e.g. an individual or a future
   foundation).
2. Run `npx license-checker --summary` across all dependencies (framework
   core + the example app + `create-chava-app`) and flag anything GPL/AGPL
   or otherwise incompatible with MIT redistribution. Note `pg`, `mysql2`,
   `bullmq`, `nodemailer` are already optional peer deps per Phase 8 — check
   their licenses too since users will install them.
3. Add `CONTRIBUTING.md`: local dev setup (`npm install`, `npm test`,
   `npm run typecheck`, running against all three DB engines via
   `docker-compose.test.yml`), coding standards, PR process, and a DCO
   sign-off requirement (`Signed-off-by:` in commits) rather than a
   heavyweight CLA.
4. Add `SECURITY.md` — private vulnerability reporting process (GitHub's
   private vulnerability reporting feature or a dedicated email). This
   matters more than usual here since the framework ships its own auth
   (session guards, Sanctum-style tokens, CSRF, Hash/scrypt) — be explicit
   that auth/crypto-related reports should never be filed as public issues.
5. Add `CODE_OF_CONDUCT.md` (Contributor Covenant template).

## PHASE B — MONOREPO & PACKAGE STRUCTURE

The current repo is a single application-shaped project (`app/`, `src/`,
`bin/chava.js`, `resources/`). Restructure into a publishable monorepo using
**pnpm workspaces**:

```
packages/
  core/              → @chavajs/core        (container, router, ORM, validation,
                                              auth, queue, events, mail, notifications,
                                              scheduling — everything currently in src/)
  cli/               → @chavajs/cli         (the `chava` binary, currently bin/chava.js)
  inertia-react/     → @chavajs/inertia-react (the Inertia server adapter +
                                                frontend integration helpers)
create-chava-app/    → create-chava-app     (from Phase 8B — already npx-runnable,
                                              just needs to move into the monorepo)
docs/                → documentation site source
examples/
  starter/           → the current demo app (users/posts/auth/notifications),
                        rehomed here as the canonical reference implementation
```

For each package:
- Correct `package.json`: `name`, `version` (start all internal packages at
  `0.1.0` even if the app itself is further along — public package versioning
  starts fresh), `description`, `keywords` (`laravel`, `inertia`, `react`,
  `fullstack`, `orm`, `typescript`), `license`, `repository`, `homepage`,
  `bugs`.
- Proper `exports` map + generated `.d.ts` types so `@chavajs/core` consumers
  get real TypeScript hints, not `any`.
- No circular workspace dependencies — `cli` and `inertia-react` depend on
  `core`, not the reverse.
- Move the `pg`/`mysql2`/`bullmq`/`nodemailer`/`ioredis` optional-dependency
  pattern from Phase 8 into `@chavajs/core`'s `peerDependenciesMeta` with
  `optional: true`, matching how the existing code already treats them.

Verify `examples/starter` still boots and passes its full test suite
(Vitest + Playwright) against the newly-extracted packages via workspace
`link:`/`workspace:*` references before proceeding — this is the step most
likely to surface breakage from the extraction.

## PHASE C — VERSIONING, BUILD & PUBLISHING PIPELINE

1. Integrate **Changesets** for cross-package versioning and changelog
   generation. Migrate the existing hand-written `CHANGELOG.md` history into
   per-package changelogs going forward (keep the root `CHANGELOG.md` as a
   historical record of the pre-monorepo app-shaped releases — don't delete
   history).
2. Extend the existing CI (`.github/workflows/ci.yml` from Phase 8D) rather
   than replacing it: it should already run typecheck/Vitest (SQLite +
   Postgres + MySQL matrix)/Playwright/installer-boot-check — add a build
   step verifying every `packages/*` package builds cleanly and its
   `exports` resolve.
3. Add `.github/workflows/release.yml`: on merge to `main` with pending
   changesets, build all packages, publish to npm with `--provenance`, and
   create a GitHub Release with the generated changelog.
4. **Reserve npm package names now** (`@chavajs/core`, `@chavajs/cli`,
   `@chavajs/inertia-react`, `create-chava-app`) with placeholder `0.0.1`
   publishes, before any public announcement, to prevent name-squatting —
   this should happen as early as possible, ideally before Phase B even
   finishes, since it's a five-minute task with a real time-sensitivity risk.
5. Confirm end-to-end: `npx create-chava-app my-app` → prompts for DB engine
   (per Phase 8B) → scaffolds → `cd my-app && chava migrate && chava db:seed
   && npm run dev` works on a machine with no prior clone of the framework
   repo.
6. Enable branch protection on `main`: require the full CI matrix to pass
   plus one review before merge.

## PHASE D — DOCUMENTATION SITE

1. Scaffold under `docs/` with **VitePress**.
2. Information architecture (mirrors Laravel's docs structure, and the
   README already has most of the source content to adapt):
   - **Getting Started** — installation via `create-chava-app`, directory
     structure, configuring each of the three supported databases,
     deployment notes
   - **Concepts** — routing, controllers, middleware, requests/responses,
     the ORM (models, migrations, relationships, query builder — the README
     already has working code samples to adapt directly), validation, auth
     (session guards, Sanctum-style tokens, gates/policies), sessions & CSRF
   - **Digging Deeper** — events & auto-discovered listeners (including the
     `ShouldQueue` listener pattern), jobs/queues (sync/database/redis),
     notifications (mail + database channels), mail, task scheduling, the
     full `chava` CLI reference, `tinker`
   - **Frontend** — Inertia basics, Pages/Layouts conventions, `useForm()` +
     shadcn error-field binding (the README's Phase 7 pattern), shadcn/ui
     theming, Motion animation patterns (page transitions, list stagger,
     `AnimatePresence`)
   - **Testing** — Vitest unit/feature tests, the Playwright e2e suite from
     Phase 8C, `freshApp` test helper conventions
   - **API Reference** — generated from `@chavajs/core`'s TypeDoc output
   - **Laravel → chavaJs** — publish the existing cheat-sheet table from
     `README.md` and the full `PARITY.md` mapping as a dedicated page; this
     is the single highest-value page for the target audience (Laravel devs
     evaluating a Node alternative)
3. Every code sample must be verified runnable — the README's existing
   end-to-end examples (auth, ORM, tinker, events/queues/mail, notification
   inbox) are already high quality; port them into the docs site rather than
   rewriting, and add a CI check that extracts and typechecks doc code blocks
   against the current package versions to prevent drift.
4. Deploy via Vercel or Netlify with PR preview deployments.
5. Homepage: one-line pitch ("The Laravel framework for Node.js"), the
   `npx create-chava-app` command front and center, a terminal recording of
   scaffold → migrate → seed → dev server → `/users` and `/notifications`
   pages loading, and a prominent "Coming from Laravel? Start here" link to
   the cheat-sheet page.

## PHASE E — REPO HYGIENE & DISCOVERABILITY

1. Rewrite root `README.md` for the monorepo (the current single-app README
   is excellent content — repurpose most of it, but reframe the getting
   started section around `npx create-chava-app` instead of `git clone` +
   manual setup, and add badges: npm version per package, CI status,
   license, downloads).
2. `.github/ISSUE_TEMPLATE/` (bug report — include a "which database engine"
   field given three are now supported; feature request) and
   `.github/PULL_REQUEST_TEMPLATE.md`.
3. `keywords` in each `package.json` + GitHub repo topics for search.
4. Label a handful of well-scoped `good first issue`s — the Phase 8E
   "smaller planned items" (contextual bindings, route caching, broadcast
   channel) are good candidates if not already done, since they're
   self-contained and don't require deep framework context.
5. `ROADMAP.md` or a GitHub Project board reflecting real status post-Phase-8.

## PHASE F — LAUNCH READINESS CHECKLIST

Verify and report on each before recommending public announcement:

- [ ] `npx create-chava-app test-app` works on a clean machine/container,
      for all three database engine choices
- [ ] All `@chavajs/*` packages install independently with correct peer
      dependency resolution (including the optional `pg`/`mysql2`/etc.)
- [ ] Full CI matrix green on `main` (typecheck, Vitest × 3 DB engines,
      Playwright, installer boot-check), branch protection active
- [ ] Docs site live, all example code verified against current versions
- [ ] LICENSE, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT present and correct
- [ ] `examples/starter` demonstrates auth, ORM CRUD, events/queues/mail,
      and the notification inbox — the existing demo app already covers all
      of this, just confirm it survived the monorepo extraction intact
- [ ] GitHub Discussions (or Discord) enabled and linked from the README
- [ ] `git log` / secret-scan confirms no committed `.env` files or API keys
      across history
- [ ] Final name (chavaJs vs. alternatives) confirmed and consistent across
      every package name, CLI binary, docs URL, and repo name — no leftover
      references to earlier working names in code, docs, or package.json files

Produce `LAUNCH_READINESS.md` summarizing status against this checklist and
flag anything not yet safe to announce.

## OUT OF SCOPE

No marketing copy, no submission to Awesome-lists or forums — that's a
manual step after this phase. This phase only makes the project *ready* to
be shared.
