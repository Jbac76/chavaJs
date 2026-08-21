# Routing

Routes are defined in `routes/web.ts` (web group) and `routes/api.ts` (api
group). `RouteServiceProvider` loads them inside the appropriate middleware
groups, mirroring Laravel's `withRouting()`.

```ts
import { Route } from '../src/facades';

Route.get('/', [HomeController, 'index']);
Route.post('/login', [AuthController, 'login']);
```

## Available verbs

```ts
Route.get(uri, action);
Route.post(uri, action);
Route.put(uri, action);
Route.patch(uri, action);
Route.delete(uri, action);
Route.options(uri, action);
Route.match(['GET', 'POST'], uri, action);   // a specific set
Route.any(uri, action);                       // every method
```

A route action is one of:

- a controller pair — `[HomeController, 'index']`
- a single-action controller class — `HomeController` with an `__invoke` method
- a closure — `(request, ...params) => Response | string | object`

```ts
Route.get('/health', (request) => ({ status: 'ok' }));
```

## Route parameters

Required and optional parameters use `{name}` (Laravel's exact syntax):

```ts
Route.get('/users/{user}', [UserController, 'show']);
Route.get('/posts/{post?}', [PostController, 'index']);   // optional
```

Positional values arrive in the closure after the request; controller methods
receive them keyed by name:

```ts
class PostController {
  public show(request: Request, post: string) {
    return { id: post };
  }
}
```

Constrain a parameter with a regex (`->where`):

```ts
Route.get('/users/{user}', [UserController, 'show']).where({ user: '[0-9]+' });
```

## Route model binding

Bind a parameter to a model and it is resolved automatically — a missing
record responds 404:

```ts
Route.model('user', User);
Route.get('/users/{user}', [UserController, 'show']);

class UserController {
  public show(request: Request, user: User) {   // resolved User, or 404
    return { user };
  }
}
```

## Named routes

```ts
Route.get('/dashboard', [DashboardController, 'index']).name('dashboard');
```

Names are visible in `js route:list` and are used by redirect helpers.

## Middleware

Attach middleware to individual routes (aliases or classes):

```ts
Route.post('/logout', [AuthController, 'logout']).middleware('auth').name('logout');
Route.delete('/users/{user}', [UserController, 'destroy'])
  .middleware('auth', 'can:delete,user');
```

Parameterized middleware uses Laravel's `alias:param,param` syntax.

## Groups, prefixes, and resource controllers

Group routes to share middleware, prefixes, and name prefixes:

```ts
Route.middleware('auth')
  .prefix('admin')
  .name('admin.')
  .group(() => {
    Route.get('/users', [AdminController, 'index']).name('users.index'); // admin.users.index
  });
```

Resource controllers register the standard seven routes:

```ts
Route.resource('posts', PostController);
// GET  /posts            → index
// GET  /posts/create     → create
// POST /posts            → store
// GET  /posts/{post}     → show
// GET  /posts/{post}/edit→ edit
// PUT|PATCH /posts/{post}→ update
// DELETE /posts/{post}   → destroy
```

## Registering middleware aliases

Define short aliases for middleware classes in your `RouteServiceProvider`:

```ts
router.middlewareAlias('auth', AuthMiddleware);
router.middlewareAlias('can', CanMiddleware);
```

## Route caching / listing

`js route:list` prints every registered route with its methods, URI, name,
and action. There is no route cache (routes are plain modules, resolved at
boot), so no `route:cache` command.

## Next

- [Controllers](05-controllers) — writing the action layer
- [Middleware](08-middleware) — request filtering