import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import { SessionStore } from './SessionStore';
import { ArraySessionHandler, FileSessionHandler, type SessionHandler } from './handlers';

/**
 * Laravel's SessionManager — resolves the configured driver and builds
 * SessionStore instances. The `session` singleton backs request sessions:
 *
 *   const store = app.make<SessionManager>('session').store();
 *   store.put('key', value);
 *
 * The handler instance is cached so in-memory drivers (array) keep their
 * state across requests within the same process.
 */
export class SessionManager {
  private cachedHandler: SessionHandler | null = null;

  public constructor(private readonly app: Application) {}

  /** The driver configured in config/session.ts ('file' | 'array'). */
  public driver(): SessionHandler {
    if (this.cachedHandler) return this.cachedHandler;
    const driver = this.app.make<Config>('config').get<string>('session.driver', 'file');
    if (driver === 'array') {
      this.cachedHandler = new ArraySessionHandler();
      return this.cachedHandler;
    }
    const files = this.app.make<Config>('config').get<string>('session.files', 'storage/framework/sessions');
    this.cachedHandler = new FileSessionHandler(this.app.storagePath(...files.split('/')));
    return this.cachedHandler;
  }

  /** Build a session store (fresh id when none provided). */
  public store(id?: string): SessionStore {
    return SessionStore.create(id ?? SessionStore.newId(), this.driver());
  }
}
