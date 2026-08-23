# Permissions & Roles (chava-permissions)

chavaJs ships with **chava-permissions** — a roles & permissions system with the
same API as PHP's spatie/laravel-permission, rebuilt in TypeScript with O(1)
lookups. It is framework-agnostic: the core has zero dependencies and runs in
any JavaScript app; chavaJs adds first-class integration.

## Install

```bash
js permission:install     # creates the five Spatie-schema tables
                          # + seeds role `super-admin` with wildcard `*`
```

Tables: `roles`, `permissions`, `role_has_permissions`, `model_has_roles`,
`model_has_permissions` — identical to Spatie, so existing data imports as-is.

## Usage

```ts
import { createHasRoles } from '../src/permissions';
import { currentApp } from '../src/foundation/registry';

const registrar = currentApp().make('permissions');
const user = createHasRoles({ id: authUser.id, modelType: 'users' }, registrar);

await user.assignRole('writer');
await user.givePermissionTo('posts.edit');

user.hasRole('writer');              // true
user.hasPermissionTo('posts.edit');  // true
user.hasAnyRole('admin', 'writer');
await user.syncRoles('editor');      // replaces all roles
```

## Route middleware

Aliases registered automatically by `PermissionsServiceProvider`:

```ts
Route.get('/dashboard', [Controller, 'index'])
  .middleware('role:admin|manager');

Route.post('/posts', [Controller, 'store'])
  .middleware('permission:posts.create');
```

Failing checks throw `UnauthorizedError` → **403**.

## Wildcards

Grant `posts.*` to cover every `posts.<action>`; grant `*` for everything.
The seeded `super-admin` role holds `*` and bypasses the Gate entirely.

## CLI

| Command | Purpose |
|---|---|
| `js permission:install` | Create tables + seed super-admin |
| `js permission:create permission <name>` | Idempotent create |
| `js permission:create role <name>` | Idempotent create |
| js permission:show | List roles and their permissions |
| js permission:assign <role> <id\\|email> | Grant a role to a user - the way you bootstrap your first admin |

## Inertia

Every authenticated request shares:

```json
{ "auth": { "user": { "can": { "posts.edit": true }, "roles": ["writer"] } } }
```

Use it client-side: `usePage().props.auth.user.can['posts.edit']`.

## Standalone use (any framework)

```bash
npm i chava-permissions
```

```ts
import { createAuthorizer } from 'chava-permissions';

const authz = await createAuthorizer();   // memory adapter
const user = authz.user({ id: 1, modelType: 'users' });
await user.assignRole('writer');
user.hasPermissionTo('posts.edit');       // true
```

## Worked example

The admin Users CRUD (chava new --admin) composes everything on this page:
resource routes gated by typed users.* permissions, a UserPolicy for
object rules (self-delete, escalation guards), and Inertia can props - see
[Admin Dashboard](30-admin-dashboard).
