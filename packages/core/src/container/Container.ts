import { BindingResolutionException, RuntimeException } from '../support/exceptions';
import { capitalize, isClass, paramNamesOf, type ParamInfo } from '../support/reflect';
import { getInjectMetadata } from './inject';

interface Binding {
  concrete: unknown;
  singleton: boolean;
  shared?: unknown;
}

const PRIMITIVE_PARAMS = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'symbol',
  'object',
  'array',
  'any',
  'unknown',
  'void',
  'never',
  'undefined',
  'null',
  'date',
  'error',
]);

function normalizeKey(abstract: unknown): string {
  return typeof abstract === 'function' ? abstract.name : String(abstract);
}

/**
 * The Laravel service container, ported to JavaScript:
 * - `bind` / `singleton` / `instance` / `alias` registrations
 * - `make()` with automatic constructor resolution by parameter name
 * - `call()` to invoke class methods with resolved dependencies
 */
export class Container {
  private readonly bindings = new Map<string, Binding>();
  private readonly instances = new Map<string, unknown>();
  private readonly aliases = new Map<string, string>();
  /** Contextual bindings: target class name → parameter name → given value. */
  private readonly contextual = new Map<string, Map<string, unknown>>();

  /** Register a binding (class, factory, or instance). */
  public bind(abstract: unknown, concrete: unknown, singleton = false): this {
    this.bindings.set(normalizeKey(abstract), { concrete, singleton });
    return this;
  }

  /** Register a shared (singleton) binding. */
  public singleton(abstract: unknown, concrete: unknown): this {
    return this.bind(abstract, concrete, true);
  }

  /** Bind an already-instantiated value. */
  public instance(abstract: unknown, value: unknown): this {
    this.instances.set(normalizeKey(abstract), value);
    return this;
  }

  /** Register an alias so `make(alias)` resolves `abstract`. */
  public alias(alias: unknown, abstract: unknown): this {
    this.aliases.set(normalizeKey(alias), normalizeKey(abstract));
    return this;
  }

  /**
   * Laravel's contextual bindings: when `concrete` is built, its `needs`
   * parameter resolves to the given value/class/closure instead of the
   * container's normal lookup.
   *
   *   container.when(ReportService).needs('stripe').give(StripeClient);
   *   container.when(ReportService).needs('config').give(() => fakeConfig);
   */
  public when(concrete: unknown): ContextualBindingBuilder {
    return new ContextualBindingBuilder(this, normalizeKey(concrete));
  }

  /** Register a contextual binding (called by the builder). */
  public addContextualBinding(target: string, param: string, value: unknown): void {
    let map = this.contextual.get(target);
    if (!map) {
      map = new Map();
      this.contextual.set(target, map);
    }
    map.set(normalizeKey(param), value);
  }

  /** The contextual value for a target's param, if registered. */
  public contextualBinding(target: string, param: string): unknown {
    const map = this.contextual.get(target);
    return map?.get(normalizeKey(param));
  }

  /** Whether the container can resolve the given abstract. */
  public bound(abstract: unknown): boolean {
    const key = this.keyOf(abstract);
    return this.instances.has(key) || this.bindings.has(key);
  }

  /**
   * Resolve a binding. Classes with no explicit binding are auto-wired:
   * constructor parameters are resolved by name from other bindings.
   */
  public make<T = unknown>(abstract: unknown, overrides: Record<string, unknown> = {}): T {
    const key = this.keyOf(abstract);

    const sharedInstance = this.instances.get(key);
    if (sharedInstance !== undefined) return sharedInstance as T;

    const binding = this.bindings.get(key);
    if (binding) {
      if (binding.singleton && binding.shared !== undefined) {
        return binding.shared as T;
      }
      const resolved = this.resolveConcrete(binding.concrete, overrides);
      if (binding.singleton) binding.shared = resolved;
      return resolved as T;
    }

    if (isClass(abstract)) {
      return this.build(abstract as new (...args: unknown[]) => unknown, overrides) as T;
    }

    throw new BindingResolutionException(
      `Target [${key}] is not resolvable from the container. ` +
        `Bind it first, e.g. app.singleton('${key}', () => ...) or app.bind('${key}', SomeClass).`,
    );
  }

  /**
   * Invoke a function or a class method with dependency injection.
   *
   *   app.call(MyController, 'index', { request, id: 1 })
   *   app.call((config) => config.get('app.name'))
   */
  public call<T = unknown>(
    target: unknown,
    method: string | null = null,
    params: Record<string, unknown> = {},
  ): T {
    const { targetInstance, fn } = this.resolveCallable(target, method);
    const args = this.paramNamesOf(fn).map((info) =>
      this.resolveParam(info.name, params, false, info.hasDefault),
    );
    return fn.apply(targetInstance, args) as T;
  }

  // ------------------------------------------------------------------ internals

  private keyOf(abstract: unknown): string {
    const key = normalizeKey(abstract);
    return this.aliases.get(key) ?? key;
  }

  private resolveConcrete(concrete: unknown, overrides: Record<string, unknown>): unknown {
    if (isClass(concrete)) {
      return this.build(concrete as new (...args: unknown[]) => unknown, overrides);
    }
    if (typeof concrete === 'function') {
      return (concrete as (container: Container) => unknown)(this);
    }
    return concrete;
  }

  private build(ctor: new (...args: unknown[]) => unknown, overrides: Record<string, unknown>): unknown {
    const params = this.paramNamesOf(ctor);
    const target = ctor.name;

    // Check for @inject metadata first (explicit DI)
    const injectMeta = getInjectMetadata(ctor);
    const args = params.map((info, index) => {
      // @inject overrides parameter-name resolution
      const injectBinding = injectMeta?.get(index);
      if (injectBinding !== undefined) {
        if (this.bound(injectBinding)) return this.make(injectBinding);
        throw new BindingResolutionException(
          `@inject('${injectBinding}') resolved no binding. Register it with app.bind('${injectBinding}', ...).`,
        );
      }

      // Contextual bindings win over everything (Laravel semantics).
      const contextual = this.contextualBinding(target, info.name);
      if (contextual !== undefined) {
        return this.resolveContextualValue(contextual);
      }
      return this.resolveParam(info.name, overrides, true, info.hasDefault);
    });
    return new ctor(...args);
  }

  /** Resolve the value given to `give()`: value, class, closure or binding name. */
  private resolveContextualValue(value: unknown): unknown {
    if (isClass(value)) {
      return this.make(value);
    }
    if (typeof value === 'function') {
      return (value as (container: Container) => unknown)(this);
    }
    if (typeof value === 'string' && this.bound(value)) {
      return this.make(value);
    }
    return value;
  }

  private resolveParam(
    name: string,
    params: Record<string, unknown>,
    strict: boolean,
    hasDefault: boolean = false,
  ): unknown {
    if (params[name] !== undefined) return params[name];

    const candidates = [name, name.toLowerCase(), capitalize(name)];
    for (const candidate of candidates) {
      if (this.bound(candidate)) return this.make(candidate);
    }

    // Defaulted/optional params receive `undefined` (which triggers the JS
    // default), as do primitive-looking names. Only throw for genuinely
    // unresolvable dependencies in strict (constructor) mode.
    if (!strict || hasDefault || PRIMITIVE_PARAMS.has(name.toLowerCase())) return undefined;

    throw new BindingResolutionException(
      `Unable to resolve constructor/method parameter [${name}]. ` +
        `No binding named [${name}], [${name.toLowerCase()}] or [${capitalize(name)}] was found in the container.`,
    );
  }

  private resolveCallable(
    target: unknown,
    method: string | null,
  ): { targetInstance: unknown; fn: Function } {
    if (typeof target === 'function') {
      if (method) {
        const instance = this.make(target);
        const fn = (instance as Record<string, unknown>)[method];
        if (typeof fn !== 'function') {
          throw new RuntimeException(`Method [${method}] does not exist on [${target.name}].`);
        }
        return { targetInstance: instance, fn };
      }
      return { targetInstance: null, fn: target };
    }

    const fn = (target as Record<string, unknown>)[method ?? ''];
    if (typeof fn !== 'function') {
      throw new RuntimeException(`Method [${method ?? ''}] does not exist on the given target.`);
    }
    return { targetInstance: target, fn };
  }

  private paramNamesOf(fn: Function): ParamInfo[] {
    return paramNamesOf(fn);
  }
}

/**
 * Laravel's ContextualBindingBuilder: `when(X)->needs('y')->give(z)`.
 */
export class ContextualBindingBuilder {
  private param: string | null = null;

  public constructor(
    private readonly container: Container,
    private readonly target: string,
  ) {}

  public needs(param: unknown): this {
    this.param = normalizeKey(param);
    return this;
  }

  public give(value: unknown): void {
    if (this.param === null) {
      throw new RuntimeException('Call needs() before give() when registering a contextual binding.');
    }
    this.container.addContextualBinding(this.target, this.param, value);
  }
}
