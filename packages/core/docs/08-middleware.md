# Middleware

Middleware filters HTTP requests before they reach your controllers — exactly
Laravel's model: a `handle(request, next, ...params)` method that either
returns a `Response` (halting the chain) or calls `next()`.

## Anatomy of a middleware

```ts
import type { Request } from '../../src/http/Request';
import type { NextFunction } from '../../src/http/types';

export class LogRequests {
  public async handle(request: Request, next: NextFunction) {
    console.log(`${request.method()} ${request.path()}`);
    return next();                 // continue the pipeline
  }
}
```

Generate one with `js make:middleware LogRequests`; it lands in
`app/Http/Middleware`.

## Registering middleware

Aliases are registered in your `RouteServiceProvider`:

```ts
import { LogRequests } from '../app/Http/Middleware/LogRequests';

export class RouteServiceProvider extends ServiceProvider {
  public async boot(): Promise<void> {
    const router = this.app.make<Router>('router');
    router.groupMiddleware('web', this.app.getWebMiddleware());
    router.groupMiddleware('api', this.app.getApiMiddleware());
    router.middlewareAlias('log', LogRequests);
    // ...
  }
}
```

`AuthServiceProvider` already registers the framework aliases: `auth`,
`guest`, `verified`, and `can`.

## Assigning middleware

On a route:

```ts
Route.get('/dashboard', [DashboardController, 'index']).middleware('auth', 'log');
```

In a group:

```ts
Route.middleware('auth')
  .prefix('admin')
  .group(() => { /* all routes behind auth */ });
```

In `bootstrap/app.ts` as group or global middleware:

```ts
export const app = Application.configure({
  name: 'chavaJs',
  providers: [AppServiceProvider, RouteServiceProvider],
  globalMiddleware: [],                        // every request
  webMiddleware: [StartSession, HandleInertiaRequests, VerifyCsrfToken],
  apiMiddleware: [EnsureApiToken],             // api group
});
```

## Built-in middleware

| Alias | Class | Purpose |
| --- | --- | --- |
| `auth` | `Authenticate` | Require an authenticated user; redirects guests to `login` |
| `guest` | `RedirectIfAuthenticated` | Only guests; redirects authenticated users to `dashboard` |
| `verified` | `EnsureEmailIsVerified` | Require a verified email address |
| `can` | `CanMiddleware` | Gate/policy check — `can:ability` or `can:ability,param` |
| — | `StartSession` | Boot the session store (web group) |
| — | `HandleInertiaRequests` | Share Inertia props (web group) |
| — | `VerifyCsrfToken` | CSRF protection (web group) |

## Parameterized middleware

Use Laravel's `alias:param,param` syntax — the params are appended to
`handle()`:

```ts
Route.delete('/users/{user}', [UserController, 'destroy'])
  .middleware('can:delete,user');
```

```ts
export class CanMiddleware {
  public async handle(request: Request, next: NextFunction, ability: string, ...params: string[]) {
    const user = await request.user();
    const model = await User.find(params[0] ?? request.input('user'));
    const allowed = await Gate.forUser(user).allows(ability, model);
    return allowed ? next() : Response.json({ message: 'Forbidden' }, 403);
  }
}
```

## Middleware ordering

Middleware runs in the order they are listed: route-level middleware, then
the group, then global. The `web` group's `StartSession` runs before your
route middleware, so `request.session()` is always available in route-level
middleware.

## Next

- [Authentication](13-auth) — guards, users, gates and policies