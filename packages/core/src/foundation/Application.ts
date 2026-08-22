import { existsSync, readdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Container } from '../container/Container';
import { ServiceProvider } from '../container/ServiceProvider';
import { Config } from '../config/Config';
import { Env } from '../config/Env';
import { HttpKernel } from '../http/Kernel';
import type { MiddlewareEntry } from '../http/types';
import { ConfigServiceProvider } from '../providers/ConfigServiceProvider';
import { DatabaseServiceProvider } from '../providers/DatabaseServiceProvider';
import { InertiaServiceProvider } from '../providers/InertiaServiceProvider';
import { RoutingServiceProvider } from '../providers/RoutingServiceProvider';
import { SessionServiceProvider } from '../providers/SessionServiceProvider';
import { AuthServiceProvider } from '../providers/AuthServiceProvider';
import { EventServiceProvider } from '../providers/EventServiceProvider';
import { QueueServiceProvider } from '../providers/QueueServiceProvider';
import { MailServiceProvider } from '../providers/MailServiceProvider';
import { NotificationServiceProvider } from '../providers/NotificationServiceProvider';
import { ScheduleServiceProvider } from '../providers/ScheduleServiceProvider';
import { setCurrentApp } from './registry';

export interface ApplicationConfig {
  /** Display name of the application. */
  name?: string;
  /** Application service providers (framework providers are registered first). */
  providers?: Array<new (app: Application) => ServiceProvider>;
  /** Middleware run on every request. */
  globalMiddleware?: MiddlewareEntry[];
  /** Members of the `web` middleware group. */
  webMiddleware?: MiddlewareEntry[];
  /** Members of the `api` middleware group. */
  apiMiddleware?: MiddlewareEntry[];
  /** Override the base path (defaults to process.cwd()). */
  basePath?: string;
}

/**
 * The chavaJs application — the equivalent of Laravel's `bootstrap/app.php`:
 *
 *   export const app = Application.configure({
 *     providers: [AppServiceProvider, RouteServiceProvider],
 *     webMiddleware: [HandleInertiaRequests],
 *   });
 *
 * Lifecycle (mirrors Laravel):
 *   bootstrap() → load .env → load config/* → register providers → boot providers
 */
export class Application {
  public static readonly version = '0.0.3';

  private readonly container: Container;
  private readonly configData: ApplicationConfig;
  private readonly basePath: string;
  private readonly registeredProviders: ServiceProvider[] = [];
  private booted = false;

  public constructor(config: ApplicationConfig = {}) {
    this.configData = config;
    this.basePath = config.basePath ? resolve(config.basePath) : resolve(process.cwd());
    this.container = new Container();
    this.container.instance('app', this);
    this.container.instance('container', this.container);
    setCurrentApp(this);
  }

  public static configure(config: ApplicationConfig = {}): Application {
    return new Application(config);
  }

  public get version(): string {
    return Application.version;
  }

  // ------------------------------------------------------------- lifecycle

  /** Boot the application: env → config → register providers → boot providers. */
  public async bootstrap(): Promise<this> {
    if (this.booted) return this;
    Env.load([resolve(this.basePath, '.env')]);
    await this.loadConfigFiles();

    // Validate APP_KEY in production — fail fast rather than silently
    // generating a per-process random key that invalidates sessions on restart.
    const config = this.make<Config>('config');
    const appKey = config.get<string>('app.key', '');
    const nodeEnv = process.env.NODE_ENV ?? config.get<string>('app.env', 'development');
    if (nodeEnv === 'production' && (!appKey || appKey.length < 32)) {
      throw new Error(
        'APP_KEY must be set to a secure random string (>= 32 characters) in production. ' +
        'Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64url\'))"',
      );
    }

    this.registerProviders([
      ConfigServiceProvider,
      RoutingServiceProvider,
      DatabaseServiceProvider,
      SessionServiceProvider,
      AuthServiceProvider,
      EventServiceProvider,
      QueueServiceProvider,
      MailServiceProvider,
      NotificationServiceProvider,
      ScheduleServiceProvider,
      InertiaServiceProvider,
    ]);
    this.registerProviders(this.configData.providers ?? []);
    await this.bootProviders();
    this.booted = true;
    return this;
  }

  // ------------------------------------------------------------ container

  public make<T = unknown>(abstract: unknown, overrides?: Record<string, unknown>): T {
    return this.container.make<T>(abstract, overrides);
  }

  public get<T = unknown>(abstract: unknown): T {
    return this.container.make<T>(abstract);
  }

  public bind(abstract: unknown, concrete: unknown, singleton = false): this {
    this.container.bind(abstract, concrete, singleton);
    return this;
  }

  public singleton(abstract: unknown, concrete: unknown): this {
    this.container.singleton(abstract, concrete);
    return this;
  }

  public instance(abstract: unknown, value: unknown): this {
    this.container.instance(abstract, value);
    return this;
  }

  public alias(alias: unknown, abstract: unknown): this {
    this.container.alias(alias, abstract);
    return this;
  }

  /** Contextual bindings (Laravel: $this->app->when(X)->needs('y')->give(z)). */
  public when(concrete: unknown): import('../container/Container').ContextualBindingBuilder {
    return this.container.when(concrete);
  }

  public call<T = unknown>(target: unknown, method: string | null = null, params: Record<string, unknown> = {}): T {
    return this.container.call<T>(target, method, params);
  }

  // -------------------------------------------------------------- settings

  public name(): string {
    return this.configData.name ?? this.make<Config>('config').get('app.name', 'chavaJs');
  }

  public environment(): string {
    return this.make<Config>('config').get('app.env', 'production');
  }

  public isLocal(): boolean {
    return this.environment() === 'local';
  }

  public isProduction(): boolean {
    return this.environment() === 'production';
  }

  public isDebug(): boolean {
    return this.make<Config>('config').get('app.debug', false);
  }

  public getGlobalMiddleware(): MiddlewareEntry[] {
    return this.configData.globalMiddleware ?? [];
  }

  public getWebMiddleware(): MiddlewareEntry[] {
    return this.configData.webMiddleware ?? [];
  }

  public getApiMiddleware(): MiddlewareEntry[] {
    return this.configData.apiMiddleware ?? [];
  }

  // --------------------------------------------------------------- serving

  /** Boot the HTTP kernel and start listening. Returns the node server. */
  public async serve(port: number, host = '127.0.0.1'): Promise<Server> {
    await this.bootstrap();
    const kernel = new HttpKernel(this);
    const server = createServer((req, res) => {
      kernel.handle(req, res).catch((error: unknown) => {
        console.error(error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ message: 'Internal Server Error' }));
        } else {
          res.end();
        }
      });
    });

    await new Promise<void>((resolveListen, rejectListen) => {
      const onError = (error: Error): void => {
        server.removeListener('listening', resolveListen);
        rejectListen(error);
      };
      server.once('error', onError);
      server.once('listening', () => {
        server.removeListener('error', onError);
        resolveListen();
      });
      server.listen(port, host);
    });
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(
      `\n  INFO  chavaJs dev server running.\n` +
        `  > Local:   http://${host}:${actualPort}\n` +
        `  > CTRL+C to stop\n`,
    );
    return server;
  }

  /**
   * Graceful teardown: stop cache timers, close database pools. Best-effort —
   * every step swallows errors so one failing service never blocks shutdown.
   * Call from SIGTERM/SIGINT handlers after the HTTP server has drained.
   */
  public async shutdown(): Promise<void> {
    const tasks: Array<Promise<unknown>> = [];
    try {
      const cache = this.make<{ destroy: () => Promise<void> | void }>('cache');
      tasks.push(Promise.resolve(cache.destroy()).catch(() => undefined));
    } catch {
      // Cache not bound (e.g. CLI commands) — nothing to clean.
    }
    try {
      const db = this.make<{ closeAll: () => Promise<void> }>('db');
      tasks.push(db.closeAll().catch(() => undefined));
    } catch {
      // DB not bound — nothing to clean.
    }
    await Promise.all(tasks);
  }

  // --------------------------------------------------------------- paths

  public path(...segments: string[]): string {
    return join(this.basePath, ...segments);
  }

  public configPath(...segments: string[]): string {
    return this.path('config', ...segments);
  }

  public routesPath(...segments: string[]): string {
    return this.path('routes', ...segments);
  }

  public resourcePath(...segments: string[]): string {
    return this.path('resources', ...segments);
  }

  public publicPath(...segments: string[]): string {
    return this.path('public', ...segments);
  }

  public storagePath(...segments: string[]): string {
    return this.path('storage', ...segments);
  }

  public basePathDir(): string {
    return this.basePath;
  }

  // ------------------------------------------------------------- internals

  private async loadConfigFiles(): Promise<void> {
    const config = new Config();
    const dir = this.configPath();
    const files = existsSync(dir)
      ? readdirSync(dir).filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
      : [];
    for (const file of files) {
      const key = file.replace(/\.(ts|js)$/, '');
      const module = (await import(pathToFileURL(join(dir, file)).href)) as { default?: unknown };
      config.set(key, module.default ?? module);
    }
    this.container.instance('config', config);
    this.container.alias('Config', 'config');
  }

  private registerProviders(providerClasses: Array<new (app: Application) => ServiceProvider>): void {
    for (const Provider of providerClasses) {
      const provider = new Provider(this);
      this.registeredProviders.push(provider);
      provider.register();
    }
  }

  private async bootProviders(): Promise<void> {
    for (const provider of this.registeredProviders) {
      await provider.boot();
    }
  }
}

