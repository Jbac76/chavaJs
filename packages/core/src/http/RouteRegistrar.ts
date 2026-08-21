import type { Router } from './Router';
import type { HttpMethod, MiddlewareEntry, Newable, RouteAction, RouteAttributes } from './types';

/**
 * The object returned by fluent chains like `Route.middleware('web')` —
 * Laravel's RouteRegistrar. It carries a snapshot of the router attributes;
 * mutating it never leaks into the router's global state.
 */
export class RouteRegistrar {
  public constructor(
    private readonly router: Router,
    private readonly attributes: RouteAttributes,
  ) {}

  public get(uri: string, action: RouteAction) {
    return this.router.registerWith(this.attributes, ['GET'], uri, action);
  }

  public post(uri: string, action: RouteAction) {
    return this.router.registerWith(this.attributes, ['POST'], uri, action);
  }

  public put(uri: string, action: RouteAction) {
    return this.router.registerWith(this.attributes, ['PUT'], uri, action);
  }

  public patch(uri: string, action: RouteAction) {
    return this.router.registerWith(this.attributes, ['PATCH'], uri, action);
  }

  public delete(uri: string, action: RouteAction) {
    return this.router.registerWith(this.attributes, ['DELETE'], uri, action);
  }

  public match(methods: HttpMethod[], uri: string, action: RouteAction) {
    return this.router.registerWith(this.attributes, methods, uri, action);
  }

  public resource(name: string, controller: Newable, options?: { only?: string[]; except?: string[]; names?: Record<string, string> }) {
    this.router.resourceWith(this.attributes, name, controller, options ?? {});
  }

  public middleware(middleware: MiddlewareEntry | MiddlewareEntry[]): RouteRegistrar {
    const list = Array.isArray(middleware) ? middleware : [middleware];
    return new RouteRegistrar(this.router, {
      ...this.attributes,
      middleware: [...(this.attributes.middleware ?? []), ...list],
    });
  }

  public prefix(prefix: string): RouteRegistrar {
    return new RouteRegistrar(this.router, {
      ...this.attributes,
      prefix: [this.attributes.prefix, prefix].filter(Boolean).join('/'),
    });
  }

  public name(name: string): RouteRegistrar {
    return new RouteRegistrar(this.router, {
      ...this.attributes,
      name: `${this.attributes.name ?? ''}${name}`,
    });
  }

  public as(name: string): RouteRegistrar {
    return this.name(name);
  }

  /** Apply these attributes for the duration of the callback. */
  public group(callback: () => unknown | Promise<unknown>): Promise<unknown>;
  public group(attributes: RouteAttributes, callback: () => unknown | Promise<unknown>): Promise<unknown>;
  public group(
    attributesOrCallback: RouteAttributes | (() => unknown | Promise<unknown>),
    maybeCallback?: () => unknown | Promise<unknown>,
  ): Promise<unknown> {
    const attributes: RouteAttributes =
      typeof attributesOrCallback === 'function' ? {} : attributesOrCallback;
    const callback = typeof attributesOrCallback === 'function' ? attributesOrCallback : maybeCallback;
    if (!callback) throw new Error('group() requires a callback.');
    const previous = this.router.attributesSnapshot();
    this.router.setAttributes({
      prefix: [this.attributes.prefix, attributes.prefix].filter(Boolean).join('/'),
      middleware: [...(this.attributes.middleware ?? []), ...(attributes.middleware ?? [])],
      name: `${this.attributes.name ?? ''}${attributes.name ?? ''}`,
    });
    return Promise.resolve(callback()).finally(() => {
      this.router.setAttributes(previous);
    });
  }
}
