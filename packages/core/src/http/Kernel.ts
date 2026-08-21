import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, normalize, resolve, sep } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Application } from '../foundation/Application';
import { runWithRequestContext } from '../foundation/request-context';
import { isClass } from '../support/reflect';
import { AuthorizationException, NotFoundException, RuntimeException, ValidationException } from '../support/exceptions';
import { sessionCookieFor } from './middleware/StartSession';
import { Pipeline } from './Pipeline';
import { Request } from './Request';
import { Response } from './Response';
import { Router } from './Router';
import type { ExpandedMiddleware, MiddlewareEntry, MiddlewareFunction, RouteAction, RouteCallback } from './types';

/**
 * The HTTP kernel — Laravel's Illuminate\Foundation\Http\Kernel equivalent.
 * Handles every request: parse → route → middleware pipeline → controller
 * dispatch → response.
 */
export class HttpKernel {
  private readonly app: Application;

  public constructor(app: Application) {
    this.app = app;
  }

  public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let request: Request | undefined;
    try {
      request = await Request.fromNode(req);

      // Serve built assets from public/ (Laravel's public directory).
      if (request.method() === 'GET' && request.path().startsWith('/build/')) {
        return this.serveStatic(res, request.path());
      }

      const router = this.app.make<Router>('router');
      const match = router.findRoute(request.method(), request.path());

      if (match === null) {
        return this.abort(res, request, 404, 'Not Found');
      }
      if ('notAllowed' in match) {
        res.setHeader('allow', match.allowedMethods.join(', '));
        return this.abort(res, request, 405, 'Method Not Allowed');
      }

      const middleware = this.resolveMiddlewareList(
        router.expandMiddleware(match.route.getMiddleware()),
        router,
      );
      const resolvedParams = await this.resolveModelBindings(router, match.params);
      const pipeline = new Pipeline(middleware);
      const resolvedRequest = request!;
      const response = await runWithRequestContext(resolvedRequest, resolvedParams, () =>
        pipeline.run(resolvedRequest, () => this.dispatch(resolvedRequest, match.route.action, resolvedParams)),
      );
      await this.respond(res, resolvedRequest, response);
    } catch (error) {
      await this.handleException(res, request, error);
    }
  }

  // ------------------------------------------------------------ internals

  /** Resolve route model bindings (Laravel: Route::model('user', User::class)). */
  private async resolveModelBindings(
    router: Router,
    params: Record<string, string | undefined>,
  ): Promise<Record<string, string | undefined | object>> {
    const resolved: Record<string, string | undefined | object> = { ...params };
    for (const [name, value] of Object.entries(params)) {
      const modelClass = router.getModelBinding(name);
      if (!modelClass || value === undefined) continue;
      try {
        resolved[name] = await modelClass.findOrFail(value);
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new NotFoundException(`Model [${modelClass.name}] not found for route parameter [${name}].`);
        }
        throw error;
      }
    }
    return resolved;
  }

  private async dispatch(
    request: Request,
    action: RouteAction,
    params: Record<string, unknown>,
  ): Promise<Response> {
    let result: unknown;
    if (Array.isArray(action)) {
      const [controller, method] = action;
      // Await so async controller methods resolve properly.
      result = await this.app.call(controller, method, { request, ...params });
    } else if (isClass(action)) {
      // Single-action controller (Laravel: make:controller --invokable).
      const instance = this.app.make(action);
      result = await this.app.call(instance, '__invoke', { request, ...params });
    } else {
      result = await this.invokeClosure(action as RouteCallback, request, params);
    }
    return this.toResponse(result);
  }

  private async invokeClosure(
    closure: RouteCallback,
    request: Request,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const positional = Object.values(params).filter((value): value is string | object => value !== undefined);
    return closure(request, ...positional);
  }

  private toResponse(result: unknown): Response {
    if (result instanceof Response) return result;
    if (result === null || result === undefined) return Response.noContent();
    if (typeof result === 'string') return new Response(result).contentType('text/plain; charset=utf-8');
    return Response.json(result);
  }

  private resolveMiddlewareList(
    entries: Array<MiddlewareEntry | ExpandedMiddleware>,
    router: Router,
  ): MiddlewareFunction[] {
    return entries.map((entry) => this.resolveMiddleware(entry, router));
  }

  private resolveMiddleware(entry: MiddlewareEntry | ExpandedMiddleware, router: Router): MiddlewareFunction {
    if (entry !== null && typeof entry === 'object') {
      // Parametrized middleware (auth:api → Authenticate with ['api']).
      const base = this.resolveMiddleware(entry.middleware, router);
      return (request, next) => base(request, next, ...entry.params);
    }
    if (typeof entry !== 'function') {
      // String entries should already be expanded; expand defensively.
      return this.resolveMiddlewareList(router.expandMiddleware([entry]), router)[0];
    }
    if (isClass(entry)) {
      const instance = this.app.make(entry);
      const handle = (instance as { handle: MiddlewareFunction }).handle;
      if (typeof handle !== 'function') {
        throw new Error(`Middleware class [${entry.name}] must implement handle(request, next).`);
      }
      return handle.bind(instance);
    }
    return entry as MiddlewareFunction;
  }

  private async respond(
    res: ServerResponse,
    request: Request,
    response: Response,
  ): Promise<void> {
    // The base Response.toNode ignores the extra request/app arguments; the
    // Inertia adapter (a Response subclass living in @chavajs/inertia-react)
    // overrides toNode to render the HTML shell / Inertia JSON protocol. No
    // instanceof check needed — core never imports the inertia package.
    await response.toNode(res, request, this.app);
  }

  private serveStatic(res: ServerResponse, path: string): void {
    const normalized = normalize(path).replace(/^([/\\])+/, '');
    const publicDir = resolve(this.app.publicPath());
    const filePath = resolve(publicDir, normalized);
    // Resolve + separator-bounded check so sibling dirs (e.g. `public2`)
    // can never escape the public directory.
    if ((filePath !== publicDir && !filePath.startsWith(publicDir + sep)) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }
    const type = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    createReadStream(filePath).pipe(res);
  }

  private abort(res: ServerResponse, request: Request, status: number, message: string): void {
    const response =
      request.expectsJson() || request.wantsJson()
        ? Response.json({ message }, status)
        : Response.html(`<h1>${status} ${message}</h1>`, status);
    response.toNode(res);
  }

  private handleException(res: ServerResponse, request: Request | undefined, error: unknown): void | Promise<void> {
    if (res.headersSent) {
      res.end();
      return;
    }

    // If Request.fromNode() itself threw, request is undefined — return a
    // minimal error response without trying to access the request.
    if (!request) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      const response = Response.json({ message: this.app.isDebug() ? message : 'Internal Server Error' }, 500);
      response.toNode(res);
      return;
    }

    // Laravel's 404 for missing route-model bindings / findOrFail misses.
    if (error instanceof NotFoundException) {
      const response = Response.json({ message: 'Not Found' }, 404);
      this.attachSessionCookie(request, response);
      response.toNode(res);
      return;
    }

    // RuntimeException → 413 Payload Too Large (body size limit) or 400.
    // Must come AFTER ValidationException / AuthorizationException checks
    // since they extend RuntimeException.
    if (error instanceof RuntimeException && !(error instanceof ValidationException) && !(error instanceof AuthorizationException)) {
      const message = error instanceof Error ? error.message : String(error);
      const status = /exceed|limit|too large/i.test(message) ? 413 : 400;
      const response = request.expectsJson() || request.wantsJson()
        ? Response.json({ message }, status)
        : Response.html(`<h1>${status} ${status === 413 ? 'Payload Too Large' : 'Bad Request'}</h1><p>${message}</p>`, status);
      this.attachSessionCookie(request, response);
      response.toNode(res);
      return;
    }

    // ValidationException → 422 for JSON, redirect back for HTML/Inertia.
    if (error instanceof ValidationException) {
      const errors = error.errors;
      const session = request.session();
      if (session) {
        session.flash('errors', errors);
        session.flashInput(request.all());
        session.save();
      }
      if (request.expectsJson() || request.wantsJson()) {
        const response = Response.json({ message: error.message, errors }, 422);
        this.attachSessionCookie(request, response);
        response.toNode(res);
        return;
      }
      const response = Response.redirect(request.header('referer') ?? request.session()?.previousUrl() ?? '/');
      // The redirect must keep the session cookie so the flashed errors
      // survive the round trip (StartSession couldn't attach it — we threw).
      this.attachSessionCookie(request, response);
      response.toNode(res);
      return;
    }

    // AuthorizationException → 403 (Laravel aborts with Forbidden).
    if (error instanceof AuthorizationException) {
      const message = error instanceof Error ? error.message : 'This action is unauthorized.';
      const response = request.expectsJson() || request.wantsJson()
        ? Response.json({ message }, 403)
        : Response.html(`<h1>403 Forbidden</h1><p>${message}</p>`, 403);
      this.attachSessionCookie(request, response);
      response.toNode(res);
      return;
    }

    console.error(error);
    const payload = this.app.isDebug()
      ? { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }
      : { message: 'Internal Server Error' };
    const response = Response.json(payload, 500);
    this.attachSessionCookie(request, response);
    response.toNode(res);
  }

  /**
   * Laravel's exception handler always sets the session cookie on the error
   * response (the session may have been modified before the controller
   * threw — e.g. flashed errors, login state). Attach it here since
   * StartSession's post-next cookie write is skipped when the pipeline throws.
   */
  private attachSessionCookie(request: Request, response: Response): void {
    const session = request.session();
    if (!session) return;
    const cookie = sessionCookieFor(this.app, session);
    response.cookie(cookie.name, cookie.value, cookie.options);
  }
}

const MIME_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
};
