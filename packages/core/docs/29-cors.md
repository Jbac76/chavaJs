# CORS

chavaJs ships a global CORS handler — Laravel's `HandleCors` middleware, ported.
It runs in the HTTP kernel **before routing**, so every response (including
errors) carries the right headers for allowed origins, and preflight requests
terminate immediately.

## Configuration

Publish/edit `config/cors.ts`:

```ts
export default {
  allowed_origins: ['http://localhost:3000', 'http://localhost:5173'],
  allowed_methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowed_headers: ['Content-Type', 'Authorization', 'X-XSRF-TOKEN', 'Accept'],
  supports_credentials: true,
  max_age: 86400,
};
```

| Option | Default | Notes |
|---|---|---|
| `allowed_origins` | localhost:3000 / :5173 | Array of origins, or `'*'` to allow any |
| `allowed_methods` | standard REST set | Sent on preflight replies |
| `allowed_headers` | Content-Type, Authorization, X-XSRF-TOKEN, Accept | Request headers clients may send |
| `supports_credentials` | `true` | Sends `Access-Control-Allow-Credentials`. Ignored when origins is `'*'` (per spec) |
| `max_age` | `86400` | Preflight cache lifetime (seconds) |

## Behavior

- **Allowed origin** → responses carry `Access-Control-Allow-Origin`,
  `-Methods`, `-Headers`, `-Max-Age`, plus `-Allow-Credentials` when enabled.
- **Disallowed origin** → *no* CORS headers are sent; the browser blocks the
  response client-side. The server never leaks data to disallowed origins.
- **Preflight** (`OPTIONS` with `Access-Control-Request-Method`) → answered
  `204` directly from the kernel without touching routes or middleware.
- Every cross-origin response includes `Vary: Origin`, so caches never serve
  one origin another origin's reply.

## Defaults when config is absent

The kernel works without `config/cors.ts` using safe built-in defaults
(localhost dev origins, credentials on). Add the file only to customize.

## Verifying

```bash
# Preflight
curl -i -X OPTIONS https://yourapp.test/api/users \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
# → 204 with Access-Control-* headers

# Disallowed origin gets no CORS headers
curl -si https://yourapp.test/api/users -H "Origin: https://evil.test" | grep -i access-control
# → (no output)
```
