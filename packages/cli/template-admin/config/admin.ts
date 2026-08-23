/**
 * Admin dashboard configuration — the single customization point.
 *
 * - prefix/name: URL + branding
 * - middleware:  the group guarding EVERY admin route
 * - navigation:  drives BOTH the sidebar and route registration.
 *                Add an item = add an entry (+ a controller method).
 *                Remove one = delete the entry.
 */
export default {
  prefix: '/admin',
  name: 'Admin',

  middleware: ['auth', 'permission:admin.access'],

  navigation: [
    { label: 'Dashboard', href: '/admin', permission: 'admin.access' },
    { label: 'Users', href: '/admin/users', permission: 'users.view' },
    { label: 'Roles & Permissions', href: '/admin/roles', permission: 'roles.view' },
  ],

  users: {
    searchable: ['name', 'email'],
    perPage: 25,
  },
};
