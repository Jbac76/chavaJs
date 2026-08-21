# Service Container

The service container manages class dependencies and performs dependency
injection. chavaJs uses the container to resolve controllers, middleware,
event listeners, and any class with typed constructor parameters.

## Basic usage

The container resolves classes by inspecting their constructor parameter names
and looking up matching bindings:

```ts
import { App } from '../src/facades';

// Resolve a class (auto-wired from container)
const mailer = App.make<Mailer>('mailer');

// Resolve by class reference
const gate = App.make(Gate);
```

## Registering bindings

### `bind(abstract, concrete, singleton?)`

Register a binding — `concrete` can be a class, factory function, or value:

```ts
App.bind('mailer', Mailer);
App.bind('stripe', () => new StripeClient(process.env.STRIPE_KEY));
App.bind('logger', console);
```

Factory functions receive the container as their only argument:

```ts
App.bind('mailer', (container) => {
  return new Mailer(container.make('config'));
});
```

### `singleton(abstract, concrete)`

Register a binding that is resolved once and shared:

```ts
App.singleton('mailer', Mailer);
App.singleton('cache', () => new MemoryCache());
```

### `instance(abstract, value)`

Bind an already-instantiated value:

```ts
App.instance('config', loadedConfig);
```

### `alias(alias, abstract)`

Register an alias so `make(alias)` resolves `abstract`:

```ts
App.alias('mail', 'mailer');
App.make('mail'); // resolves 'mailer'
```

## Resolving bindings

### `make(abstract, overrides?)`

Resolve a binding from the container. Classes with no explicit binding are
auto-wired — constructor parameters are resolved by name:

```ts
const user = App.make(User);
// Container inspects User constructor, resolves its params (e.g. 'hash', 'db')
```

Pass overrides to inject specific values:

```ts
const user = App.make(User, { hash: customHash });
```

### `bound(abstract)`

Check if a binding exists:

```ts
App.bound('mailer'); // true/false
```

## Calling methods with DI

### `call(target, method?, params?)`

Invoke a function or class method with dependency injection:

```ts
// Call a function
App.call((config) => config.get('app.name'));

// Call a class method (class is auto-resolved)
App.call(MyController, 'index', { request, id: 1 });

// Call a method on an instance
App.call(myInstance, 'handle', { request });
```

## Contextual bindings

Override a specific parameter for a specific class — useful when the same
class needs different implementations in different contexts:

```ts
App.when(ReportService).needs('stripe').give(StripeClient);
App.when(ReportService).needs('config').give(() => fakeConfig);
```

When `ReportService` is resolved, its `stripe` parameter resolves to
`StripeClient` instead of the global binding.

```ts
// Using the fluent builder
App.when(PaymentService)
  .needs('gateway')
  .give(StripeGateway);

App.when(PaymentService)
  .needs('config')
  .give(() => ({ apiKey: 'test' }));
```

## Container API reference

| Method | Description |
|--------|-------------|
| `bind(abstract, concrete, singleton?)` | Register a binding |
| `singleton(abstract, concrete)` | Register a shared (singleton) binding |
| `instance(abstract, value)` | Bind an already-instantiated value |
| `alias(alias, abstract)` | Register an alias |
| `when(concrete)` | Start a contextual binding |
| `addContextualBinding(target, param, value)` | Register a contextual binding directly |
| `contextualBinding(target, param)` | Get the contextual value for a target's param |
| `bound(abstract)` | Check if a binding exists |
| `make(abstract, overrides?)` | Resolve a binding from the container |
| `call(target, method?, params?)` | Invoke a function/method with DI |

## Resolution order

1. **Overrides** — if `overrides[name]` exists, use it
2. **Contextual bindings** — if a contextual binding exists for this class + param, use it
3. **Explicit bindings** — if a binding exists, resolve it
4. **Auto-wiring** — if the param is a class, try to build it
5. **Defaults** — if the param has a default value, use it
6. **Throw** — `BindingResolutionException` if unresolvable

## Next

- [Architecture](03-architecture) — how the container fits into the request lifecycle
- [Facades](25-facades) — static accessors into container bindings
