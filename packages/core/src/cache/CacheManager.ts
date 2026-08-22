/**
 * Cache Manager
 *
 * Provides a unified caching interface with multiple backend drivers:
 * - Memory: In-memory cache (default, single-instance only)
 * - Redis: Distributed cache (requires ioredis package)
 *
 * Usage:
 *   const cache = new CacheManager();
 *   await cache.put('key', 'value', 60); // TTL in seconds
 *   const value = await cache.get('key');
 */

export interface CacheDriver {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T, ttl: number): Promise<void>;
  forget(key: string): Promise<void>;
  flush(): Promise<void>;
  has(key: string): Promise<boolean>;
  increment(key: string, value?: number): Promise<number>;
  decrement(key: string, value?: number): Promise<number>;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache driver
 * Suitable for single-instance deployments
 */
export class MemoryCacheDriver implements CacheDriver {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: NodeJS.Timeout;
  /** TTL (seconds) applied by increment/decrement when re-putting counters. */
  public defaultTtl = 3600;

  constructor() {
    // Clean up expired entries every 60 seconds. unref'd so a live cache can
    // never keep the process alive on shutdown.
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    this.cleanupInterval.unref();
  }

  /**
   * Stop the cleanup timer and drop all entries. Call on application
   * shutdown — prevents timer leaks across hot reloads / test runs.
   */
  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  /** Alias of destroy() kept for backward compatibility. */
  public stopCleanup(): void {
    this.destroy();
  }

  public async get<T = unknown>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value as T;
  }

  public async put<T = unknown>(key: string, value: T, ttl: number): Promise<void> {
    const expiresAt = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiresAt });
  }

  public async forget(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async flush(): Promise<void> {
    this.store.clear();
  }

  public async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== undefined;
  }

  public async increment(key: string, value = 1): Promise<number> {
    const current = await this.get<number>(key);
    const newValue = (current || 0) + value;
    await this.put(key, newValue, this.defaultTtl);
    return newValue;
  }

  public async decrement(key: string, value = 1): Promise<number> {
    return this.increment(key, -value);
  }

  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.expiresAt) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.store.delete(key);
    }
  }
}

/**
 * Redis cache driver
 * Suitable for multi-instance deployments
 *
 * Requires: npm install ioredis
 */
export class RedisCacheDriver implements CacheDriver {
  private redis: any;

  constructor(options: { host?: string; port?: number; password?: string } = {}) {
    try {
      // Dynamically import ioredis (optional dependency)
      const Redis = require('ioredis');

      this.redis = new Redis({
        host: options.host || process.env.REDIS_HOST || '127.0.0.1',
        port: options.port || Number(process.env.REDIS_PORT) || 6379,
        password: options.password || process.env.REDIS_PASSWORD,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });
    } catch (error) {
      throw new Error(
        'Redis cache driver requires "ioredis" package. Install with: npm install ioredis'
      );
    }
  }

  public async get<T = unknown>(key: string): Promise<T | undefined> {
    const value = await this.redis.get(key);

    if (!value) {
      return undefined;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  public async put<T = unknown>(key: string, value: T, ttl: number): Promise<void> {
    const serialized = JSON.stringify(value);
    await this.redis.setex(key, ttl, serialized);
  }

  public async forget(key: string): Promise<void> {
    await this.redis.del(key);
  }

  public async flush(): Promise<void> {
    await this.redis.flushdb();
  }

  public async has(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  public async increment(key: string, value = 1): Promise<number> {
    return await this.redis.incrby(key, value);
  }

  public async decrement(key: string, value = 1): Promise<number> {
    return await this.redis.decrby(key, value);
  }

  public async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * Cache Manager
 *
 * Main cache interface with helper methods
 */
export class CacheManager {
  private driver: CacheDriver;

  constructor(driver?: CacheDriver) {
    if (driver) {
      this.driver = driver;
    } else {
      // Default to memory driver
      this.driver = new MemoryCacheDriver();
    }
  }

  /**
   * Configure the TTL (seconds) used by increment/decrement counters
   * (review: hardcoded 1h caused premature rate-limit resets).
   */
  public setDefaultTtl(seconds: number): this {
    const driver = this.driver as { defaultTtl?: number };
    if (typeof driver.defaultTtl === 'number') {
      driver.defaultTtl = seconds;
    }
    return this;
  }

  /**
   * Tear down the underlying driver (stops timers, closes connections).
   * Called from Application.shutdown().
   */
  public async destroy(): Promise<void> {
    const driver = this.driver as Partial<MemoryCacheDriver & RedisCacheDriver>;
    if (typeof driver.destroy === 'function') driver.destroy();
    if (typeof driver.disconnect === 'function') await driver.disconnect();
  }

  /**
   * Retrieve an item from the cache
   */
  public async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.driver.get<T>(key);
  }

  /**
   * Store an item in the cache
   */
  public async put<T = unknown>(key: string, value: T, ttl: number): Promise<void> {
    return this.driver.put(key, value, ttl);
  }

  /**
   * Store an item in the cache indefinitely (with very long TTL)
   */
  public async forever<T = unknown>(key: string, value: T): Promise<void> {
    return this.driver.put(key, value, 31536000); // 1 year
  }

  /**
   * Get an item from the cache, or execute callback and store result
   */
  public async remember<T = unknown>(
    key: string,
    ttl: number,
    callback: () => Promise<T> | T
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== undefined) {
      return cached;
    }

    const value = await callback();
    await this.put(key, value, ttl);
    return value;
  }

  /**
   * Get an item from the cache, or execute callback and store result indefinitely
   */
  public async rememberForever<T = unknown>(
    key: string,
    callback: () => Promise<T> | T
  ): Promise<T> {
    return this.remember(key, 31536000, callback);
  }

  /**
   * Retrieve an item and delete it
   */
  public async pull<T = unknown>(key: string): Promise<T | undefined> {
    const value = await this.get<T>(key);
    await this.forget(key);
    return value;
  }

  /**
   * Remove an item from the cache
   */
  public async forget(key: string): Promise<void> {
    return this.driver.forget(key);
  }

  /**
   * Remove all items from the cache
   */
  public async flush(): Promise<void> {
    return this.driver.flush();
  }

  /**
   * Determine if an item exists in the cache
   */
  public async has(key: string): Promise<boolean> {
    return this.driver.has(key);
  }

  /**
   * Increment the value of an item in the cache
   */
  public async increment(key: string, value = 1): Promise<number> {
    return this.driver.increment(key, value);
  }

  /**
   * Decrement the value of an item in the cache
   */
  public async decrement(key: string, value = 1): Promise<number> {
    return this.driver.decrement(key, value);
  }

  /**
   * Get multiple items from the cache
   */
  public async many<T = unknown>(keys: string[]): Promise<Record<string, T | undefined>> {
    const result: Record<string, T | undefined> = {};

    for (const key of keys) {
      result[key] = await this.get<T>(key);
    }

    return result;
  }

  /**
   * Store multiple items in the cache
   */
  public async putMany(items: Record<string, unknown>, ttl: number): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      await this.put(key, value, ttl);
    }
  }
}

// Singleton instance
let cacheInstance: CacheManager | null = null;

/**
 * Get the cache manager instance
 */
export function cache(): CacheManager {
  if (!cacheInstance) {
    // Determine driver from environment
    const driver = process.env.CACHE_DRIVER || 'memory';

    if (driver === 'redis') {
      try {
        cacheInstance = new CacheManager(new RedisCacheDriver());
      } catch (error) {
        console.warn('Failed to initialize Redis cache, falling back to memory:', error);
        cacheInstance = new CacheManager(new MemoryCacheDriver());
      }
    } else {
      cacheInstance = new CacheManager(new MemoryCacheDriver());
    }
  }

  return cacheInstance;
}

/**
 * Reset cache instance (useful for testing)
 */
export function resetCache(): void {
  cacheInstance = null;
}
