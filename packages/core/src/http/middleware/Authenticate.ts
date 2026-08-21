import type { Application } from '../../foundation/Application';
import type { Request } from '../Request';
import { Response } from '../Response';
import type { NextFunction } from '../types';
import type { AuthManager } from '../../auth/AuthManager';

/**
 * Laravel's Authenticate middleware (alias `auth`). Optionally takes a guard
 * name: `auth:api`. Redirects guests to /login, returns 401 for JSON/Inertia.
 */
export class Authenticate {
  public constructor(private readonly app: Application) {}

  public async handle(request: Request, next: NextFunction, ...guards: string[]): Promise<Response> {
    const guardName = guards[0] ?? 'web';
    const auth = this.app.make<AuthManager>('auth');

    if (!(await auth.check(guardName))) {
      return this.unauthenticated(request, guardName);
    }

    return next();
  }

  private unauthenticated(request: Request, guardName: string): Response {
    if (request.expectsJson() || request.wantsJson() || guardName === 'api') {
      return Response.json({ message: 'Unauthenticated.' }, 401);
    }
    return Response.redirect('/login');
  }
}
