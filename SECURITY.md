# Security Policy

chavaJs implements its own authentication, session management, CSRF
protection, and password hashing (see `PARITY.md` Phase 4). Vulnerabilities
in these areas can affect every application built on the framework —
please report them privately rather than as public GitHub issues.

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Please report suspected vulnerabilities using
[GitHub's private vulnerability reporting](../../security/advisories/new)
(Security tab → "Report a vulnerability"). If that's unavailable, email
**[SECURITY CONTACT EMAIL HERE]**.

Include, if possible:
- A description of the vulnerability and its potential impact
- Steps to reproduce, or a minimal proof-of-concept
- The affected version(s) and, if known, the affected file(s)/module(s)
- Whether you're aware of it being exploited in the wild

We'll acknowledge your report within **3 business days** and aim to provide
an initial assessment (severity, whether it's confirmed, expected timeline)
within **7 business days**. We ask that you give us a reasonable window to
ship a fix before any public disclosure — we're happy to coordinate a
disclosure timeline with you and credit you in the release notes and/or a
`SECURITY.md` acknowledgments section, if you'd like.

## Areas that warrant extra caution when reporting

Given chavaJs's current feature set, the following are especially
sensitive — if your finding touches any of these, please treat it as a
private report even if you're not fully sure it's exploitable:

- **Session handling** (`StartSession`, signed session cookies, session
  fixation/regeneration on login/logout)
- **CSRF protection** (`VerifyCsrfToken`, the `XSRF-TOKEN` cookie /
  `X-XSRF-TOKEN` header flow)
- **Password hashing** (`Hash` — scrypt-based)
- **Auth guards and tokens** (`SessionGuard`, Sanctum-style personal access
  tokens, token hashing/expiry)
- **Gates and Policies** (authorization bypass, e.g. a policy method that
  doesn't correctly restrict access)
- **The ORM's SQL generation** (any path where user input could reach raw
  SQL without proper parameterization — SQL injection)
- **The `tinker` REPL** — this is explicitly a developer tool that runs
  arbitrary code with host privileges by design (like Laravel's own
  tinker), so vulnerabilities here are only in scope if they affect
  *non-tinker* code paths (e.g., if application code could be tricked into
  invoking tinker's eval machinery unintentionally).

## Supported versions

Security fixes are backported to the latest minor release on the current
major version line. Once chavaJs reaches `v1.0.0`, this table will be kept
up to date with supported version ranges.

| Version | Supported |
| ------- | --------- |
| `0.x` (latest) | ✅ |
| `0.x` (older releases) | ❌ — please upgrade to latest before reporting |

## Scope

This policy covers the chavaJs framework itself (`@chavajs/core`,
`@chavajs/cli`, `@chavajs/inertia-react`, `create-chava-app`). Vulnerabilities
in third-party dependencies (e.g., `pg`, `mysql2`, `bullmq`, `nodemailer`)
should be reported to those projects directly, though we'd appreciate a
heads-up if it affects how chavaJs uses them.
