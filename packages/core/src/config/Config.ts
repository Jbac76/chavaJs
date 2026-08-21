import { deepMerge, getPath } from '../support/dot';

/**
 * Laravel's Config repository: holds every `config/*` file keyed by filename
 * and exposes dot-notation access — `config.get('app.name')`.
 */
export class Config {
  private readonly items: Record<string, unknown> = {};

  public set(key: string, value: unknown): this {
    this.items[key] = value;
    return this;
  }

  public load(values: Record<string, unknown>): this {
    deepMerge(this.items, values);
    return this;
  }

  public get<T = unknown>(key: string, fallback?: T): T {
    return getPath(this.items, key, fallback) as T;
  }

  public has(key: string): boolean {
    return getPath(this.items, key, undefined) !== undefined;
  }

  public all(): Record<string, unknown> {
    return { ...this.items };
  }
}
