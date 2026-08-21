import type { Filesystem } from './Filesystem';
import type { DiskConfig } from './types';
import { LocalDisk } from './disks/LocalDisk';

/**
 * Manages filesystem disks — Laravel's Storage facade backing.
 *
 *   const storage = app.make('storage') as StorageManager;
 *   const disk = storage.disk('local');
 *   await disk.put('file.txt', 'hello');
 *   const content = await disk.get('file.txt');
 */
export class StorageManager {
  private readonly cache = new Map<string, Filesystem>();
  private readonly configs: Record<string, DiskConfig>;

  public constructor(configs: Record<string, DiskConfig> = {}) {
    this.configs = configs;
  }

  /** Get a disk instance by name. Defaults to 'local'. */
  public disk(name?: string): Filesystem {
    const diskName = name ?? 'local';
    const existing = this.cache.get(diskName);
    if (existing) return existing;

    const config = this.configs[diskName];
    if (!config) {
      throw new Error(
        `Disk [${diskName}] is not configured. Add it to config/filesystem.ts.`,
      );
    }

    let disk: Filesystem;
    switch (config.driver) {
      case 'local':
        disk = new LocalDisk(diskName, config);
        break;
      case 's3':
        throw new Error(
          'S3 disk requires @aws-sdk/client-s3. Install it with: npm i @aws-sdk/client-s3',
        );
      default:
        throw new Error(`Unsupported disk driver: ${config.driver}`);
    }

    this.cache.set(diskName, disk);
    return disk;
  }

  /** Convenience: default disk. */
  public get default(): Filesystem {
    return this.disk();
  }

  /** List all configured disk names. */
  public getDisks(): string[] {
    return Object.keys(this.configs);
  }
}
