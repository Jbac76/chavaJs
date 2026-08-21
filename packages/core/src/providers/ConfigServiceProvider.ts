import { ServiceProvider } from '../container/ServiceProvider';

/**
 * Registers the Config binding. (The Config instance itself is created during
 * `Application.bootstrap()` because loading config/*.ts files is async; this
 * provider exists for lifecycle parity and alias registration.)
 */
export class ConfigServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.alias('ConfigRepository', 'config');
  }
}
