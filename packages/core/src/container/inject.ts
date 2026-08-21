/**
 * `@inject('binding')` decorator — explicit alternative to constructor-name
 * resolution for dependency injection.
 *
 * Usage:
 *   import { inject } from '../container/inject';
 *
 *   class MyService {
 *     constructor(@inject('cache') private cache: CacheService) {}
 *   }
 *
 * The container checks for @inject metadata before falling back to
 * parameter-name resolution. Backward-compatible with existing code.
 */

const INJECT_METADATA = new WeakMap<object, Map<number, string>>();

export function inject(binding: string): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    if (typeof target === 'function') {
      // Class constructor parameter
      let map = INJECT_METADATA.get(target);
      if (!map) {
        map = new Map();
        INJECT_METADATA.set(target, map);
      }
      map.set(parameterIndex, binding);
    }
  };
}

/**
 * Get the inject metadata for a class constructor.
 * Returns a map of parameter index → binding name.
 */
export function getInjectMetadata(target: object): Map<number, string> | undefined {
  return INJECT_METADATA.get(target);
}
