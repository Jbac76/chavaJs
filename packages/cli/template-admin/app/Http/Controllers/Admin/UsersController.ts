import { Inertia } from '../../../../src/facades';
import { Controller } from '../../../../src/http/Controller';
import { Request } from '../../../../src/http/Request';
import { ValidationException } from '../../../../src/support/exceptions';
import { currentApp } from '../../../../src/foundation/registry';
import { User } from '../../../Models/User';

/** Minimal shape of the chava-permissions registrar in the container. */
interface RegistrarLike {
  rolesOf: (type: string, id: number | string) => Array<{ name: string }>;
  allRoles: () => Array<{ name: string }>;
  syncModelRoles: (type: string, id: number | string, roles: string[]) => Promise<void>;
}

export class AdminUsersController extends Controller {
  /** GET /admin/users — search + paginate. */
  public async index(request: Request) {
    const config = (await import('../../../../config/admin')).default;
    const registrar = currentApp().make<RegistrarLike>('permissions');
    const search = String(request.query('q', ''));
    const perPage = config.users.perPage;

    let query = User.query().orderBy('created_at', 'desc');
    if (search) {
      query = query.where((builder: { where: (col: string, op: string, value: string) => void; orWhere: (col: string, op: string, value: string) => void }) => {
        for (const column of config.users.searchable) {
          builder.orWhere(column, 'like', `%${search}%`);
        }
      });
    }
    const paginator = await query.paginate(perPage);

    return Inertia.render('Admin/Users/Index', {
      users: {
        ...paginator,
        data: paginator.data.map((user) => user.toArray()),
      },
      roles: registrar.allRoles().map((role) => role.name),
      q: search,
    });
  }

  /** GET /admin/users/{user} - edit form with current + available roles. */
  public async show(user: User) {
    const registrar = currentApp().make<RegistrarLike>('permissions');
    return Inertia.render('Admin/Users/Edit', {
      user: user.toArray(),
      userRoles: registrar.rolesOf('users', user.getKey()).map((role) => role.name),
      allRoles: registrar.allRoles().map((role) => role.name),
    });
  }

  /** POST /admin/users/{user}/roles - transactional role replacement. */
  public async syncRoles(request: Request, user: User) {
    const roles = request.input('roles');
    if (!Array.isArray(roles)) {
      throw new ValidationException({ roles: ['Roles must be an array.'] });
    }
    const registrar = currentApp().make<RegistrarLike>('permissions');
    const known = new Set(registrar.allRoles().map((role) => role.name));
    for (const role of roles) {
      if (!known.has(String(role))) {
        throw new ValidationException({ roles: [`Unknown role "${String(role)}".`] });
      }
    }
    await registrar.syncModelRoles('users', user.getKey(), roles.map(String));
    return Inertia.redirect('/admin/users');
  }
}
