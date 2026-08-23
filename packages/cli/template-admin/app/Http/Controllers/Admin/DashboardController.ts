import { Inertia } from '../../../../src/facades';
import { Controller } from '../../../../src/http/Controller';
import { Request } from '../../../../src/http/Request';
import { User } from '../../../Models/User';

/**
 * GET /admin — aggregate stats in ONE round-trip (no N+1).
 */
export class DashboardController extends Controller {
  public async index(request: Request) {
    const paginator = await User.query().orderBy('created_at', 'desc').paginate(5);

    return Inertia.render('Admin/Dashboard', {
      stats: {
        users: await User.count(),
      },
      recentUsers: paginator.data.map((user) => user.toArray()),
    });
  }
}
