# Admin Dashboard

`chava new --admin` scaffolds a complete, permission-gated admin area at
`/admin`. Everything is copied into **your** source tree — there is no vendor
package to fight. Customize freely.

## Scaffold options

```
chava new my-app --auth --admin
```

The dashboard requires authentication; requesting `--admin` without `--auth`
auto-enables auth with a warning.

## What you get

```
config/admin.ts                       prefix, title, navigation, user settings
routes/admin.ts                       nav-driven routes, group-gated
app/Http/Controllers/Admin/           Dashboard / Users / Roles controllers
resources/js/Layouts/AdminLayout.tsx  sidebar shell (permission-filtered nav)
resources/js/Pages/Admin/             Dashboard, Users, Roles & Permissions UI
tests/Feature/Admin/                  access-control smoke tests
```

## The customization contract — config/admin.ts

```ts
export default {
  prefix: '/admin',
  name: 'Admin',
  middleware: ['auth', 'permission:admin.access'],
  navigation: [
    { label: 'Dashboard', href: '/admin', permission: 'admin.access' },
    { label: 'Users', href: '/admin/users', permission: 'users.view' },
    { label: 'Roles & Permissions', href: '/admin/roles', permission: 'roles.view' },
    // add your own sections here
  ],
  users: { searchable: ['name', 'email'], perPage: 25 },
};
```

- **Add a section**: append a nav entry + add its route/controller. Done.
- **Remove one**: delete the entry (+ files). The app still compiles.
- **Rebrand**: change `name`; the sidebar and titles follow.

## First login

1. `js migrate && js db:seed` then `js permission:install`
2. Grant yourself the super-admin role:

   ```sql
   INSERT INTO model_has_roles (role_id, model_type, model_id)
   SELECT id, 'users', '<your-user-id>' FROM roles WHERE name = 'super-admin';
   ```

3. Sign in and open `/admin`. The wildcard `*` permission means super-admins
   see every section; other roles only see nav items whose
   `permission:` they hold — and direct URL entry returns **403**.

## Roles & Permissions page

A live matrix of roles x permissions. Click any cell to grant/revoke — each
change is saved transactionally through `registrar.syncRolePermissions`.

## Users page

Search across configurable columns, paginate, and assign roles inline
(`syncModelRoles` inside a transaction — no partial states).
