# chavaJs — Framework Review Remediation Plan

Source: `FRAMEWORK_REVIEW.md` (Aug 22, 2026), audited against codebase on Aug 22, 2026.
Verdicts below reflect what was actually verified in code, not just claimed in the review.

---

## Audit Summary

| # | Issue | Severity | Verdict after code audit |
|---|-------|----------|--------------------------|
| 1.1 | Missing CORS validation | CRITICAL | ✅ Real — no CORS code exists anywhere |
| 1.2 | MemoryCacheDriver interval leak | CRITICAL | ⚠️ Half-real — destroy exists but is never called on shutdown; timer not unref'd |
| 1.3 | Unvalidated file uploads | CRITICAL | ✅ Real — no MIME whitelist / traversal guard |
| 1.4 | Dispatch error handling | CRITICAL | ❌ Stale — GlobalErrorHandler already catches and renders correctly |
| 1.5 | Session timeout validation | CRITICAL | ✅ Real — zero expiry/lifetime logic in SessionStore |
| 2.1 | N+1 lazy loading | HIGH | ⚠️ By design (Laravel parity) — add detection/warning, not request cache |
| 2.2 | Builder typing (`unknown`) | HIGH | ⚠️ Partially typed already — tighten generics only |
| 2.3 | ValidationException lacks input context | HIGH | ⚠️ Half-real — `errors` exists; add `input` for old() flash |
| 2.4 | Job retry has no exponential backoff | HIGH | ✅ Real — fixed `backoff = 3`, no array/exponential support |
| 2.5 | No graceful shutdown in serve | HIGH | ⚠️ Half-real — SIGINT/SIGTERM + server.close exist; missing DB/queue/scheduler teardown and forced-exit timeout |
| 3.1 | Route cache never invalidated in dev | MEDIUM | ✅ Real — no hash/invalidate logic |
| 3.2 | Inconsistent error response format | MEDIUM | ✅ Real |
| 3.3 | Cache TTL hardcoded (increment/decrement) | MEDIUM | ✅ Real |
| 3.4 | Transaction API undocumented | MEDIUM | ✅ Real |
| 3.5 | CI only tests SQLite | MEDIUM | ✅ Real |
| 4.1 | No request tracing (X-Request-ID) | LOW | ✅ Real |
| 4.2 | Model casts re-applied every access | LOW | ✅ Real |
| 4.3 | `where()` implicit `=` undocumented | LOW | ✅ Real |

---

## Phase 1 — Security Hardening (core → 1.2.0)

- [ ] **1. CORS middleware**
  - Files: `packages/core/src/http/middleware/HandleCors.ts` (new), `packages/core/src/http/Kernel.ts`, `packages/cli/template/config/cors.ts` (new)
  - Config: `allowed_origins`, `allowed_methods`, `allowed_headers`, `supports_credentials`, `max_age`
  - Short-circuit OPTIONS preflight with 204 + headers
  - Wire into global middleware stack before session/CSRF
- [ ] **2. File upload validation**
  - Files: `packages/core/src/http/multipart.ts`, `packages/core/src/http/Request.ts`
  - Reject path traversal in filenames (`..`, `/`, `\`)
  - Per-field MIME whitelist via config (default: images + pdf); reject otherwise
  - Enforce size cap from config
  - Sanitize stored filename (slugify, collision suffix)
- [ ] **3. Session hardening**
  - Files: `packages/core/src/session/SessionStore.ts`, `packages/core/src/session/handlers.ts`
  - Add absolute expiry + idle timeout, validated on every read
  - Expired sessions invalidate server-side and return empty store
  - Keep regenerate-on-login (already present)
- [ ] **4. Tests**: CORS allow/deny/preflight, upload rejection cases, expired-session rejection

## Phase 2 — Reliability (same 1.2.0 release)

- [ ] **5. Cache driver cleanup**
  - `packages/core/src/cache/CacheManager.ts`: `.unref()` the interval; expose `destroy()`
  - `packages/core/src/foundation/Application.ts`: `shutdown()` calls cache.destroy(), db close, queue stop
- [ ] **6. Graceful shutdown completion**
  - `packages/cli/src/commands/serve.ts`: await `server.close()` (drain in-flight), close DB connections, stop queue workers + scheduler, force-exit after 30s
- [ ] **7. Job backoff**
  - `packages/core/src/queue/Job.ts`: `backoff: number | number[]` (default `[1, 5, 30, 120]`)
  - `QueueManager`/worker honors per-attempt delay
- [ ] **8. Tests**: shutdown drains without hang; backoff sequence asserted

## Phase 3 — DX & API Consistency

- [ ] **9. Standard error envelope** — `packages/core/src/http/GlobalErrorHandler.ts`
  - All errors return `{ error: { code, message, details? } }`
  - ValidationException keeps 422 status; field map moves under `details.errors`
- [ ] **10. ValidationException.input** — `packages/core/src/support/exceptions.ts`
  - Attach original input; error handler flashes old input on inertia/redirect responses
- [ ] **11. Route cache dev invalidation** — `packages/core/src/http/Router.ts`
  - Hash routes directory at cache time; in local env compare + auto-invalidate with warning
- [ ] **12. Configurable cache TTL** — `packages/core/src/cache/CacheManager.ts`, `config/cache.ts`
  - `defaultTtl` config; increment/decrement use it instead of hardcoded hour

## Phase 4 — Docs & CI

- [ ] **13. Transactions documentation** — `packages/core/docs/09-database.md`
  - `DB.transaction`, savepoints, isolation levels, error rollback semantics
- [ ] **14. Postgres CI job** — `.github/workflows/ci.yml`
  - Service container postgres; run suite with `DB_CONNECTION=pg`; keep SQLite job as-is
- [ ] **15. Low-priority items**
  - X-Request-ID middleware + inclusion in log lines
  - Model attribute-cast memoization per instance
  - Document implicit `=` in `where(col, value)` (docs/11-eloquent.md + JSDoc)

---

## Ship Strategy

- Bump `@chavajs/core` + `@chavajs/cli` to **1.2.0** (new middleware/config = minor)
- Installer republish only if template gains `config/cors.ts` (+0.0.x or align to 1.2.0)
- Publish order: core → cli → installer

## Phase 5 — Final Documentation, Verification & Release

- [ ] **16. Update documentation for all changes**
  - New docs page: `packages/core/docs/29-cors.md` (config options, preflight, credentials)
  - Update `packages/core/docs/06-requests.md` — upload validation rules + error responses
  - Update `packages/core/docs/14-sessions.md` — absolute expiry + idle timeout config
  - Update `packages/core/docs/16-queues.md` — backoff (number/array), per-attempt delays
  - Update `packages/core/docs/20-console.md` + `22-deployment.md` — graceful shutdown behavior
  - Update `packages/core/docs/12-seeding.md` / `09-database.md` if transactions doc lands there
  - Update `packages/core/docs/00-index.md` index entries for any new pages
  - Update root `README.md` feature table + CLI/config examples; sync `PARITY.md` rows
  - Regenerate starter app (`npm run assemble`) so `examples/starter/docs` match published docs
- [ ] **17. Full test & verification pass**
  - [ ] `npm test` at repo root — all suites green (starter + installer packages)
  - [ ] `npm run typecheck` — clean
  - [ ] Manual E2E: `chava new <app>` → migrate auto-runs (auth path) → serve boots → `/`, `/about`, `/users` respond correctly
  - [ ] Manual E2E no-auth path: nav has no Users/Login links, routes absent, no migration run
  - [ ] CORS verified manually: allowed origin passes, disallowed blocked, OPTIONS preflight returns headers
  - [ ] Upload validation verified: bad MIME rejected, traversal filename rejected, oversized rejected
  - [ ] Session expiry verified: expired session id is rejected server-side
  - [ ] Graceful shutdown verified: SIGTERM drains in-flight request then exits within timeout
  - [ ] Queue backoff verified: failed job retried with increasing delays
  - [ ] Error envelope verified consistent across ValidationException / NotFound / Authorization
  - [ ] Route cache invalidates automatically after editing routes in local env
  - [ ] Installer unit tests green (`packages/installer`)
- [ ] **18. Push to GitHub**
  - Stage only intended files; commit per phase or one release commit with detailed body
  - Switch remote to HTTPS for push (`https://github.com/Jbac76/chavaJs.git`), push master, switch remote back to SSH
- [ ] **19. Publish to npm**
  - Publish order: `@chavajs/core@1.2.0` → `@chavajs/cli@1.2.0` → `@chavajs/installer` (if changed)
  - Use `npm publish --access public`; retry on E409 (registry propagation)
  - Verify with `npm view @chavajs/core version` etc.
  - Post-publish smoke test: fresh global install of installer, delete `~/.chava/core` cache, scaffold a throwaway app from npm, boot it, delete it

## Explicitly Rejected (from review)

- **1.4 dispatch rewrite** — already handled by GlobalErrorHandler; no action
- **2.1 request-level relation cache** — breaks Laravel parity semantics; prefer N+1 detection warning in local env (folded into Phase 3 backlog if time permits)
