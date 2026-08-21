import { ServiceProvider } from '../container/ServiceProvider';
import { AuthManager } from '../auth/AuthManager';
import { Gate } from '../auth/Gate';
import { Authenticate } from '../http/middleware/Authenticate';
import { RedirectIfAuthenticated } from '../http/middleware/RedirectIfAuthenticated';
import { EnsureEmailIsVerified } from '../http/middleware/EnsureEmailIsVerified';
import { CanMiddleware } from '../http/middleware/CanMiddleware';
import type { Router } from '../http/Router';

/**
 * Binds the `auth` manager and `gate` singleton, and registers Laravel's
 * auth middleware aliases on the router:
 *
 *   auth, guest, verified, can:update,user
 */
export class AuthServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('auth', () => new AuthManager(this.app));
    this.app.alias('Auth', 'auth');

    this.app.singleton('gate', () => new Gate(this.app));
    this.app.alias('Gate', 'gate');
  }

  public async boot(): Promise<void> {
    const router = this.app.make<Router>('router');
    router.middlewareAlias('auth', Authenticate);
    router.middlewareAlias('guest', RedirectIfAuthenticated);
    router.middlewareAlias('verified', EnsureEmailIsVerified);
    router.middlewareAlias('can', CanMiddleware);
  }
}
