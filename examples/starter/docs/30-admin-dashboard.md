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

## Getting in as an admin
> **Chose `--admin` during `chava new`?** Skip steps 1-2 - the installer already
> migrated, seeded, installed permissions, assigned super-admin to the seeded
> account (`admin@chavajs.com` / `password`) and printed the credentials.
> Just sign in at `/login` and open `/admin`.


1. **Create the tables and your account**

   ```bash
   js migrate && js db:seed     # users table + demo data
   js permission:install        # roles/permissions tables + super-admin role
   ```

2. **Register yourself** at `/register` (or use a seeded user's email), then
   grant your account the admin role:

   ```bash
   # by email...
   js permission:assign super-admin you@example.com
   # ...or by id
   js permission:assign super-admin 1
   ```

3. **Sign in and open /admin.** You are now a full admin.

How it works:

- The wildcard `*` permission held by `super-admin` satisfies every check, so
  admins see all sidebar sections.
- Any other user only sees nav items whose `permission:` they hold; entering a
  forbidden URL directly returns **403**.
- To promote more users later, repeat step 2 - or manage roles graphically
  from the dashboard's Users page once you are signed in as an admin.

## Roles & Permissions page

A live matrix of roles x permissions. Click any cell to grant/revoke — each
change is saved transactionally through `registrar.syncRolePermissions`.

## Users page

Search across configurable columns, paginate, and assign roles inline
(`syncModelRoles` inside a transaction — no partial states).
