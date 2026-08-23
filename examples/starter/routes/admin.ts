import { Route, Gate } from '../src/facades';
import { User } from '../app/Models/User';
import { UserPolicy } from '../app/Policies/UserPolicy';
import { DashboardController } from '../app/Http/Controllers/Admin/DashboardController';
import { AdminUsersController } from '../app/Http/Controllers/Admin/UsersController';
import { AdminRolesController } from '../app/Http/Controllers/Admin/RolesController';
import adminConfig from '../config/admin';
import type { CrudPermission } from '../src/permissions';

// Policy registration — the Gate consults UserPolicy AFTER the permission
// middleware passes (defense-in-depth: RBAC x Policies compose).
Gate.policy(User, UserPolicy);

/** Typed permission names from the `${Entity}.${Verb}` catalog — zero strings. */
const perm = (name: CrudPermission): string => `permission:${name}`;

/**
 * The admin area — every route inherits config.admin.middleware (auth +
 * admin.access), and each user verb adds its typed CRUD permission.
 */
Route.prefix(adminConfig.prefix)
  .name('admin.')
  .group(() => {
    Route.middleware(adminConfig.middleware).group(() => {
      Route.get('/', [DashboardController, 'index']).name('dashboard');

      Route.resource('users', AdminUsersController, {
        middleware: {
          index: [perm('users.view')],
          show: [perm('users.view')],
          create: [perm('users.create')],
          store: [perm('users.create')],
          edit: [perm('users.update')],
          update: [perm('users.update')],
          destroy: [perm('users.delete')],
        },
      });

      // Role assignment has its own policy rule (super-admin escalation guard).
      Route.post('/users/{user}/roles', [AdminUsersController, 'syncRoles'])
        .middleware(perm('users.update'))
        .name('users.roles.sync');

      Route.get('/roles', [AdminRolesController, 'index']).name('roles.index');
      Route.post('/roles/{role}/permissions', [AdminRolesController, 'syncPermissions'])
        .middleware(perm('roles.update'))
        .name('roles.permissions.sync');
    });
  });
