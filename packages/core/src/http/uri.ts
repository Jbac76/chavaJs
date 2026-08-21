/** Join two URI prefixes, collapsing duplicate slashes. Root is `/`. */
export function joinPrefix(...parts: Array<string | undefined>): string {
  const joined = parts
    .filter((part): part is string => Boolean(part))
    .flatMap((part) => part.split('/'))
    .filter(Boolean)
    .join('/');
  return joined ? `/${joined}` : '/';
}

/** Normalize a request path for matching: ensure leading slash, drop trailing slash. */
export function normalizePath(path: string): string {
  let normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/** Very small English singularizer used to derive resource parameter names. */
export function singularize(value: string): string {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('ses') || value.endsWith('xes') || value.endsWith('zes') || value.endsWith('ches') || value.endsWith('shes')) {
    return value.slice(0, -2);
  }
  if (value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1);
  return value;
}
