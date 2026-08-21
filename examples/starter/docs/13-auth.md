# Authentication

Session-based authentication is built in and configured for you — a full
Breeze-style login/register flow ships with every new app.

## The Auth facade

```ts
import { Auth } from '../src/facades';

const user = await Auth.user();          // Model | null
const id = await Auth.id();              // the user's key, or null
const loggedIn = await Auth.check();     // boolean
const isGuest = await Auth.guest();      // inverse of check()

await Auth.login(user);                  // start a session for this user
await Auth.logout();                     // end the session
const ok = await Auth.attempt({ email, password }); // login by credentials
```

`attempt()` verifies the password hash automatically and starts a session on
success. The Breeze flow in `app/Http/Controllers/AuthController.ts` shows the
idiomatic usage:

```ts
const data = await request.validate(LoginRequest);
const ok = await Auth.attempt({ email: data.email, password: data.password });
if (!ok) throw new ValidationException({ email: ['These credentials do not match our records.'] });
return Response.redirect('/dashboard');
```

## Hashing

`Hash.make()` / `Hash.check()` wrap bcrypt:

```ts
import { Hash } from '../src/auth/Hash';

const hash = await Hash.make('secret-password');
const match = await Hash.check('secret-password', hash); // true
```

Always hash passwords before storing (see the `register` action above).

## Guards

`config/auth.ts` defines guards:

- **`web`** — session-based (default), backed by the `User` model.
- **`api`** — token-based (`Authorization: Bearer <token>`), for API clients.

Pick a guard explicitly with the optional argument:

```ts
await Auth.login(user, 'web');
const apiUser = await Auth.user('api');
```

Token issuance for the `api` guard follows the Sanctum pattern: the
`POST /api/tokens` route creates a token for a session-authenticated user.

## Middleware

Protect routes with the `auth` alias (or `guest` for the inverse):

```ts
Route.get('/dashboard', [DashboardController, 'index']).middleware('auth');
Route.get('/login', [AuthController, 'showLogin']).middleware('guest');

// parameterized: allow only verified users
Route.get('/settings', [SettingsController, 'index']).middleware('auth', 'verified');
```

Guests hitting `auth` are redirected to `login`; authenticated users hitting
`guest` are redirected to `dashboard`. In controllers, use `request.user()`:

```ts
const user = await request.user();
if (!user) throw new Error('Unauthenticated');
```

## Gates & policies

Authorize actions with the `Gate` facade. Gates are closures taking the user
plus optional arguments:

```ts
import { Gate } from '../src/facades';

Gate.define('update-post', (user, post) => user.id === post.user_id);
const allowed = await Gate.forUser(user).allows('update-post', post);
await Gate.forUser(user).authorize('update-post', post); // throws 403
```

Policies group abilities per model — `js make:policy PostPolicy`:

```ts
export class PostPolicy {
  public update(user: User, post: Post): boolean {
    return user.id === post.user_id;
  }
  public delete(user: User, post: Post): boolean {
    return user.id === post.user_id;
  }
}

Gate.policy(Post, PostPolicy);
await Gate.forUser(user).authorize('update', post);
```

The `can` middleware runs a gate/policy check per request:

```ts
Route.delete('/posts/{post}', [PostController, 'destroy'])
  .middleware('can:delete,post');
```

`can:ability,param` — the second argument is the model parameter resolved from
the route (Laravel's `can:delete,post` syntax).

## Next

- [Sessions & CSRF](14-sessions) — how the session is persisted and protected
- [Middleware](08-middleware) — the auth pipeline