import type { Application } from '../../foundation/Application';
import type { Request } from '../Request';
import { Response } from '../Response';
import type { NextFunction } from '../types';
import type { AuthManager } from '../../auth/AuthManager';

/**
 * Laravel's RedirectIfAuthenticated middleware (alias `guest`) — sends
 * authenticated users to /dashboard so login/register pages stay guest-only.
 */
export class RedirectIfAuthenticated {
  public constructor(private readonly app: Application) {}

  public async handle(request: Request, next: NextFunction, ...guards: string[]): Promise<Response> {
    const guardName = guards[0] ?? 'web';
    const auth = this.app.make<AuthManager>('auth');

    if (await auth.check(guardName)) {
      return Response.redirect('/dashboard');
    }

    return next();
  }
}
