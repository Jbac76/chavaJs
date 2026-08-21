# Security

chavaJs takes security seriously. This page covers every protection the
framework provides out of the box and what you should configure in production.

## CSRF Protection

The `VerifyCsrfToken` middleware (member of the `web` group) handles CSRF
automatically:

1. On every `GET` request, the middleware sets an `XSRF-TOKEN` cookie containing
   a random token.
2. Inertia's axios client reads that cookie and echoes it back as the
   `X-XSRF-TOKEN` header on every subsequent request (`POST`, `PUT`, `PATCH`,
   `DELETE`).
3. The middleware compares the header value to the session's CSRF token. A
   mismatch returns **419** (Laravel-exact behavior).

No meta tags needed — the flow is fully automatic with Inertia.

**Skip CSRF for a route** (e.g. webhooks):

```ts
// app/Http/Kernel.ts
webMiddleware: [StartSession, HandleInertiaRequests, VerifyCsrfToken],
```

```ts
// In bootstrap/app.ts — exclude specific URIs from CSRF verification
export const app = Application.configure({
  webMiddleware: [StartSession, HandleInertiaRequests, VerifyCsrfToken],
});
```

Or exclude routes in the middleware itself:

```ts
// src/http/middleware/VerifyCsrfToken.ts
protected except = ['/webhooks/*'];
```

## Session Security

Sessions are signed, HttpOnly cookies by default. Key settings in
`config/session.ts`:

| Setting | Default | Production recommendation |
|---|---|---|
| `driver` | `file` | `file` or an external store |
| `cookie` | `chava_session` | Keep as-is |
| `lifetime` | `120` (minutes) | Adjust as needed |
| `http_only` | `true` | **Always `true`** |
| `secure` | `false` | **Set to `true`** behind HTTPS |
| `same_site` | `lax` | **`lax`** (or `strict` if no cross-site) |

**Production `.env`:**

```
SESSION_SECURE=true
SESSION_SAME_SITE=lax
APP_DEBUG=false
```

### Session ID Validation

Session IDs are validated against a strict 64-character hexadecimal regex
(`/^[0-9a-f]{64}$/`). Invalid IDs are rejected immediately — no malformed
session ID can reach your application logic.

### Session Regeneration

The framework regenerates the session ID on login and logout (anti-fixation):
`session.regenerate()` produces a new ID and CSRF token while preserving flash
data.

## SQL Injection Prevention

Every query in the ORM uses **parameterized placeholders** (`?`). User input is
never interpolated into SQL strings:

```ts
// Safe — parameterized
await User.where("email", request.input("email")).first();

// Safe — parameterized
await DB.table("users").whereIn("id", ids).get();
```

**Raw queries** should also use placeholders:

```ts
// Safe — parameterized raw query
await DB.raw("SELECT * FROM users WHERE email = ?", [email]);

// DANGEROUS — never do this
await DB.raw(`SELECT * FROM users WHERE email = '${email}'`);
```

The query builder does not expose unsafe raw string interpolation by design.
If you use `DB.raw()`, always pass an array of bound parameters as the second
argument.

## Request Body Size Limits

The framework enforces a content-length check before reading the request body.
Requests exceeding the limit receive a **413 Payload Too Large** response:

```
413 Request Entity Too Large
```

The default limit is 10 MB. This protects against denial-of-service attacks
that send extremely large payloads.

## APP_KEY Enforcement

In production (`APP_ENV=production`), the framework validates that `APP_KEY` is
set and non-empty during bootstrap. If missing, the application refuses to
start with a clear error message. The key is used for:

- Signing the session cookie
- CSRF token generation
- Any encryption/hashing operations

**Never commit `APP_KEY` to version control.**

## Mass Assignment Protection

Models use `fillable` (whitelist) or `guarded` (blacklist) to control which
attributes can be mass-assigned:

```ts
export class User extends Model {
  public static fillable = ["name", "email", "password"];
}
```

When both `fillable` and `guarded` are empty (not set), the framework **blocks
all mass assignment** by default — a safer default than Laravel's
everything-allowed behavior.

## Password Hashing

`Hash` uses **scrypt** from Node's built-in `node:crypto` module — no native
dependencies:

```ts
const hash = await Hash.make("secret");
await Hash.check("secret", hash); // true
```

Stored hashes are format `scrypt$<salt>$<derived-hex>`.

## Production Hardening

### npm audit

Run `npm audit` regularly to check for known vulnerabilities in your
dependencies. Add it to your CI pipeline:

```bash
npm audit --audit-level=high
```

This fails the build on high or critical CVEs.

### Helmet.js

For HTTP security headers, add [Helmet](https://helmetjs.github.io/) to your
middleware stack:

```bash
npm i helmet
```

```ts
// app/Http/Middleware/SecurityHeaders.ts
import type { Request } from "../../src/http/Request";
import type { Response } from "../../src/http/Response";
import type { NextFunction } from "../../src/http/types";
import helmet from "helmet";

export class SecurityHeaders {
  public async handle(request: Request, next: NextFunction): Promise<Response> {
    const response = await next();
    // Apply Helmet headers to the raw Node response
    helmet()(request.nodeRequest, response.nodeResponse, () => {});
    return response;
  }
}
```

Register it in `bootstrap/app.ts`:

```ts
export const app = Application.configure({
  globalMiddleware: [SecurityHeaders],
  webMiddleware: [StartSession, HandleInertiaRequests, VerifyCsrfToken],
});
```

### Rate Limiting

Use a rate-limiting middleware for sensitive endpoints (login, registration,
password reset):

```bash
npm i express-rate-limit
```

```ts
// app/Http/Middleware/Throttle.ts
import type { Request } from "../../src/http/Request";
import type { Response } from "../../src/http/Response";
import type { NextFunction } from "../../src/http/types";
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

export class Throttle {
  public async handle(request: Request, next: NextFunction): Promise<Response> {
    return new Promise((resolve) => {
      limiter(request.nodeRequest, request.nodeResponse, () => {
        resolve(next());
      });
    });
  }
}
```

```ts
// routes/web.ts
Route.post("/login", [AuthController, "login"]).middleware(Throttle);
```

### Environment Checklist

| Setting | Value |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_KEY` | (set, non-empty) |
| `SESSION_SECURE` | `true` |
| `SESSION_SAME_SITE` | `lax` |
| `SESSION_HTTP_ONLY` | `true` |

## Security Headers Summary

| Header | Set by | Purpose |
|---|---|---|
| `XSRF-TOKEN` cookie | `VerifyCsrfToken` | CSRF protection |
| `X-XSRF-TOKEN` echo | Inertia axios client | CSRF token transmission |
| `HttpOnly` cookie | Session config | Prevents XSS cookie theft |
| `SameSite=Lax` | Session config | CSRF cross-site protection |
| `Content-Length` check | Request body parser | Prevents oversized payloads |

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly. See
[SECURITY.md](../SECURITY.md) for disclosure instructions.
