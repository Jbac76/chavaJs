# Architecture

chavaJs is Laravel's architecture translated to TypeScript and Node.js. If you
understand Laravel's request lifecycle, you already understand chavaJs — the
naming, the folders, and even the facades match.

## The container

The heart of the framework is the dependency-injection container
(`Application` extends the container). Bind anything, resolve anything, and let
autowiring build your classes:

```ts
import { App } from '../src/facades';

// Bind a singleton (Laravel: $app->singleton(...))
App.singleton('analytics', () => new AnalyticsClient(Config.get('analytics.endpoint')));

// Resolve it
const analytics = App.make<AnalyticsClient>('analytics');

// Autowire constructor params in any class resolved through the container
class OrderService {
  public constructor(private readonly analytics: AnalyticsClient) {}
}
const service = App.make(OrderService); // analytics injected automatically
```

Useful container methods: `App.bind()`, `App.singleton()`, `App.instance()`,
`App.alias()`, `App.make()`, `App.call(controller, method, params)`.

## The request lifecycle

1. The server (or Vite middleware) receives a request.
2. `bootstrap/app.ts` configures the `Application`: providers, global
   middleware, and the `web`/`api` middleware groups.
3. `app.bootstrap()` registers every framework provider and your application
   providers, then boots them all.
4. The HTTP kernel finds a matching route, runs the middleware pipeline, and
   dispatches the route action (controller method, invokable controller, or
   closure).
5. The result is converted to a `Response` and sent to the client.

## Service providers

Providers are the central bootstrapping mechanism. Framework providers
(database, session, auth, events, queues, mail, notifications, scheduling,
Inertia) are always registered; your own providers go in
`app/Providers/` and are listed in `bootstrap/app.ts`:

```ts
export const app = Application.configure({
  name: 'chavaJs',
  providers: [AppServiceProvider, RouteServiceProvider],
  globalMiddleware: [],
  webMiddleware: [StartSession, HandleInertiaRequests, VerifyCsrfToken],
  apiMiddleware: [],
});
```

Each provider implements the Laravel lifecycle:

```ts
import { ServiceProvider } from '../src/container/ServiceProvider';

export class AppServiceProvider extends ServiceProvider {
  public register(): void {
    // Bind services into the container. Runs before any boot().
  }

  public async boot(): Promise<void> {
    // Everything is registered — wire things up, register routes, etc.
  }
}
```

## Middleware groups

- **`web`** — `StartSession`, `HandleInertiaRequests`, `VerifyCsrfToken`.
  Route groups in `routes/web.ts` are wrapped in it automatically.
- **`api`** — empty by default; add token/cors middleware here.
- **`global`** — applied to every request (default empty).

## Facades

Facades are Proxy-based singletons — statically-accessible, but backed by the
container:

```ts
import { Route, Config, DB, Schema, Auth, Gate, Session, Event, Queue, Mail, Notification, Schedule, Inertia, Env } from '../src/facades';
```

## The `js` console

Your app carries its own `bin/chava.js`; the global `js` command proxies to it.
Framework commands (migrate, seed, make, serve, tinker, ...) are built in; see
[Console](20-console) for the full list.

## Next

- [Routing](04-routing) — defining endpoints
- [Console](20-console) — every built-in command