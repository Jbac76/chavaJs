/**
 * Reflection helpers used by the service container for auto-wiring.
 *
 * TypeScript type annotations are erased at runtime, so — like many JS DI
 * containers (Angular 1 style) — we resolve constructor parameters by name:
 * `constructor(config: Config)` resolves the binding keyed `config`.
 */

export function isClass(value: unknown): boolean {
  return (
    typeof value === 'function' &&
    Function.prototype.toString.call(value).startsWith('class')
  );
}

export interface ParamInfo {
  name: string;
  /** True when the parameter has a `= default` or is optional (`?`). */
  hasDefault: boolean;
}

/** Extract parameter metadata from a class constructor, method, or arrow function. */
export function paramNamesOf(fn: Function): ParamInfo[] {
  const source = Function.prototype.toString.call(fn);

  let body: string;
  if (isClass(fn)) {
    const match = source.match(/constructor\s*\(([\s\S]*?)\)/);
    body = match ? match[1] : '';
  } else {
    const methodMatch = source.match(/^(?:async\s+)?\w+\s*\(([\s\S]*?)\)/);
    const arrowMatch = source.match(/\(([\s\S]*?)\)\s*(?:=>|:\s*\w+\s*=>)/);
    body = methodMatch ? methodMatch[1] : arrowMatch ? arrowMatch[1] : '';
  }
  return parseParamList(body);
}

function parseParamList(body: string): ParamInfo[] {
  if (!body.trim()) return [];
  return body.split(',').map((raw) => {
    let param = raw.trim();
    // Strip decorators, e.g. @inject('cache') name
    param = param.replace(/^@\w+(?:\([\s\S]*?\))?\s*/, '').trim();
    // Strip TS parameter modifiers (erased at runtime but harmless to guard).
    param = param.replace(/^(?:public|private|protected|readonly)\s+/, '');

    // Destructured parameters cannot be name-resolved — keep the position but
    // mark as defaulted so the container passes `undefined` (never throws).
    if (param.startsWith('{') || param.startsWith('[')) {
      return { name: '', hasDefault: true };
    }

    const hasDefault = /[?=]/.test(param);
    // Keep the identifier before any `: type`, `= default`, or `?` marker.
    const name = param.split(/[=:?]/)[0].trim();
    return { name, hasDefault };
  });
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
