import { ServiceProvider } from '../container/ServiceProvider';
import { QueueManager } from '../queue/QueueManager';

/** Binds the `queue` manager that backs the `Queue` facade. */
export class QueueServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('queue', () => new QueueManager(this.app));
    this.app.alias('Queue', 'queue');
  }
}
