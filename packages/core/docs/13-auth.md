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

## Gates

Gates are closures that authorize actions. They receive the user plus any
additional arguments:

```ts
import { Gate } from '../src/facades';

Gate.define('update-post', (user, post) => user.id === post.user_id);
```

### Gate API

| Method | Description |
|--------|-------------|
| `define(ability, callback)` | Register an authorization ability |
| `policy(modelClass, policyClass)` | Register a policy class for a model |
| `before(callback)` | Register a callback that runs **before** ability checks |
| `after(callback)` | Register a callback that runs **after** ability checks |
| `forUser(user)` | Return a new Gate scoped to a specific user |
| `allows(ability, ...args)` | `true` if the user is authorized |
| `denies(ability, ...args)` | `true` if the user is **not** authorized |
| `can(ability, ...args)` | Alias for `allows()` |
| `authorize(ability, ...args)` | Throws 403 if denied; returns `true` if allowed |
| `check(abilities[])` | `true` only if **all** listed abilities are granted |
| `any(abilities[])` | `true` if **at least one** ability is granted |
| `none(abilities[])` | `true` if **no** abilities are granted |

### Checking abilities

```ts
import { Gate } from '../src/facades';

const allowed = await Gate.forUser(user).allows('update-post', post);
await Gate.forUser(user).authorize('update-post', post); // throws 403
```

### Before / after callbacks

Short-circuit all ability checks with `before()`:

```ts
Gate.before((user) => {
  if (user.isAdmin) return true; // admins can do everything
});
```

Override the result with `after()`:

```ts
Gate.after((user, ability, result) => {
  if (user.isSuperAdmin) return true; // super admins always pass
});
```

### Batch checks

```ts
await Gate.forUser(user).check(['update-post', 'delete-post']);  // both must pass
await Gate.forUser(user).any(['update-post', 'delete-post']);    // at least one
await Gate.forUser(user).none(['update-post', 'delete-post']);   // none pass
```

## Policies

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

The policy method name matches the ability name. The first `Model` argument
is used to look up the policy automatically.

### Using `authorize()` in controllers

The base `Controller` class provides a protected `authorize()` helper:

```ts
import { Controller } from '../../src/http/Controller';

export class PostController extends Controller {
  public async destroy(request: Request, post: Post) {
    await this.authorize('delete', post); // throws 403 if denied
    await post.forceDelete();
    return request.back();
  }
}
```

### The `can` middleware

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
