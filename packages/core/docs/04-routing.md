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

### Parameter constraints

Constrain a parameter with a regex (`where`):

```ts
Route.get('/users/{user}', [UserController, 'show']).where({ user: '[0-9]+' });
Route.get('/posts/{slug}', [PostController, 'show']).where({ slug: '[a-z-]+' });
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

## Route API

Every method on a `Route` instance (returned by `Route.get()`, etc.):

| Method | Description |
|--------|-------------|
| `name(name)` | Set the route name (chainable) |
| `getName()` | Get the route name (or `undefined`) |
| `middleware(...middleware)` | Attach middleware to this route |
| `getMiddleware()` | Get middleware attached to this route |
| `where(rules)` | Add regex constraints for route parameters |
| `describe()` | Human-readable action (`Controller@method` or `Closure`) |
| `matchesPath(path)` | Check if this route matches a given path |
| `matchesMethod(method)` | Check if this route accepts an HTTP method |
| `extractParams(path)` | Extract parameter values from a matching path |

```ts
const route = Route.get('/users/{user}', [UserController, 'show'])
  .name('users.show')
  .middleware('auth');

route.getName();                          // 'users.show'
route.getMiddleware();                    // ['auth']
route.describe();                         // 'UserController@show'
route.matchesPath('/users/42');           // true
route.extractParams('/users/42');         // { user: '42' }
```

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

### Selecting resource routes

```ts
Route.resource('posts', PostController).only(['index', 'show']);
Route.resource('posts', PostController).except(['create', 'edit']);
```

## Router API

The `Route` facade delegates to the `Router` instance. Additional methods
beyond the verb helpers:

| Method | Description |
|--------|-------------|
| `middleware(middleware)` | Start a group with middleware |
| `prefix(prefix)` | Start a group with a URI prefix |
| `name(name)` | Start a group with a name prefix |
| `as(name)` | Alias for `name()` |
| `group(callback)` | Apply accumulated attributes to routes inside the callback |
| `model(name, modelClass)` | Register a route model binding |
| `middlewareAlias(name, middleware)` | Register a short alias for a middleware class |
| `groupMiddleware(name, middleware)` | Define a middleware group |
| `findRoute(method, path)` | Find a matching route (returns route + params, 405 info, or null) |
| `has(name)` | Check if a named route exists |
| `route(name)` | Get a Route instance by name |
| `getRoutes()` | Get all registered routes |

### Checking named routes

```ts
Route.has('dashboard');    // true/false
Route.route('dashboard');  // Route | undefined
```

### Finding routes programmatically

```ts
const match = Route.findRoute('GET', '/users/42');
// { route: Route, params: { user: '42' } }

const notFound = Route.findRoute('GET', '/nope');
// null

const methodNotAllowed = Route.findRoute('DELETE', '/users/42');
// { notAllowed: true, allowedMethods: ['GET', 'PUT', 'PATCH'] }
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
