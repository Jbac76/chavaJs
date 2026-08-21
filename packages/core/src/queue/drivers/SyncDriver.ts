import type { Application } from '../../foundation/Application';
import type { Job } from '../Job';
import type { QueueDriver } from '../types';

/**
 * Laravel's `sync` queue driver: the job runs immediately in the same process
 * (blocking the dispatch call). Useful for tests and local development.
 */
export class SyncDriver implements QueueDriver {
  public constructor(private readonly app: Application) {}

  public async push(job: Job): Promise<void> {
    await this.run(job);
  }

  public async later(delaySeconds: number, job: Job): Promise<void> {
    if (delaySeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
    await this.run(job);
  }

  public async run(job: Job): Promise<void> {
    const instance = this.resolve(job);
    await instance.handle();
  }

  private resolve(job: Job): Job {
    const ctor = job.constructor as new () => Job;
    const instance = new ctor();
    for (const [key, value] of Object.entries(job)) {
      if (!key.startsWith('_')) {
        (instance as unknown as Record<string, unknown>)[key] = value;
      }
    }
    return instance;
  }
}
