import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';
import { User } from '../../Models/User';

export class DashboardController extends Controller {
  /** GET /dashboard — protected by `auth` middleware. */
  public async index(request: Request) {
    const user = (await request.user()) as User;
    const users = await User.query().orderBy('name').limit(5).get();

    return Inertia.render('Dashboard', {
      user: user.toArray(),
      stats: {
        totalUsers: await User.count(),
        recentUsers: users.map((item) => item.toArray()),
      },
    });
  }
}
