import { ServiceProvider } from '../container/ServiceProvider';
import { SessionManager } from '../session/SessionManager';

/** Binds the `session` manager that backs request sessions. */
export class SessionServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('session', () => new SessionManager(this.app));
    this.app.alias('Session', 'session');
  }
}
