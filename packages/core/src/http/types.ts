import type { Request } from './Request';
import type { Response } from './Response';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

/** The `next` callback passed to middleware (Laravel: $next). */
export type NextFunction = () => Response | Promise<Response>;

/** Laravel middleware signature: handle(request, next, ...params). */
export type MiddlewareFunction = (
  request: Request,
  next: NextFunction,
  ...params: string[]
) => Response | Promise<Response>;

export interface MiddlewareClass {
  new (...args: never[]): { handle: MiddlewareFunction };
}

export type MiddlewareEntry = string | MiddlewareClass | MiddlewareFunction;

/** An expanded middleware with its params, e.g. `auth:api` → (Authenticate, ['api']). */
export interface ExpandedMiddleware {
  middleware: MiddlewareEntry;
  params: string[];
}

/** A single-action controller (Laravel: make:controller --invokable). */
export type InvokableController = new (...args: unknown[]) => {
  __invoke(...args: unknown[]): unknown;
};

/** [ControllerClass, 'method'] tuple, invokable class, or a route closure. */
export type RouteAction = [new (...args: unknown[]) => unknown, string] | InvokableController | RouteCallback;

export type RouteCallback = (request: Request, ...routeParams: (string | object)[]) => unknown;

export type Newable<T = unknown> = new (...args: unknown[]) => T;

export interface RouteAttributes {
  prefix?: string;
  middleware?: MiddlewareEntry[];
  /** Name prefix applied to routes defined within the group/registrar. */
  name?: string;
}
