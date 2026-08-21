import { joinPrefix, normalizePath } from './uri';
import type { HttpMethod, MiddlewareEntry, RouteAction, RouteAttributes } from './types';

interface CompiledUri {
  regex: RegExp;
  params: RouteParam[];
}

export interface RouteParam {
  name: string;
  optional: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileUri(uri: string, wheres: Record<string, string> = {}): CompiledUri {
  const params: RouteParam[] = [];
  const pattern = uri
    .split('/')
    .map((segment) => {
      if (segment === '') return '';
      const isParam = segment.startsWith('{') && segment.endsWith('}');
      if (!isParam) return `/${escapeRegExp(segment)}`;
      const inner = segment.slice(1, -1);
      const optional = inner.endsWith('?');
      const name = optional ? inner.slice(0, -1) : inner;
      params.push({ name, optional });
      const expression = wheres[name] ? `(${wheres[name]})` : '([^/]+)';
      return optional ? `(?:/${expression})?` : `/${expression}`;
    })
    .join('');
  return { regex: new RegExp(`^${pattern}/?$`), params };
}

/**
 * A registered route — the chavaJs equivalent of Illuminate\Routing\Route.
 */
export class Route {
  public readonly methods: HttpMethod[];
  public readonly uri: string;
  public readonly action: RouteAction;
  public readonly namePrefix: string;

  private middlewareList: MiddlewareEntry[];
  private routeName?: string;
  private wheres: Record<string, string> = {};
  private compiled: CompiledUri;

  public constructor(
    methods: HttpMethod[],
    uri: string,
    action: RouteAction,
    attributes: RouteAttributes = {},
  ) {
    this.methods = methods;
    this.uri = joinPrefix(attributes.prefix ?? '', uri);
    this.action = action;
    this.middlewareList = [...(attributes.middleware ?? [])];
    this.namePrefix = attributes.name ?? '';
    this.compiled = compileUri(this.uri);
  }

  /** Set the route name (prefixed by any registrar/group name prefix). */
  public name(name: string): this {
    this.routeName = `${this.namePrefix}${name}`;
    return this;
  }

  public getName(): string | undefined {
    return this.routeName;
  }

  /** Attach middleware directly to this route (Laravel: ->middleware('auth')). */
  public middleware(...middleware: MiddlewareEntry[]): this {
    this.middlewareList.push(...middleware);
    return this;
  }

  /** Add a regex constraint for a route parameter, e.g. ->where('id', '[0-9]+'). */
  public where(rule: Record<string, string>): this {
    this.wheres = { ...this.wheres, ...rule };
    this.compiled = compileUri(this.uri, this.wheres);
    return this;
  }

  /** Get the middleware attached to this route (from groups/registrar). */
  public getMiddleware(): MiddlewareEntry[] {
    return [...this.middlewareList];
  }

  public matchesPath(path: string): boolean {
    return this.compiled.regex.test(normalizePath(path));
  }

  public matchesMethod(method: string): boolean {
    const upper = method.toUpperCase();
    return this.methods.some((m) => m === upper || (m === 'GET' && upper === 'HEAD'));
  }

  public extractParams(path: string): Record<string, string | undefined> {
    const match = this.compiled.regex.exec(normalizePath(path));
    const out: Record<string, string | undefined> = {};
    if (match) {
      for (let i = 0; i < this.compiled.params.length; i++) {
        out[this.compiled.params[i].name] = match[i + 1];
      }
    }
    return out;
  }

  public describe(): string {
    return Array.isArray(this.action)
      ? `${this.action[0].name}@${this.action[1]}`
      : 'Closure';
  }
}
