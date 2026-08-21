import type { Application } from '../../foundation/Application';
import type { Request } from '../Request';
import { Response } from '../Response';
import type { NextFunction } from '../types';
import type { AuthManager } from '../../auth/AuthManager';

/**
 * Laravel's EnsureEmailIsVerified middleware (alias `verified`) — blocks
 * unverified users (models expose hasVerifiedEmail()).
 */
export class EnsureEmailIsVerified {
  public constructor(private readonly app: Application) {}

  public async handle(request: Request, next: NextFunction): Promise<Response> {
    const auth = this.app.make<AuthManager>('auth');
    const user = await auth.user();

    if (user && !hasVerifiedEmail(user)) {
      return request.expectsJson() || request.wantsJson()
        ? Response.json({ message: 'Your email address is not verified.' }, 403)
        : Response.redirect('/email/verify');
    }

    return next();
  }
}

function hasVerifiedEmail(user: object): boolean {
  const value = (user as { getAttribute: (key: string) => unknown }).getAttribute('email_verified_at');
  return value !== null && value !== undefined;
}
