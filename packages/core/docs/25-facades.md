# Facades

Facades provide static access to container bindings. chavaJs implements them
as `Proxy`-based singletons — each facade delegates to the underlying service
instance from the container.

## Available facades

```ts
import {
  App, Config, Route, DB, Schema, Auth, Gate,
  Session, Event, Queue, Mail, Notification,
  Schedule, Inertia, Env,
} from '../src/facades';
```

| Facade | Resolves | Purpose |
|--------|----------|---------|
| `App` | `Application` | Application lifecycle, container, boot |
| `Config` | `Config` | Read/write config values |
| `Route` | `Router` | Register routes, middleware, groups |
| `DB` | `DatabaseManager` | Query builder, connections |
| `Schema` | `Schema` | Create/modify/drop tables |
| `Auth` | `AuthManager` | Login, logout, guards |
| `Gate` | `Gate` | Authorization abilities and policies |
| `Session` | `SessionManager` | Session store access |
| `Event` | `Dispatcher` | Event dispatching and listeners |
| `Queue` | `QueueManager` | Push/later jobs |
| `Mail` | `MailManager` | Send emails |
| `Notification` | `NotificationManager` | Send notifications |
| `Schedule` | `Scheduler` | Define scheduled tasks |
| `Inertia` | `Inertia` | Render Inertia pages |
| `Env` | `Env` | Read/write environment variables |

## How facades work

Each facade is a `Proxy` that traps property access and method calls,
forwarding them to the resolved singleton from the container:

```ts
// This:
Route.get('/users', [UserController, 'index']);

// Is equivalent to:
const router = App.make<Router>('router');
router.get('/users', [UserController, 'index']);
```

Facades are resolved lazily — the container only looks up the binding when
you first call a method on the facade.

## Creating custom facades

You can create your own facades for application-specific services:

```ts
import { facade } from '../src/container/Facade';

// Define the facade
export const MyService = facade<MyServiceClass>('my-service');

// Register the binding
App.singleton('my-service', MyServiceClass);

// Use it anywhere
MyService.doSomething();
```

## The `Env` facade

`Env` is unique — it's not a container-based facade. It reads from
`process.env` directly:

```ts
import { Env } from '../src/facades';

const port = Env.get('PORT', '8080');
const dbUrl = Env.get('DATABASE_URL');
```

## Next

- [Service Container](23-container) — the underlying DI system
- [Architecture](03-architecture) — how facades fit into the framework
