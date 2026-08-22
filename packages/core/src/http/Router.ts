import type { Application } from '../foundation/Application';
import type { ModelClass } from '../orm/Model';
import { RuntimeException } from '../support/exceptions';
import { singularize } from './uri';
import { Route } from './Route';
import { RouteRegistrar } from './RouteRegistrar';
import type { ExpandedMiddleware, HttpMethod, MiddlewareEntry, Newable, RouteAction, RouteAttributes } from './types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type RouteMatch =
  | { route: Route; params: Record<string, string | undefined> }
  | { notAllowed: true; allowedMethods: string[] }
  | null;

export interface ResourceOptions {
  only?: string[];
  except?: string[];
  names?: Record<string, string>;
}

/**
 * Laravel's router + RouteRegistrar combined. Fluent methods like
 * `middleware()`, `prefix()` and `name()` return a RouteRegistrar carrying
 * the attributes, so chains never leak state (exactly like Laravel).
 */
export class Router {
  private readonly app: Application;
  private readonly routeList: Route[] = [];
  private readonly middlewareAliases = new Map<string, MiddlewareEntry>();
  private readonly middlewareGroups = new Map<string, MiddlewareEntry[]>();
  private readonly modelBindings = new Map<string, ModelClass>();
  private attributes: RouteAttributes = {};

  public constructor(app: Application) {
    this.app = app;
  }

  // ------------------------------------------------------------ registration

  public get(uri: string, action: RouteAction): Route {
    return this.addRoute(['GET'], uri, action);
  }

  public post(uri: string, action: RouteAction): Route {
    return this.addRoute(['POST'], uri, action);
  }

  public put(uri: string, action: RouteAction): Route {
    return this.addRoute(['PUT'], uri, action);
  }

  public patch(uri: string, action: RouteAction): Route {
    return this.addRoute(['PATCH'], uri, action);
  }

  public delete(uri: string, action: RouteAction): Route {
    return this.addRoute(['DELETE'], uri, action);
  }

  public options(uri: string, action: RouteAction): Route {
    return this.addRoute(['OPTIONS'], uri, action);
  }

  public any(uri: string, action: RouteAction): Route {
    return this.addRoute(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], uri, action);
  }

  public match(methods: HttpMethod[], uri: string, action: RouteAction): Route {
    return this.addRoute(methods, uri, action);
  }

  /**
   * Register a resource controller's standard 7 routes:
   * index, create, store, show, edit, update, destroy.
   */
  public resource(name: string, controller: Newable, options: ResourceOptions = {}): void {
    const parameter = singularize(name);
    const actions: Array<[string, HttpMethod[], string]> = [
      ['index', ['GET'], name],
      ['create', ['GET'], `${name}/create`],
      ['store', ['POST'], name],
      ['show', ['GET'], `${name}/{${parameter}}`],
      ['edit', ['GET'], `${name}/{${parameter}}/edit`],
      ['update', ['PUT', 'PATCH'], `${name}/{${parameter}}`],
      ['destroy', ['DELETE'], `${name}/{${parameter}}`],
    ];

    for (const [methodName, methods, uri] of actions) {
      if (options.except?.includes(methodName)) continue;
      if (options.only && !options.only.includes(methodName)) continue;
      this.addRoute(methods, uri, [controller, methodName]).name(
        options.names?.[methodName] ?? `${name}.${methodName}`,
      );
    }
  }

  // -------------------------------------------------------- fluent registrar

  public middleware(middleware: MiddlewareEntry | MiddlewareEntry[]): RouteRegistrar {
    const list = Array.isArray(middleware) ? middleware : [middleware];
    return new RouteRegistrar(this, {
      ...this.attributes,
      middleware: [...(this.attributes.middleware ?? []), ...list],
    });
  }

  public prefix(prefix: string): RouteRegistrar {
    return new RouteRegistrar(this, {
      ...this.attributes,
      prefix: [this.attributes.prefix, prefix].filter(Boolean).join('/'),
    });
  }

  public name(name: string): RouteRegistrar {
    return new RouteRegistrar(this, {
      ...this.attributes,
      name: `${this.attributes.name ?? ''}${name}`,
    });
  }

  public as(name: string): RouteRegistrar {
    return this.name(name);
  }

  /** Apply attributes for the duration of the callback (supports async callbacks). */
  public group(callback: () => unknown | Promise<unknown>): Promise<unknown>;
  public group(attributes: RouteAttributes, callback: () => unknown | Promise<unknown>): Promise<unknown>;
  public group(
    attributesOrCallback: RouteAttributes | (() => unknown | Promise<unknown>),
    maybeCallback?: () => unknown | Promise<unknown>,
  ): Promise<unknown> {
    const attributes: RouteAttributes =
      typeof attributesOrCallback === 'function' ? {} : attributesOrCallback;
    const callback = typeof attributesOrCallback === 'function' ? attributesOrCallback : maybeCallback;
    if (!callback) throw new RuntimeException('group() requires a callback.');
    const previous = this.attributes;
    this.attributes = {
      prefix: [previous.prefix, attributes.prefix].filter(Boolean).join('/'),
      middleware: [...(previous.middleware ?? []), ...(attributes.middleware ?? [])],
      name: `${previous.name ?? ''}${attributes.name ?? ''}`,
    };
    return Promise.resolve(callback()).finally(() => {
      this.attributes = previous;
    });
  }

  // ------------------------------------------------- route model bindings

  /** Register a route model binding (Laravel: Route::model('user', User::class)). */
  public model(name: string, modelClass: ModelClass): this {
    this.modelBindings.set(name, modelClass);
    return this;
  }

  public getModelBinding(name: string): ModelClass | undefined {
    return this.modelBindings.get(name);
  }

  // ------------------------------------------------------ middleware registry

  /** Register a named middleware, e.g. router.middlewareAlias('auth', AuthMiddleware). */
  public middlewareAlias(name: string, middleware: MiddlewareEntry): this {
    this.middlewareAliases.set(name, middleware);
    return this;
  }

  /** Define a middleware group, e.g. router.groupMiddleware('web', [...]). */
  public groupMiddleware(name: string, middleware: MiddlewareEntry[]): this {
    this.middlewareGroups.set(name, [...middleware]);
    return this;
  }

  /**
   * Expand group names and aliases into concrete middleware entries.
   * Aliases may carry params (`auth:api`, `can:update,user`) — those become
   * ExpandedMiddleware entries whose params are passed to handle().
   */
  public expandMiddleware(entries: MiddlewareEntry[]): Array<MiddlewareEntry | ExpandedMiddleware> {
    const out: Array<MiddlewareEntry | ExpandedMiddleware> = [];
    const visit = (entry: MiddlewareEntry): void => {
      if (typeof entry === 'string') {
        const [name, ...rest] = entry.split(':');
        const params = rest.length > 0 ? rest.join(':').split(',').map((p) => p.trim()).filter(Boolean) : [];
        const group = this.middlewareGroups.get(name);
        if (group) {
          if (params.length > 0) {
            throw new RuntimeException(`Middleware group [${name}] does not accept parameters.`);
          }
          group.forEach(visit);
          return;
        }
        const alias = this.middlewareAliases.get(name);
        if (alias) {
          if (params.length > 0) out.push({ middleware: alias, params });
          else out.push(alias);
          return;
        }
        throw new RuntimeException(
          `Middleware [${name}] is not registered. Use router.middlewareAlias('${name}', Middleware) ` +
            `or define a middleware group named '${name}'.`,
        );
      }
      out.push(entry);
    };
    entries.forEach(visit);
    return out;
  }

  // -------------------------------------------------------------- matching

  public findRoute(method: string, path: string): RouteMatch {
    const allowedMethods: string[] = [];
    for (const route of this.routeList) {
      if (!route.matchesPath(path)) continue;
      if (route.matchesMethod(method)) {
        return { route, params: route.extractParams(path) };
      }
      allowedMethods.push(...route.methods);
    }
    if (allowedMethods.length > 0) {
      return { notAllowed: true, allowedMethods: [...new Set(allowedMethods)] };
    }
    return null;
  }

  public getRoutes(): Route[] {
    return [...this.routeList];
  }

  public has(name: string): boolean {
    return this.routeList.some((route) => route.getName() === name);
  }

  public route(name: string): Route | undefined {
    return this.routeList.find((route) => route.getName() === name);
  }

  // ------------------------------------------- registrar integration

  /** Register a route using explicit attributes (used by RouteRegistrar). */
  public registerWith(
    attributes: RouteAttributes,
    methods: HttpMethod[],
    uri: string,
    action: RouteAction,
  ): Route {
    const previous = this.attributes;
    this.attributes = attributes;
    try {
      return this.addRoute(methods, uri, action);
    } finally {
      this.attributes = previous;
    }
  }

  /** Register a resource using explicit attributes (used by RouteRegistrar). */
  public resourceWith(
    attributes: RouteAttributes,
    name: string,
    controller: Newable,
    options: ResourceOptions,
  ): void {
    const previous = this.attributes;
    this.attributes = attributes;
    try {
      this.resource(name, controller, options);
    } finally {
      this.attributes = previous;
    }
  }

  // -------------------------------------------------------------- internals

  private addRoute(methods: HttpMethod[], uri: string, action: RouteAction): Route {
    const route = new Route(methods, uri, action, this.attributes);
    this.routeList.push(route);
    return route;
  }

  public attributesSnapshot(): RouteAttributes {
    return { ...this.attributes };
  }

  public setAttributes(attributes: RouteAttributes): void {
    this.attributes = { ...attributes };
  }

  public get appInstance(): Application {
    return this.app;
  }

  // ---------------------------------------------------------- route caching

  /**
   * Export the current route table to a JSON-serializable cache object.
   * Each route stores its methods, URI, action (class name + method for
   * array actions, null for closures), name, and middleware.
   */
  public exportCache(): object[] {
    return this.routeList.map((route) => ({
      methods: route.methods,
      uri: route.uri,
      action: Array.isArray(route.action)
        ? { controller: route.action[0].name, method: route.action[1] }
        : null,
      name: route.getName() ?? null,
      middleware: route.getMiddleware(),
    }));
  }

  /**
   * SHA-256 over every file in the routes directory (sorted by relative
   * path) — the fingerprint used to detect stale caches (review 3.1).
   */
  public async computeRoutesHash(routesDir?: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    const dir = routesDir ?? this.app?.routesPath?.() ?? path.join(process.cwd(), 'routes');
    const hash = createHash('sha256');
    const walk = async (current: string, prefix: string): Promise<void> => {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(full, rel);
        } else if (entry.isFile()) {
          hash.update(rel);
          hash.update(await fs.readFile(full));
        }
      }
    };
    await walk(dir, '');
    return hash.digest('hex');
  }

  /** Cache-file envelope written by `route:cache` and understood by loadCache. */
  public async exportCacheWithMeta(): Promise<{ hash: string; exportedAt: number; routes: object[] }> {
    return {
      hash: await this.computeRoutesHash(),
      exportedAt: Date.now(),
      routes: this.exportCache(),
    };
  }

  /**
   * Load routes from a cached JSON file, bypassing route file registration.
   * Accepts both the wrapped `{ hash, routes }` envelope and the legacy bare
   * array. When the envelope's hash no longer matches the current routes
   * directory the cache is stale: it is deleted (with a warning) and this
   * returns false so callers fall back to fresh registration.
   * Returns true if valid cache was loaded, false otherwise.
   */
  public async loadCache(cachePath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(cachePath, 'utf-8');
      const parsed = JSON.parse(content) as
        | Array<{ methods: HttpMethod[]; uri: string; action: { controller: string; method: string } | null; name: string | null; middleware: MiddlewareEntry[] }>
        | { hash?: string; routes?: Array<{ methods: HttpMethod[]; uri: string; action: { controller: string; method: string } | null; name: string | null; middleware: MiddlewareEntry[] }> };

      const isEnvelope = !Array.isArray(parsed);
      const cached = isEnvelope ? parsed.routes ?? [] : parsed;
      const cachedHash = isEnvelope ? parsed.hash : undefined;

      // Stale-cache guard: routes changed since `route:cache` ran.
      if (typeof cachedHash === 'string') {
        const currentHash = await this.computeRoutesHash();
        if (currentHash !== cachedHash) {
          console.warn('  WARN  Route cache is stale (routes changed) — ignoring and deleting it.');
          await fs.unlink(cachePath).catch(() => undefined);
          return false;
        }
      }

      // Clear existing routes
      this.routeList.length = 0;

      for (const entry of cached) {
        // Store the action info as a string-based marker; the kernel resolves
        // the controller class from the container at dispatch time.
        // We store as `[controllerName, methodName]` — the kernel handles it.
        const action: RouteAction = entry.action
          ? [entry.action.controller as unknown as new (...args: unknown[]) => unknown, entry.action.method]
          : (() => {});
        const route = new Route(entry.methods, entry.uri, action, {});
        if (entry.name) route.name(entry.name);
        if (entry.middleware?.length) route.middleware(...entry.middleware);
        this.routeList.push(route);
      }

      return true;
    } catch {
      return false;
    }
  }
}
