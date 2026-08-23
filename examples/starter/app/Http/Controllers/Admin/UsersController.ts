import { Inertia } from '../../../../src/facades';
import { Controller } from '../../../../src/http/Controller';
import { Request } from '../../../../src/http/Request';
import { Response } from '../../../../src/http/Response';
import { ValidationException } from '../../../../src/support/exceptions';
import { currentApp } from '../../../../src/foundation/registry';
import { Hash } from '../../../../src/auth/Hash';
import { User } from '../../../Models/User';
import { AdminUserFormRequest } from '../../Requests/AdminUserFormRequest';

/**
 * Laravel resource controller — the framework's reference example.
 *
 *   index  create  store  show  edit  update  destroy
 *
 * Authorization layers:
 *   1. permission middleware on the routes (chava-permissions)
 *   2. `$this->authorize()` -> UserPolicy via the Gate (object rules)
 */

interface RegistrarLike {
  allRoles: () => Array<{ id: number; name: string }>;
  rolesOf: (type: string, id: unknown) => Array<{ name: string }>;
  syncModelRoles: (type: string, id: unknown, roles: string[]) => Promise<void>;
}

export class AdminUsersController extends Controller {
  // ------------------------------------------------------------ read

  /** GET /admin/users?q=... — paginated list for the live-search table. */
  public async index(request: Request) {
    const q = String(request.input('q', ''));
    const page = Math.max(1, Number(request.input('page', 1)) || 1);

    let query = User.query().orderBy('created_at', 'desc');
    if (q) {
      query = query.where((builder: {
        where: (col: string, op: string, value: string) => void;
        orWhere: (col: string, op: string, value: string) => void;
      }) => {
        builder.where('name', 'like', `%${q}%`);
        builder.orWhere('email', 'like', `%${q}%`);
      });
    }
    const paginator = await query.paginate(25);

    const registrar = currentApp().make<RegistrarLike>('permissions');
    const actor = await request.user();

    return Inertia.render('Admin/Users/Index', {
      users: {
        ...paginator,
        data: paginator.data.map((user) => ({
          ...user.toArray(),
          roles: registrar.rolesOf('users', user.getKey()).map((role) => role.name),
        })),
      },
      q,
      can: {
        create: true, // reached only with users.create middleware
        update: true,
        delete: true,
        _actorId: actor?.getKey() ?? null,
      },
      roles: registrar.allRoles().map((role) => role.name),
    });
  }

  /** GET /admin/users/create */
  public async create(request: Request) {
    void request;
    const registrar = currentApp().make<RegistrarLike>('permissions');
    return Inertia.render('Admin/Users/Create', {
      allRoles: registrar.allRoles().map((role) => role.name),
    });
  }

  /** POST /admin/users — validate -> create -> assign roles -> flash. */
  public async store(request: Request) {
    const data = await request.validate(AdminUserFormRequest);

    const user = (await User.create({
      name: String(data.name),
      email: String(data.email),
      password: await Hash.make(String(data.password)),
      is_admin: false,
      email_verified_at: new Date(),
    })) as User;

    await syncRolesFor(user, data.roles);
    this.flashStatus(request, `User "${String(data.name)}" created.`);
    return Response.redirect('/admin/users');
  }

  /** GET /admin/users/{user} — route-model bound. */
  public async show(user: User) {
    const registrar = currentApp().make<RegistrarLike>('permissions');
    return Inertia.render('Admin/Users/Show', {
      user: user.toArray(),
      roles: registrar.rolesOf('users', user.getKey()).map((role) => role.name),
    });
  }

  /** GET /admin/users/{user}/edit */
  public async edit(user: User) {
    const registrar = currentApp().make<RegistrarLike>('permissions');
    return Inertia.render('Admin/Users/Edit', {
      user: user.toArray(),
      userRoles: registrar.rolesOf('users', user.getKey()).map((role) => role.name),
      allRoles: registrar.allRoles().map((role) => role.name),
    });
  }

  /** PUT/PATCH /admin/users/{user} — blank password keeps the old one. */
  public async update(request: Request, user: User) {
    await this.authorize('update', user);
    const data = await request.validate(AdminUserFormRequest);

    user.setAttribute('name', String(data.name));
    user.setAttribute('email', String(data.email));
    const password = data.password ? String(data.password) : null;
    if (password) user.setAttribute('password', await Hash.make(password));
    await user.save();

    await syncRolesFor(user, data.roles);
    this.flashStatus(request, `User "${String(data.name)}" updated.`);
    return Response.redirect('/admin/users');
  }

  /** DELETE /admin/users/{user} — policy-gated, self-delete blocked. */
  public async destroy(request: Request, user: User) {
    await this.authorize('delete', user);

    const actor = await request.user();
    if (actor && actor.getKey() === user.getKey()) {
      throw new ValidationException({ user: ['You cannot delete your own account.'] });
    }

    await user.delete();
    this.flashStatus(request, `User "${String(user.toArray().name)}" deleted.`);
    return Response.redirect('/admin/users');
  }

  /** POST /admin/users/{user}/roles — escalation-guarded role replacement. */
  public async syncRoles(request: Request, user: User) {
    await this.authorize('assignRole', user, String(request.input('role_name', '')));
    const roles = request.input('roles');
    if (!Array.isArray(roles)) {
      throw new ValidationException({ roles: ['Roles must be an array.'] });
    }
    await syncRolesFor(user, roles.map(String));
    this.flashStatus(request, 'Roles updated.');
    return Response.redirect('/admin/users');
  }

  // -------------------------------------------------------- internals

  private flashStatus(request: Request, message: string): void {
    const session = request.session();
    if (session) {
      session.flash('status', message);
      session.save();
    }
  }
}

interface RegistrarLike {
  allRoles: () => Array<{ id: number; name: string }>;
  rolesOf: (type: string, id: unknown) => Array<{ name: string }>;
  syncModelRoles: (type: string, id: unknown, roles: string[]) => Promise<void>;
}

async function syncRolesFor(user: User, roles: unknown): Promise<void> {
  if (!Array.isArray(roles)) return;
  const registrar = currentApp().make<RegistrarLike>('permissions');
  const known = new Set(registrar.allRoles().map((role) => role.name));
  const clean = roles.map(String).filter((name) => known.has(name));
  await registrar.syncModelRoles('users', user.getKey(), clean);
}


