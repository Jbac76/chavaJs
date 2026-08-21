import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';
import { Response } from '../../../src/http/Response';
import { User } from '../../Models/User';

export class UserController extends Controller {
  /** GET /users — paginated list, eager-loaded with posts. */
  public async index(request: Request) {
    const paginator = await User.with('posts').orderBy('name').paginate(10);
    return Inertia.render('Users/Index', {
      users: {
        ...paginator,
        data: paginator.data.map((user) => user.toArray()),
      },
      can: {
        deleteUser: await this.canDelete(request),
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
    // Any user can delete *their own* account — the policy handles it.
    return true;
  }
}
