# Controllers

Controllers group related request-handling logic into classes. They live in
`app/Http/Controllers` and are generated with `js make:controller`.

## Basic controllers

```ts
import { Request } from '../../src/http/Request';
import { Inertia } from '../../src/facades';
import { User } from '../../models/User';

export class UserController {
  public async index(request: Request) {
    const users = await User.all();
    return Inertia.render('Users/Index', { users });
  }

  public async show(request: Request, user: User) {
    return Inertia.render('Users/Show', { user });
  }

  public async store(request: Request) {
    const data = await request.validate({
      name: 'required|string|max:255',
      email: 'required|email|unique:users,email',
    });
    const user = await User.create(data);
    return request.back();
  }
}
```

Controller methods are resolved from the container, so constructor injection
works — the router calls them via `app.call(controller, method, { request, ...params })`.

```ts
import { Config } from '../../src/facades';

export class ApiController {
  public constructor(private readonly config = Config) {}

  public async health() {
    return { status: 'ok', name: this.config.get('app.name') };
  }
}
```

## Single-action controllers

An invokable controller handles exactly one action (`__invoke`):

```ts
export class ShowWelcome {
  public async __invoke(request: Request) {
    return Inertia.render('Welcome', { name: 'chavaJs' });
  }
}

Route.get('/', ShowWelcome);
```

## Resource controllers

A resource controller handles all CRUD operations for a model. Define the
standard methods:

```ts
export class PostController {
  public async index(request: Request) { /* list all posts */ }
  public async create(request: Request) { /* show create form */ }
  public async store(request: Request) { /* save new post */ }
  public async show(request: Request, post: Post) { /* show single post */ }
  public async edit(request: Request, post: Post) { /* show edit form */ }
  public async update(request: Request, post: Post) { /* update post */ }
  public async destroy(request: Request, post: Post) { /* delete post */ }
}
```

Register with `Route.resource()`:

```ts
Route.resource('posts', PostController);
// GET    /posts          → index
// GET    /posts/create   → create
// POST   /posts          → store
// GET    /posts/:id      → show
// GET    /posts/:id/edit → edit
// PUT    /posts/:id      → update
// DELETE /posts/:id      → destroy
```

### Selecting resource routes

Only register specific actions:

```ts
Route.resource('posts', PostController).only(['index', 'show']);
Route.resource('posts', PostController).except(['create', 'edit']);
```

## Generating controllers

```bash
js make:controller PostController
js make:controller PostController --model Post     # with model hint
js make:controller AuthController --invokable       # single-action (__invoke)
```

## Controllers & middleware

Attach middleware in the route definition (see [Routing](04-routing)) or
return `[Controller, 'method']` pairs and let routes group middleware by
prefix.

## Returning values

- **`Inertia.render('Page', props)`** — an Inertia page (HTML for browsers,
  JSON for X-Inertia requests) — see [Frontend](19-frontend).
- **`Response.json(data)`** — a JSON response.
- **`Response.html(html)`** — raw HTML (used by the `/docs` routes).
- **`request.back()` / `Response.redirect('/path')`** — redirects.
- **plain object / array** — serialized as JSON automatically.
- **string** — sent as `text/plain`.

## Next

- [Requests](06-requests) — working with input
- [Validation](07-validation) — validating input
