import { pathToFileURL } from 'node:url';
import { ServiceProvider } from '../container/ServiceProvider';
import { Scheduler } from '../scheduling/Scheduler';

/**
 * Binds the `schedule` facade root and loads routes/console.ts (Laravel's
 * ScheduleServiceProvider) where tasks are registered with the Schedule
 * facade.
 */
export class ScheduleServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('schedule', () => new Scheduler(this.app));
    this.app.alias('Schedule', 'schedule');
  }

  public override async boot(): Promise<void> {
    const path = this.app.routesPath('console.ts');
    try {
      await import(pathToFileURL(path).href);
    } catch {
      // routes/console.ts is optional.
    }
  }
}
