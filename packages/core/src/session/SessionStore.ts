import { randomBytes, randomUUID } from 'node:crypto';
import type { SessionHandler } from './handlers';

const FLASH_KEY = '_flash';
const OLD_INPUT_KEY = '_old_input';
const PREVIOUS_URL_KEY = '_previous_url';
const TOKEN_KEY = '_token';
const LAST_ACTIVITY_KEY = '_last_activity';

interface FlashData {
  new: string[];
  old: string[];
}

/**
 * Laravel's session Store, ported:
 *
 *   store.get('key'), store.put('key', value), store.flash('status', 'Saved!')
 *   store.token()              — CSRF token (generated lazily)
 *   store.regenerate()         — new session id (Laravel does this on login)
 *   store.old('email')         — previously submitted input
 *
 * Flash data lives for exactly one more request: `flash()` keys are
 * available on the *next* request, then aged out on save().
 */
export class SessionStore {
  private data: Record<string, unknown> = {};
  /** Idle lifetime in minutes; 0 disables expiry (Laravel: session.lifetime). */
  private lifetimeMinutes = 0;
  private expiredFlag = false;

  private constructor(
    private id: string,
    private readonly handler: SessionHandler,
  ) {}

  public static create(id: string, handler: SessionHandler): SessionStore {
    return new SessionStore(id, handler);
  }

  public static newId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Set the idle lifetime (minutes) before load(). Stale sessions — including
   * ones an attacker replays with an old cookie — are destroyed server-side.
   * 0 (default) keeps pre-hardening behavior of cookie-only expiry.
   */
  public configure(lifetimeMinutes: number): void {
    this.lifetimeMinutes = Number.isFinite(lifetimeMinutes) && lifetimeMinutes > 0 ? lifetimeMinutes : 0;
  }

  /** Whether load() found and rejected a stale session. */
  public wasExpired(): boolean {
    return this.expiredFlag;
  }

  // ------------------------------------------------------------ lifecycle

  public getId(): string {
    return this.id;
  }

  /** Load session data from the handler and age flash data (Laravel start()). */
  public load(): void {
    const saved = this.handler.read(this.id);
    this.data = saved ?? {};

    // Server-side idle-timeout check: a stored payload older than the
    // configured lifetime is destroyed, never resurrected.
    if (this.isExpired()) {
      this.expiredFlag = true;
      this.handler.destroy(this.id);
      this.data = {};
    }

    // Aging happens on load: keys flashed last request were moved to `old`
    // and are forgotten now — they were readable for exactly one request.
    this.ageFlashData();
  }

  /** Persist the session, stamping last activity for the expiry check. */
  public save(): void {
    if (this.lifetimeMinutes > 0) {
      this.data[LAST_ACTIVITY_KEY] = Date.now();
    }
    this.handler.write(this.id, this.data);
  }

  /** Forget the stored payload (Laravel: $session->invalidate()). */
  public invalidate(): void {
    this.handler.destroy(this.id);
    this.data = {};
  }

  public regenerate(): void {
    this.id = SessionStore.newId();
  }

  /**
   * Laravel's $session->migrate($destroy = false, $regenerate = true):
   * regenerate the session id, and optionally the CSRF token too. Used on
   * login/logout to prevent session fixation (Laravel's guard calls this
   * with `true`).
   */
  public migrate(regenerateToken = true): void {
    this.regenerate();
    if (regenerateToken) this.regenerateToken();
  }

  // ------------------------------------------------------------- accessors

  public get<T = unknown>(key: string, fallback?: T): T {
    const value = this.data[key];
    return (value === undefined ? fallback : value) as T;
  }

  public put(key: string, value: unknown): void {
    this.data[key] = value;
  }

  public push(key: string, value: unknown): void {
    const existing = this.data[key];
    if (Array.isArray(existing)) existing.push(value);
    else this.data[key] = [value];
  }

  public pull<T = unknown>(key: string, fallback?: T): T {
    const value = this.get<T>(key, fallback);
    this.forget(key);
    return value;
  }

  public forget(...keys: string[]): void {
    for (const key of keys) delete this.data[key];
  }

  public flush(): void {
    this.data = {};
  }

  public has(key: string): boolean {
    return key in this.data;
  }

  public all(): Record<string, unknown> {
    return { ...this.data };
  }

  // ---------------------------------------------------------------- flash

  /** Flash a value for the *next* request (Laravel: ->flash()). */
  public flash(key: string, value: unknown): void {
    this.put(key, value);
    const flash = this.flashData();
    flash.new.push(key);
    this.data[FLASH_KEY] = flash;
  }

  /** Flash a value for only the *current* request (Laravel: ->now()). */
  public now(key: string, value: unknown): void {
    this.put(key, value);
    const flash = this.flashData();
    flash.old.push(key);
    this.data[FLASH_KEY] = flash;
  }

  /** Keep the current flash data for one more request (Laravel: ->reflash()). */
  public reflash(): void {
    const flash = this.flashData();
    flash.new = [...flash.old, ...flash.new];
    flash.old = [];
    this.data[FLASH_KEY] = flash;
  }

  /** Keep only the given keys flashed (Laravel: ->keep([...])). */
  public keep(...keys: string[]): void {
    const flash = this.flashData();
    flash.new = [...flash.old.filter((key) => keys.includes(key)), ...flash.new];
    flash.old = [];
    this.data[FLASH_KEY] = flash;
  }

  /** Previously submitted input (Laravel: old('email')). */
  public old(key: string, fallback?: unknown): unknown {
    const input = this.data[OLD_INPUT_KEY];
    if (input !== null && typeof input === 'object' && key in (input as Record<string, unknown>)) {
      return (input as Record<string, unknown>)[key];
    }
    return fallback;
  }

  /** Store the request input for the next request (Laravel: ->flashInput()). */
  public flashInput(input: Record<string, unknown>): void {
    this.flash(OLD_INPUT_KEY, input);
  }

  public previousUrl(): string | undefined {
    const value = this.data[PREVIOUS_URL_KEY];
    return typeof value === 'string' ? value : undefined;
  }

  public setPreviousUrl(url: string): void {
    this.data[PREVIOUS_URL_KEY] = url;
  }

  // ---------------------------------------------------------------- token

  /** The CSRF token for this session (generated on first access). */
  public token(): string {
    const existing = this.data[TOKEN_KEY];
    if (typeof existing === 'string') return existing;
    const token = randomUUID().replaceAll('-', '');
    this.put(TOKEN_KEY, token);
    return token;
  }

  public regenerateToken(): void {
    this.put(TOKEN_KEY, randomUUID().replaceAll('-', ''));
  }

  // ------------------------------------------------------------- internals

  private flashData(): FlashData {
    const existing = this.data[FLASH_KEY];
    if (existing !== null && typeof existing === 'object') {
      const flash = existing as FlashData;
      return { new: Array.isArray(flash.new) ? flash.new : [], old: Array.isArray(flash.old) ? flash.old : [] };
    }
    return { new: [], old: [] };
  }

  /** Laravel's ageFlashData(): drop old flash keys, shift new → old. */
  private ageFlashData(): void {
    const flash = this.flashData();
    for (const key of flash.old) delete this.data[key];
    this.data[FLASH_KEY] = { new: [], old: flash.new };
  }

  /** True when the stored `_last_activity` is older than the idle lifetime. */
  private isExpired(): boolean {
    if (this.lifetimeMinutes <= 0) return false;
    const last = this.data[LAST_ACTIVITY_KEY];
    if (typeof last !== 'number') return false; // no stamp yet — fresh/legacy
    return Date.now() - last > this.lifetimeMinutes * 60_000;
  }
}
