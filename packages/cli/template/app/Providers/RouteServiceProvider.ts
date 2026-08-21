import { ServiceProvider } from '../../src/container/ServiceProvider';
import { Router } from '../../src/http/Router';

/**
 * Loads routes/web.ts inside the `web` middleware group and routes/api.ts
 * inside the `api` group — the chavaJs equivalent of Laravel's
 * RouteServiceProvider / bootstrap/app.php withRouting().
 */
export class RouteServiceProvider extends ServiceProvider {
  public async boot(): Promise<void> {
    const router = this.app.make<Router>('router');

    // Define the middleware groups (Laravel's bootstrap/app.php → withMiddleware()).
    router.groupMiddleware('web', this.app.getWebMiddleware());
    router.groupMiddleware('api', this.app.getApiMiddleware());

    // Register route-level middleware aliases here, e.g.:
    // router.middlewareAlias('auth', AuthMiddleware);

    await router.middleware('web').group(() => import('../../routes/web'));
    await router.middleware('api').prefix('api').group(() => import('../../routes/api'));
    await import('../../routes/console');
  }
}
