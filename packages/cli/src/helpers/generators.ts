import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Shared helpers for the `make:*` generators — the single home for the file
 * writing and naming utilities that used to be copy-pasted across make.ts /
 * make-more.ts / make-more2.ts.
 *
 *   write(join(cwd, 'app', 'Models', `${name}.ts`), MODEL_STUB(name));
 */

/** Create the parent directory, write a file, and report it (Artisan style). */
export function write(filePath: string, content: string): void {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
  console.log(`  > Created: ${filePath.replaceAll('\\', '/')}`);
}

/** `post_tag` / `PostTag` / `post tag` → `PostTag`. */
export function pascal(name: string): string {
  return name
    .split(/[_\-\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** `PostTag` → `post_tag`. */
export function snake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/** `category` → `categories`, `box` → `boxes`, `user` → `users`. */
export function pluralize(value: string): string {
  if (value.endsWith('y') && !'aeiou'.includes(value[value.length - 2])) return `${value.slice(0, -1)}ies`;
  if (value.endsWith('s') || value.endsWith('x') || value.endsWith('z') || value.endsWith('ch') || value.endsWith('sh')) {
    return `${value}es`;
  }
  return `${value}s`;
}

/**
 * Class names keep a trailing suffix (Artisan: `make:job SendEmail` →
 * SendEmailJob). Pascal-cases the base and appends the suffix if missing.
 * The strip is case-insensitive, so `make:controller post_controller`
 * resolves to `PostController` — never `PostControllerController`.
 */
export function classWithSuffix(name: string, suffix: string): string {
  const base = name.toLowerCase().endsWith(suffix.toLowerCase()) ? name.slice(0, -suffix.length) : name;
  return pascal(base) + suffix;
}

/** `2026_02_03_120000`-style timestamp for migration file names. */
export function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
