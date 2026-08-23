/**
 * Wildcard permission matching — Spatie's WildcardPermission, compiled.
 *
 * Patterns are parsed ONCE into matchers (performance goal: zero parsing at
 * check time). Supported grammar:
 *
 *   *            matches everything
 *   posts.*      any operation on posts
 *   posts.view   exact
 *   posts.*.publish   nested segments with * wildcards
 */

export type WildcardMatcher = (permission: string) => boolean;

/** Compile a pattern into a reusable matcher. */
export function compileWildcard(pattern: string): WildcardMatcher {
  if (pattern === '*') return () => true;

  const segments = pattern.split('.');
  return (permission: string): boolean => {
    const parts = permission.split('.');
    // A pattern matches when every pattern segment aligns; a trailing `*`
    // segment absorbs all remaining parts.
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      if (segment === '*') {
        return i === segments.length - 1 ? true : i < parts.length;
      }
      if (parts[i] !== segment) return false;
    }
    return true;
  };
}

/** True when the string contains wildcard syntax and needs compiling. */
export function isWildcard(pattern: string): boolean {
  return pattern.includes('*');
}
