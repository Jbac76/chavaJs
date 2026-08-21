import { join } from 'node:path';
import { ServiceProvider } from '../container/ServiceProvider';
import { registerDocsRoutes } from '../docs/routes';
import { Router } from '../http/Router';

/** Binds the `router` singleton that backs the `Route` facade. */
export class RoutingServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('router', () => new Router(this.app));
    this.app.alias('Router', 'router');
  }

  public async boot(): Promise<void> {
    // Serve the in-app framework documentation at /docs when the app carries a
    // `docs/` directory (opt-in via `chava new --docs`). No-op otherwise.
    registerDocsRoutes(this.app.make<Router>('router'), join(process.cwd(), 'docs'));
  }
}
