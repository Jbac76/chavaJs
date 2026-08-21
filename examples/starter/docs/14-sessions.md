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

`store.previousUrl()` / `store.setPreviousUrl(url)` back `request.back()`.

## Configuration

`config/session.ts` controls the driver and cookie:

| Key | Default | Purpose |
| --- | --- | --- |
| `driver` | `file` | `file` (storage/sessions) or `database` |
| `lifetime` | 120 (min) | session lifetime |
| `cookie` | `chava_session` | cookie name |
| `secure` | `false` | HTTPS-only cookie |
| `http_only` | `true` | not readable by JavaScript |

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
- Keep `APP_KEY` set and secret (it signs the session cookie).
- Set `secure: true` in `config/session.ts` behind HTTPS in production.

## Next

- [Authentication](13-auth) — users, guards, gates
- [Events](15-events) — reacting to what happens during requests