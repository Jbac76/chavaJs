# Sessions & CSRF

Sessions give your app per-visitor state — signed cookies backed by the
session store. The `StartSession` middleware (first in the `web` group) boots
a session for every request.

## Accessing the session

In a controller, use `request.session()`:

```ts
const store = request.session();

store.put('cart', ['sk-123']);
store.get('cart');                 // ['sk-123']
store.has('cart');                 // boolean
store.forget('cart');
store.all();                       // every key
store.getId();                     // the session id
store.regenerate();                // rotate the id (call after login!)
```

The `Session` facade works the same way from anywhere:

```ts
import { Session } from '../src/facades';
Session.put('locale', 'fr');
Session.get('locale');
```

## Session API

### Reading & writing

| Method | Description |
|--------|-------------|
| `get(key, fallback?)` | Read a value by key, returning `fallback` if undefined |
| `put(key, value)` | Set a key-value pair |
| `push(key, value)` | Append a value to an existing array (or create a new array) |
| `pull(key, fallback?)` | Read a value then remove it (get + forget) |
| `has(key)` | `true` if the key exists |
| `all()` | Shallow copy of all session data |
| `forget(...keys)` | Delete one or more keys |
| `flush()` | Empty the entire session (does NOT destroy the handler entry) |

### Lifecycle

| Method | Description |
|--------|-------------|
| `getId()` | Returns the session ID |
| `load()` | Reads session data from the handler and ages flash data |
| `save()` | Persists session data via the handler |
| `invalidate()` | Destroys the session and empties all data |
| `regenerate()` | Generates a new session ID (use after login to prevent session fixation) |
| `migrate(regenerateToken?)` | Regenerates the session ID and optionally the CSRF token (default: `true`) |

### CSRF token

| Method | Description |
|--------|-------------|
| `token()` | Returns the CSRF token for this session (lazily generated on first access) |
| `regenerateToken()` | Replaces the current CSRF token with a new one |

## Flash data

Flash values live for exactly one request — the classic "status saved" pattern:

```ts
store.flash('status', 'Profile updated!');
```

The next request reads it; the one after is clean. On validation failure the
framework flashes the input so forms can restore it:

```ts
store.flashInput(request.all());   // then request.old('email') in the view
request.old('email');               // old input value or undefined
```

### Flash methods

| Method | Description |
|--------|-------------|
| `flash(key, value)` | Store a value available on the **next** request only |
| `now(key, value)` | Store a value available for the **current** request only (skips the new array) |
| `reflash()` | Extend all current flash data for one more request |
| `keep(...keys)` | Keep only specific flash keys alive for one more request |

```ts
// Flash for next request (redirect after POST)
store.flash('success', 'Post created!');

// Flash for current request only (render same page with error)
store.now('error', 'Something went wrong');

// Re-flash all flash data to survive one more request
store.reflash();

// Keep only specific flash keys
store.keep('success', 'warning');
```

### Previous URL

| Method | Description |
|--------|-------------|
| `previousUrl()` | Returns the previously visited URL (used by `request.back()`) |
| `setPreviousUrl(url)` | Sets the previous URL |

## Configuration

`config/session.ts` controls the driver and cookie:

| Key | Default | Purpose |
| --- | --- | --- |
| `driver` | `file` | `file` (storage/sessions) or `database` |
| `lifetime` | 120 (min) | session lifetime |
| `cookie` | `chava_session` | cookie name |
| `secure` | `false` | HTTPS-only cookie |
| `http_only` | `true` | not readable by JavaScript |

### Server-side idle expiry

The same `lifetime` value drives **server-side** validation: every session
payload is stamped with `_last_activity`, and on the next request a payload
older than `lifetime` minutes is destroyed and replaced with an empty session.
A replayed/stolen old cookie therefore cannot resurrect state — expiry is not
just a cookie countdown. Set `lifetime` to `0` to disable server-side expiry.

## CSRF protection

`VerifyCsrfToken` (web group) protects every state-changing request. For Inertia
requests the CSRF cookie + `X-XSRF-TOKEN` header is handled automatically by
`HandleInertiaRequests`. For plain HTTP requests (curl, non-Inertia forms) you
must send the token:

```bash
# read the cookie, then:
curl -b cookies.txt -H "X-XSRF-TOKEN: <token>" -X POST http://localhost:8080/login ...
```

A missing or bad token produces a `419` style CSRF failure.

## Security checklist

- Call `store.regenerate()` after login and after logout.
- Call `store.migrate()` to regenerate both the session ID and CSRF token.
- Keep `APP_KEY` set and secret (it signs the session cookie).
- Set `secure: true` in `config/session.ts` behind HTTPS in production.

## Next

- [Authentication](13-auth) — users, guards, gates
- [Events](15-events) — reacting to what happens during requests
