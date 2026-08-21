import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import type { Request } from '../http/Request';
import type { Response } from '../http/Response';
import type { Inertia } from './Inertia';
import type { AuthManager } from '../auth/AuthManager';
import type { Model } from '../orm/Model';
import type { Notifiable } from '../notifications/Notifiable';

/** Is this model notifiable (has the unreadNotifications() API)? */
function isNotifiable(model: Model): model is Notifiable {
  return typeof (model as Notifiable).unreadNotifications === 'function';
}

/**
 * Laravel's HandleInertiaRequests middleware. Shares data with every Inertia
 * response — auth.user, validation errors and the CSRF token, matching
 * Laravel Breeze's shared props.
 */
export class HandleInertiaRequests {
  public constructor(
    private readonly inertia: Inertia,
    private readonly app: Application,
  ) {}

  public async handle(request: Request, next: () => Response | Promise<Response>): Promise<Response> {
    this.inertia.share(await this.share(request));
    return next();
  }

  /** Override to share additional props with every Inertia page. */
  protected async share(request: Request): Promise<Record<string, unknown>> {
    const config = this.app.make<Config>('config');
    const auth = this.app.make<AuthManager>('auth');
    const user = await auth.user();
    const session = request.session();

    return {
      app: {
        name: config.get('app.name', 'chavaJs'),
        env: this.app.environment(),
        version: this.app.version,
      },
      auth: {
        user: user ? user.toArray() : null,
        // Unread notification count for the nav badge (Laravel: a query in
        // HandleInertiaRequests or a view composer). Guarded so any model
        // from the auth provider (not just Notifiable subclasses) is safe.
        unreadNotifications: user && isNotifiable(user) ? await user.unreadNotifications().count() : 0,
      },
      errors: session?.get('errors', {}) ?? {},
      csrf_token: session?.token() ?? null,
      flash: {},
      hasDocs: existsSync(join(process.cwd(), 'docs')),
    };
  }
}
