import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from '../http/Request';

interface RequestContext {
  request: Request;
  routeParams: Record<string, unknown>;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with the current request (and resolved route params) in context. */
export function runWithRequestContext<T>(
  request: Request,
  routeParams: Record<string, unknown>,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return storage.run({ request, routeParams }, fn);
}

/** The request being handled in this async context (undefined in the CLI). */
export function currentRequest(): Request | undefined {
  return storage.getStore()?.request;
}

/** Route parameters (after model binding) for the current request. */
export function currentRouteParams(): Record<string, unknown> {
  return storage.getStore()?.routeParams ?? {};
}
