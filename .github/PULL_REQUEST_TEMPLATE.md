## Description

<!-- What does this PR change, and why? Reference any related issues. -->

## Type of change

- [ ] Bug fix
- [ ] New Laravel-parity feature
- [ ] Docs / repo hygiene
- [ ] Refactor (no behavior change)

## Testing

<!-- Be specific. Which engine(s) did you run against? -->

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (SQLite)
- [ ] `npm run test:postgres` / `npm run test:mysql` (if the change touches the
      database layer)
- [ ] `npm run test:browser` (if the change touches frontend / Inertia behavior)
- [ ] `npm run assemble` run after any `packages/*` edits

Database engine(s) tested: **sqlite / pg / mysql**

## Checklist

- [ ] New public APIs (facades, CLI commands, Blueprint column types) have tests
- [ ] `PARITY.md` updated if this maps to a Laravel feature (with any deviation noted)
- [ ] `CHANGELOG.md` entry added following the existing format/voice
- [ ] Commits signed off (`git commit -s`) — DCO, see `CONTRIBUTING.md`
- [ ] No `any` introduced in framework core (`packages/*/src`)