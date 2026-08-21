import { ServiceProvider } from '../container/ServiceProvider';
import { Dispatcher } from '../events/Dispatcher';

/** Binds the `events` dispatcher that backs the `Event` facade. */
export class EventServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('events', () => new Dispatcher(this.app));
    this.app.alias('Event', 'events');
  }
}
