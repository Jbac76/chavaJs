import { currentApp } from '../foundation/registry';

/**
 * Build a Proxy that forwards every property access / call to a singleton
 * resolved from the container — Laravel's static facades (`DB::table(...)`,
 * `Cache::get(...)`), but idiomatic JavaScript:
 *
 *   export const Route = facade<Router>('router');
 *   Route.get('/', [HomeController, 'index']);
 */
export function facade<T extends object>(accessor: string): T {
  const handler: ProxyHandler<object> = {
    get(_target, property, _receiver) {
      if (property === Symbol.toStringTag) return 'Facade';
      const instance = currentApp().make(accessor) as Record<string | symbol, unknown>;
      const value = Reflect.get(instance, property, instance);
      return typeof value === 'function' ? (value as Function).bind(instance) : value;
    },
    set(_target, property, value) {
      const instance = currentApp().make(accessor) as Record<string | symbol, unknown>;
      return Reflect.set(instance, property, value, instance);
    },
    apply(_target, _thisArg, args) {
      const instance = currentApp().make(accessor);
      return Reflect.apply(instance as Function, instance, args);
    },
    has(_target, property) {
      return property in (currentApp().make(accessor) as object);
    },
    ownKeys() {
      return Reflect.ownKeys(currentApp().make(accessor) as object);
    },
    getOwnPropertyDescriptor(_target, property) {
      const instance = currentApp().make(accessor) as object;
      return { value: Reflect.get(instance, property, instance), writable: true, enumerable: true, configurable: true };
    },
  };

  return new Proxy({} as object, handler) as unknown as T;
}
