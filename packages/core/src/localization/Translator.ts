import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Laravel's Translator, ported. Loads translation files from `lang/` and
 * resolves dot-notated keys with optional placeholder interpolation.
 *
 *   import { __ } from '../src/localization/Translator';
 *   __('auth.failed'); // "These credentials do not match our records."
 *   __('welcome.name', { name: 'John' }); // "Hello, John!"
 */

interface LangConfig {
  locale: string;
  fallback_locale: string;
  paths: string[];
}

let config: LangConfig = {
  locale: 'en',
  fallback_locale: 'en',
  paths: ['lang'],
};

const loaded = new Map<string, Record<string, string | Record<string, unknown>>>();
let loadedAll = false;

/** Reconfigure the translator (called by the service provider). */
export function configureTranslator(cfg: LangConfig): void {
  config = cfg;
  loaded.clear();
  loadedAll = false;
}

/** Get the current locale. */
export function getLocale(): string {
  return config.locale;
}

/** Set the current locale. */
export function setLocale(locale: string): void {
  config.locale = locale;
}

/** Get the fallback locale. */
export function getFallbackLocale(): string {
  return config.fallback_locale;
}

/** Set the fallback locale. */
export function setFallbackLocale(locale: string): void {
  config.fallback_locale = locale;
}

async function loadFile(locale: string): Promise<Record<string, string | Record<string, unknown>>> {
  if (loaded.has(locale)) return loaded.get(locale)!;

  const messages: Record<string, string | Record<string, unknown>> = {};

  for (const dir of config.paths) {
    const filePath = path.resolve(dir, `${locale}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;
      Object.assign(messages, parsed);
    } catch {
      // File doesn't exist — skip
    }
  }

  loaded.set(locale, messages);
  return messages;
}

function getNestedValue(
  obj: Record<string, unknown>,
  key: string,
): string | Record<string, unknown> | undefined {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current === 'string') return current;
  if (typeof current === 'object' && current !== null) {
    return current as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Translate a key, with optional placeholder interpolation.
 *
 *   __('auth.failed')
 *   __('welcome', { name: 'John' })
 *   __('messages.items', { count: 5 })
 */
export async function __(
  key: string,
  replacements: Record<string, string | number> = {},
  locale?: string,
): Promise<string> {
  const loc = locale ?? config.locale;
  const fallback = config.fallback_locale;

  // Try the requested locale first
  let messages = await loadFile(loc);
  let value = getNestedValue(messages, key);

  // Fall back to the fallback locale
  if (value === undefined && loc !== fallback) {
    messages = await loadFile(fallback);
    value = getNestedValue(messages, key);
  }

  // If still not found, return the key itself (like Laravel)
  if (value === undefined) return key;

  const str = typeof value === 'string' ? value : JSON.stringify(value);

  // Replace :placeholders
  return str.replace(/:(\w+)/g, (_, name) =>
    replacements[name] !== undefined ? String(replacements[name]) : `:${name}`,
  );
}

/**
 * Shorthand for `__()` — identical behavior.
 */
export const trans =__;
