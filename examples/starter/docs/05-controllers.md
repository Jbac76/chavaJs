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