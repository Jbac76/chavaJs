# chava-permissions

Roles & permissions for JavaScript/TypeScript with the **same API as
spatie/laravel-permission** — better performance, zero dependencies.

```ts
import { createAuthorizer } from 'chava-permissions';

const authz = await createAuthorizer();            // in-memory store
await authz.registrar.createPermission({ name: 'posts.edit' });
await authz.registrar.createRole({ name: 'writer' });

const user = authz.user({ id: 1, modelType: 'users' });
await user.assignRole('writer');

user.hasRole('writer');              // true
user.hasPermissionTo('posts.edit');  // true (inherited via role)
user.hasAnyPermission('posts.delete', 'posts.edit');
```

## Spatie parity

| Spatie | chava-permissions |
|---|---|
| `$user->assignRole('writer')` | `await user.assignRole('writer')` |
| `$user->hasPermissionTo('edit')` | `user.hasPermissionTo('edit')` |
| `$user->syncPermissions([...])` | `await user.syncPermissions('a', 'b')` |
| `$role->syncPermissions([...])` | `registrar.syncRolePermissions(roleId, ['a','b'])` |
| Wildcards (`posts.*`, `*`) | identical matching semantics |
| Multiple guards | `guardName` on roles + permissions |
| Exceptions | `PermissionDoesNotExistError`, `UnauthorizedError`, … |

## Adapters

- **MemoryStore** — default; zero setup.
- **Custom** — implement the ~12-method `StoreAdapter` interface for SQL,
  Mongo, Redis, REST… the core never queries storage directly.

## chavaJs integration

Inside a chavaJs app run `js permission:install` to create the five
Spatie-schema tables, then use `user.can()`, `role:` / `permission:` route
middleware and Inertia `can` props out of the box. See docs page 31.

## Performance design

All roles & permissions load once into typed Maps (`Registrar.warmUp()`).
After warm-up every check is an O(1) lookup — no queries, no allocations.
Wildcard patterns compile to matchers at registration time.

MIT © chavaJs contributors
