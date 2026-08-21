import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import { RuntimeException } from '../support/exceptions';
import type { Job } from './Job';
import type { QueueDriver } from './types';
import { DatabaseDriver } from './drivers/DatabaseDriver';
import { RedisDriver } from './drivers/RedisDriver';
import { SyncDriver } from './drivers/SyncDriver';

/**
 * Laravel's QueueManager — resolves the configured driver by name and is the
 * root of the `Queue` facade:
 *
 *   await Queue.push(new SendWelcomeEmail(user));
 *   await Queue.later(60, new ProcessPodcast(podcast));
 */
export class QueueManager {
  private readonly drivers = new Map<string, QueueDriver>();

  public constructor(private readonly app: Application) {}

  public connection(name?: string): QueueDriver {
    const config = this.app.make<Config>('config');
    const connectionName = name ?? config.get<string>('queue.default', 'sync');
    const cached = this.drivers.get(connectionName);
    if (cached) return cached;

    const connectionConfig = config.get<Record<string, unknown>>(
      `queue.connections.${connectionName}`,
      {},
    );
    const driver = String(connectionConfig.driver ?? 'sync');
    let instance: QueueDriver;
    switch (driver) {
      case 'sync':
        instance = new SyncDriver(this.app);
        break;
      case 'database':
        instance = new DatabaseDriver(this.app);
        break;
      case 'redis':
        instance = new RedisDriver(connectionConfig);
        break;
      default:
        throw new RuntimeException(`Queue driver [${driver}] is not supported.`);
    }
    this.drivers.set(connectionName, instance);
    return instance;
  }

  /** Dispatch a job onto the default queue (Laravel: Queue::push). */
  public async push(job: Job): Promise<void> {
    await this.connection().push(job);
  }

  /** Dispatch a job after a delay in seconds (Laravel: Queue::later). */
  public async later(delaySeconds: number, job: Job): Promise<void> {
    await this.connection().later(delaySeconds, job);
  }
}
