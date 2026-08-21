import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import type { Model } from '../orm/Model';
import { currentRequest } from '../foundation/request-context';
import { EloquentUserProvider, type UserProvider } from './UserProvider';
import { SessionGuard } from './SessionGuard';
import { TokenGuard } from './TokenGuard';

export type Guard = SessionGuard | TokenGuard;

/**
 * Laravel's AuthManager — resolves the configured guard for the current
 * request (config/auth.ts), caching it per request so `Auth.user()` is cheap.
 *
 *   const auth = app.make<AuthManager>('auth');
 *   await auth.check();          // guard 'web'
 *   await auth.guard('api').user();
 */
export class AuthManager {
  private readonly guardsByRequest = new WeakMap<object, Map<string, Guard>>();
  private readonly defaultGuard: string;

  public constructor(private readonly app: Application) {
    this.defaultGuard = this.app.make<Config>('config').get('auth.defaults.guard', 'web');
  }

  public guard(name?: string): Guard {
    const guardName = name ?? this.defaultGuard;
    const request = currentRequest();
    if (request) {
      let cache = this.guardsByRequest.get(request);
      if (!cache) {
        cache = new Map();
        this.guardsByRequest.set(request, cache);
      }
      let guard = cache.get(guardName);
      if (!guard) {
        guard = this.resolve(guardName);
        cache.set(guardName, guard);
      }
      return guard;
    }
    return this.resolve(guardName);
  }

  public async user(guard?: string): Promise<Model | null> {
    return this.guard(guard).user();
  }

  public async check(guard?: string): Promise<boolean> {
    return this.guard(guard).check();
  }

  public async guest(guard?: string): Promise<boolean> {
    return !(await this.check(guard));
  }

  public async id(guard?: string): Promise<unknown> {
    return this.guard(guard).id();
  }

  public async login(user: Model, guard?: string): Promise<void> {
    const resolved = this.guard(guard);
    if (resolved instanceof SessionGuard) resolved.login(user);
  }

  public async logout(guard?: string): Promise<void> {
    this.guard(guard).logout();
  }

  public async attempt(credentials: Record<string, unknown>, guard?: string): Promise<boolean> {
    const resolved = this.guard(guard);
    if (resolved instanceof SessionGuard) return resolved.attempt(credentials);
    return false;
  }

  // ------------------------------------------------------------- internals

  private resolve(name: string): Guard {
    const config = this.app.make<Config>('config');
    const guardConfig = config.get<Record<string, unknown>>(`auth.guards.${name}`, {});
    const driver = typeof guardConfig.driver === 'string' ? guardConfig.driver : 'session';
    const providerName = typeof guardConfig.provider === 'string' ? guardConfig.provider : 'users';
    const providerConfig = config.get<Record<string, unknown>>(`auth.providers.${providerName}`, {});
    const model = providerConfig.model as never;

    if (driver === 'token') {
      const tokenModel = guardConfig.token_model ?? providerConfig.model;
      const userRelation = typeof guardConfig.user_relation === 'string' ? guardConfig.user_relation : 'user';
      return new TokenGuard(tokenModel as never, userRelation);
    }

    const provider: UserProvider = new EloquentUserProvider(model);
    return new SessionGuard(name, provider);
  }
}
