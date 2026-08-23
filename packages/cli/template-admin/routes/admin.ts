import { Route } from '../src/facades';
import { DashboardController } from '../app/Http/Controllers/Admin/DashboardController';
import { AdminUsersController } from '../app/Http/Controllers/Admin/UsersController';
import { AdminRolesController } from '../app/Http/Controllers/Admin/RolesController';
import adminConfig from '../config/admin';

/**
 * The admin area — every route inherits config.admin.middleware
 * (auth + permission gate by default). Nav-driven: entries mirror
 * config/admin.ts navigation.
 */
Route.prefix(adminConfig.prefix)
  .name('admin.')
  .group(() => {
    Route.middleware(adminConfig.middleware).group(() => {
      Route.get('/', [DashboardController, 'index']).name('dashboard');
      Route.get('/users', [AdminUsersController, 'index']).name('users.index');
      Route.get('/users/{user}', [AdminUsersController, 'show']).name('users.show');
      Route.post('/users/{user}/roles', [AdminUsersController, 'syncRoles']).name('users.roles.sync');
      Route.get('/roles', [AdminRolesController, 'index']).name('roles.index');
      Route.post('/roles/{role}/permissions', [AdminRolesController, 'syncPermissions']).name('roles.permissions.sync');
    });
  });
