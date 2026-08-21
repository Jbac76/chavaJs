import type { Application } from '../../foundation/Application';
import { Config } from '../../config/Config';
import type { Request } from '../Request';
import { Response } from '../Response';
import type { CookieOptions } from '../Response';
import type { NextFunction } from '../types';
import { safeEquals } from '../../session/signature';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Laravel's VerifyCsrfToken middleware — checks `_token` input, the
 * `X-CSRF-TOKEN` header, or the `X-XSRF-TOKEN` header (sent automatically by
 * Inertia's axios client from the XSRF-TOKEN cookie) against the session
 * token on state-changing requests. Responds 419 (Page Expired) on mismatch.
 *
 * Like Laravel, every passing response also receives a non-httpOnly
 * `XSRF-TOKEN` cookie so the browser can echo it back on later requests.
 */
export class VerifyCsrfToken {
  public constructor(private readonly app: Application) {}

  public async handle(request: Request, next: NextFunction): Promise<Response> {
    if (!UNSAFE_METHODS.has(request.method())) {
      // Reading requests pass, but still get the XSRF-TOKEN cookie so the
      // browser can echo it back on the first state-changing request.
      const response = await next();
      return this.addXsrfCookie(request, response);
    }

    const session = request.session();
    const token = session?.token() ?? '';
    const submitted =
      request.input('_token') ??
      request.header('x-csrf-token') ??
      request.header('x-xsrf-token') ??
      '';

    if (typeof submitted !== 'string' || !safeEquals(token, submitted)) {
      const response = new Response(null, 419);
      if (request.expectsJson()) {
        return response.json({ message: 'CSRF token mismatch.' }, 419);
      }
      return response.html('<h1>419 Page Expired</h1>', 419);
    }

    const response = await next();
    return this.addXsrfCookie(request, response);
  }

  /** Laravel's addCookieToResponse: expose the session token as a cookie. */
  private addXsrfCookie(request: Request, response: Response): Response {
    const session = request.session();
    if (!session) return response;
    const config = this.app.make<Config>('config');
    const sameSite = config.get<string>('session.same_site', 'lax');
    const options: CookieOptions = {
      httpOnly: false, // the JS client must be able to read it
      secure: config.get('session.secure', false),
      sameSite: sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax',
      path: '/',
      maxAge: Number(config.get('session.lifetime', 120)) * 60,
    };
    return response.cookie('XSRF-TOKEN', session.token(), options);
  }
}
