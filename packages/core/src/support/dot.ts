const NOT_FOUND = Symbol('chava.not-found');

/**
 * Read a value from a nested object using dot notation ("app.name").
 * Returns `fallback` when any segment of the path is missing.
 */
export function getPath(
  source: unknown,
  path: string,
  fallback?: unknown,
): unknown {
  if (!path) return source;
  const segments = path.split('.');
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || current === undefined) return fallback;
    if (typeof current !== 'object') return fallback;
    if (!(segment in current)) return fallback;
    current = (current as Record<string, unknown>)[segment];
  }
  return current === undefined ? fallback : current;
}

/** Whether a dot-notation path resolves to a defined value. */
export function hasPath(source: unknown, path: string): boolean {
  return getPath(source, path, NOT_FOUND) !== NOT_FOUND;
}

/** Merge nested objects (deep merge for plain records, shallow otherwise). */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (
      isPlainRecord(existing) &&
      isPlainRecord(value)
    ) {
      target[key] = deepMerge({ ...existing }, value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
