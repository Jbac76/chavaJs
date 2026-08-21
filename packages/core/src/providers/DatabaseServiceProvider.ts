import { ServiceProvider } from '../container/ServiceProvider';
import { DatabaseManager } from '../database/DatabaseManager';
import { Schema } from '../database/schema/Schema';

/** Binds the `db` (DatabaseManager) and `schema` (Schema) singletons. */
export class DatabaseServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('db', () => new DatabaseManager(this.app));
    this.app.singleton('schema', () => new Schema(this.app.make<DatabaseManager>('db')));
    this.app.alias('DatabaseManager', 'db');
    this.app.alias('Schema', 'schema');
  }
}
