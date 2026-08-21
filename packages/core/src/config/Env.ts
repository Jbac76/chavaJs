import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';

/**
 * Laravel's env() helper. `Env.load()` is called during bootstrap and reads
 * `.env` into `process.env`; `Env.get()` reads from there.
 */
export const Env = {
  /** Load dotenv files (default `.env`) into process.env without overriding. */
  load(paths: string[] = ['.env']): void {
    for (const path of paths) {
      if (existsSync(path)) loadDotenv({ path, override: false });
    }
  },

  get(key: string, fallback?: string): string | undefined {
    return process.env[key] ?? fallback;
  },

  has(key: string): boolean {
    return process.env[key] !== undefined;
  },

  bool(key: string, fallback = false): boolean {
    const value = process.env[key];
    if (value === undefined) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  },

  number(key: string, fallback?: number): number | undefined {
    const value = process.env[key];
    if (value === undefined) return fallback;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  },
};
