import { ServiceProvider } from '../container/ServiceProvider';
import { StorageManager } from '../storage/StorageManager';

export class StorageServiceProvider extends ServiceProvider {
  public async boot(): Promise<void> {
    // noop
  }

  public register(): void {
    this.app.singleton('storage', () => {
      const config = this.app.make('config') as { get(key: string, fallback?: unknown): unknown };
      const filesystemConfig = config.get('filesystem', { default: 'local', disks: {} }) as {
        default: string;
        disks: Record<string, { driver: 'local' | 's3'; root: string; visibility?: 'public' | 'private' }>;
      };

      return new StorageManager(filesystemConfig.disks ?? {});
    });
  }
}
