# Support Utilities

The `support` module provides helpers used across the framework.

## Dot notation

`getPath()` and `hasPath()` read nested object values using Laravel's
dot-notation syntax:

```ts
import { getPath, hasPath } from '../src/support/dot';

const config = {
  app: { name: 'My App', debug: true },
  db: { default: 'sqlite' },
};

getPath(config, 'app.name');       // 'My App'
getPath(config, 'app.debug');     // true
getPath(config, 'missing.key', 'fallback'); // 'fallback'
hasPath(config, 'app.name');      // true
hasPath(config, 'missing.key');   // false
```

### `deepMerge()`

Merge nested objects (deep merge for plain records):

```ts
import { deepMerge } from '../src/support/dot';

const defaults = { db: { host: 'localhost', port: 5432 } };
const overrides = { db: { port: 3306 } };

deepMerge(defaults, overrides);
// { db: { host: 'localhost', port: 3306 } }
```

## Exceptions

chavaJs defines an exception hierarchy mirroring Laravel's core exceptions:

| Exception | HTTP Status | When |
|-----------|-------------|------|
| `RuntimeException` | 500 | General runtime errors |
| `BindingResolutionException` | 500 | Container cannot resolve a dependency |
| `NotFoundException` | 404 | Route/model/resource not found |
| `MethodNotAllowedException` | 405 | HTTP method not allowed on route |
| `ValidationException` | 422 | Request validation failed |
| `AuthorizationException` | 403 | Gate/policy check denied |

```ts
import {
  RuntimeException,
  BindingResolutionException,
  NotFoundException,
  MethodNotAllowedException,
  ValidationException,
  AuthorizationException,
} from '../src/support/exceptions';
```

### Catching specific exceptions

```ts
try {
  await gate.authorize('delete', post);
} catch (e) {
  if (e instanceof AuthorizationException) {
    // 403 — user is not allowed
  }
  if (e instanceof ValidationException) {
    // 422 — validation errors in e.errors
  }
}
```

## Reflection

Used internally by the container for auto-wiring. `paramNamesOf()` extracts
parameter names from function signatures using AST parsing:

```ts
import { paramNamesOf, isClass } from '../src/support/reflect';

isClass(class Foo {});           // true
isClass(() => {});               // false

paramNamesOf(class UserService {
  constructor(config: Config, db: DB) {}
});
// [{ name: 'config', hasDefault: false }, { name: 'db', hasDefault: false }]
```

The container uses these names to resolve dependencies — parameter names must
match container binding names (case-insensitive).

## Next

- [Service Container](23-container) — how reflection is used for auto-wiring
- [Configuration](02-configuration) — config file structure
