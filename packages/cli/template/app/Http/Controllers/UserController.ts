import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';
import { Response } from '../../../src/http/Response';
import { currentApp } from '../../../src/foundation/registry';
import { User } from '../../Models/User';

interface RegistrarLike {
  rolesOf: (type: string, id: unknown) => Array<{ name: string }>;
  allPermissionsOf: (type: string, id: unknown) => Array<{ name: string }>;
}

export class UserController extends Controller {
  /** GET /users — paginated directory, eager-loaded with posts. */
  public async index(request: Request) {
    const paginator = await User.with('posts').orderBy('name').paginate(10);
    const registrar = currentApp().make<RegistrarLike>('permissions');
    const actor = await request.user();

    return Inertia.render('Users/Index', {
      users: {
        ...paginator,
        data: paginator.data.map((user) => ({
          ...user.toArray(),
          roles: registrar.rolesOf('users', user.getKey()).map((role) => role.name),
          permissions: registrar.allPermissionsOf('users', user.getKey()).map((p) => p.name),
        })),
      },
      can: {
        viewUser: !!actor,
        editUser: !!actor,
        deleteUser: !!actor, // the UserPolicy enforces the real rules
      },
    });
  }

  /** GET /users/{user} — route-model-bound user, lazy eager loads posts. */
  public async show(user: User) {
    await user.load('posts');
    return Inertia.render('Users/Show', {
      user: user.toArray(),
    });
  }

  /** DELETE /users/{user} — policy-gated soft delete. */
  public async destroy(request: Request, user: User) {
    await this.authorize('delete', user);
    await user.delete();
    return request.back();
  }

  private async canDelete(request: Request): Promise<boolean> {
    const authUser = await request.user();
    if (!authUser) return false;
    // Any user can delete *their own* account - the policy handles it.
    return true;
  }
}
