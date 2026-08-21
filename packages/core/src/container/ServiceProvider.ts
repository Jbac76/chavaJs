import type { Application } from '../foundation/Application';

/**
 * Laravel's ServiceProvider lifecycle, ported:
 *
 *   register() — bind services into the container (runs before boot())
 *   boot()     — run after every provider has registered (async supported)
 */
export abstract class ServiceProvider {
  public constructor(protected readonly app: Application) {}

  public register(): void {}

  public async boot(): Promise<void> {}
}
