import { AppServiceProvider } from '../app/Providers/AppServiceProvider';
import { RouteServiceProvider } from '../app/Providers/RouteServiceProvider';
import { Application } from '../src/foundation/Application';
import { HandleInertiaRequests } from '../src/inertia/HandleInertiaRequests';
import { StartSession } from '../src/http/middleware/StartSession';
import { VerifyCsrfToken } from '../src/http/middleware/VerifyCsrfToken';

/**
 * The chavaJs application — Laravel's bootstrap/app.php equivalent.
 *
 * - providers:    application service providers (framework providers are
 *                 registered automatically before these)
 * - webMiddleware: members of the `web` middleware group — the session
 *                 middleware, Inertia request handling, and CSRF protection
 *                 (Laravel's default web group).
 */
export const app = Application.configure({
  name: 'chavaJs',
  providers: [AppServiceProvider, RouteServiceProvider],
  globalMiddleware: [],
  webMiddleware: [StartSession, HandleInertiaRequests, VerifyCsrfToken],
  apiMiddleware: [],
});

export default app;
