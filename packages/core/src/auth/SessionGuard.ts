import { createHash } from 'node:crypto';
import type { Model } from '../orm/Model';
import { currentRequest } from '../foundation/request-context';
import type { SessionStore } from '../session/SessionStore';
import type { UserProvider } from './UserProvider';

/**
 * Laravel's SessionGuard — authenticates against the session-backed user id:
 *
 *   guard.check(), guard.user(), guard.id(), guard.attempt(credentials),
 *   guard.login(user), guard.logout()
 */
export class SessionGuard {
  private userCache: Model | null = null;
  private loggedOut = false;

  public constructor(
    private readonly name: string,
    private readonly provider: UserProvider,
  ) {}

  public async user(): Promise<Model | null> {
    if (this.loggedOut) return null;
    if (this.userCache) return this.userCache;

    const id = this.session()?.get(this.sessionKey());
    if (id === null || id === undefined) return null;

    const user = await this.provider.retrieveById(id);
    this.userCache = user;
    return user;
  }

  public async check(): Promise<boolean> {
    return (await this.user()) !== null;
  }

  public async guest(): Promise<boolean> {
    return !(await this.check());
  }

  public async id(): Promise<unknown> {
    const user = await this.user();
    return user?.getKey() ?? null;
  }

  public setUser(user: Model): void {
    this.userCache = user;
    this.loggedOut = false;
  }

  /** Log the user in and store their key in the session. Laravel migrates
   *  the session id AND CSRF token on login to prevent session fixation. */
  public login(user: Model): void {
    this.userCache = user;
    this.loggedOut = false;
    const session = this.session();
    session?.put(this.sessionKey(), user.getKey());
    session?.migrate(true);
  }

  public async attempt(credentials: Record<string, unknown>): Promise<boolean> {
    const user = await this.provider.retrieveByCredentials(credentials);
    if (!user) return false;
    if (!(await this.provider.validateCredentials(user, credentials))) return false;
    this.login(user);
    return true;
  }

  public logout(): void {
    this.userCache = null;
    this.loggedOut = true;
    const session = this.session();
    session?.forget(this.sessionKey());
    session?.migrate(true);
  }

  // ------------------------------------------------------------- internals

  private session(): SessionStore | undefined {
    return currentRequest()?.session();
  }

  /** Laravel: login_<guard>_<sha1(guard name)>. */
  private sessionKey(): string {
    return `login_${this.name}_${createHash('sha1').update(this.name).digest('hex').slice(0, 8)}`;
  }
}
