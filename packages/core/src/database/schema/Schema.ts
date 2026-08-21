import type { DatabaseManager } from '../DatabaseManager';
import type { Connection, Row } from '../types';
import { Blueprint } from './Blueprint';
import type { SchemaGrammar } from './SchemaGrammar';

/**
 * Laravel's Schema facade:
 *
 *   Schema.create('users', (table) => { table.id(); table.string('name'); });
 *   Schema.dropIfExists('users');
 *
 * Compilation and introspection are delegated to the default connection's
 * grammar, so the same API works on SQLite, Postgres and MySQL.
 */
export class Schema {
  private readonly manager: DatabaseManager;

  public constructor(manager: DatabaseManager) {
    this.manager = manager;
  }

  private conn(): Connection {
    return this.manager.connection();
  }

  private grammar(): SchemaGrammar {
    return this.manager.schemaGrammar();
  }

  /** Create a table (Laravel: Schema::create). */
  public async create(table: string, callback: (table: Blueprint) => void): Promise<void> {
    const blueprint = new Blueprint(table);
    callback(blueprint);
    for (const statement of this.grammar().compileCreate(blueprint)) {
      await this.conn().exec(statement);
    }
  }

  /** Alter a table (SQLite supports adding columns + indexes; drops require a rebuild). */
  public async table(table: string, callback: (table: Blueprint) => void): Promise<void> {
    const blueprint = new Blueprint(table);
    blueprint.altering = true;
    callback(blueprint);
    for (const statement of this.grammar().compileAlter(blueprint)) {
      await this.conn().exec(statement);
    }
  }

  public async drop(table: string): Promise<void> {
    await this.conn().exec(this.grammar().compileDrop(table));
  }

  public async dropIfExists(table: string): Promise<void> {
    await this.conn().exec(this.grammar().compileDrop(table));
  }

  public async hasTable(table: string): Promise<boolean> {
    const { sql, bindings } = this.grammar().hasTableSql(table);
    const row = await this.conn().first<Row>(sql, bindings);
    return row !== undefined;
  }

  public async hasColumn(table: string, column: string): Promise<boolean> {
    const columns = await this.getColumnListing(table);
    return columns.includes(column);
  }

  public async getColumnListing(table: string): Promise<string[]> {
    const { sql, bindings } = this.grammar().columnListingSql(table);
    const rows = await this.conn().query<Row>(sql, bindings);
    return rows.map((row) => String(row.column_name ?? row.name));
  }

  public async tableExistsForMigration(table: string): Promise<boolean> {
    return this.hasTable(table);
  }
}
