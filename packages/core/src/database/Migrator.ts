import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Application } from '../foundation/Application';
import type { DatabaseManager } from './DatabaseManager';
import type { Connection, Row } from './types';

interface MigrationFile {
  name: string;
  path: string;
}

interface MigrationModule {
  up: () => Promise<void> | void;
  down: () => Promise<void> | void;
}

/**
 * Laravel's Migrator: discovers database/migrations/*.ts, tracks batches in a
 * `migrations` table, and runs each migration's up()/down() in a transaction.
 */
export class Migrator {
  private readonly manager: DatabaseManager;
  private readonly app: Application;
  private readonly connectionName?: string;

  public constructor(app: Application, connectionName?: string) {
    this.app = app;
    this.manager = app.make<DatabaseManager>('db');
    this.connectionName = connectionName;
  }

  private conn(): Connection {
    return this.manager.connection(this.connectionName);
  }

  private schemaGrammar(): import('./schema/SchemaGrammar').SchemaGrammar {
    return this.manager.schemaGrammar();
  }

  private migrationPath(): string {
    return this.app.path('database', 'migrations');
  }

  /** Run all pending migrations. Returns the names that were run. */
  public async run(): Promise<string[]> {
    await this.ensureMigrationTable();
    const pending = await this.pendingMigrations();
    if (pending.length === 0) return [];

    const batch = (await this.getLastBatchNumber()) + 1;
    for (const file of pending) {
      await this.runUp(file, batch);
    }
    return pending.map((file) => file.name);
  }

  /** Roll back the last batch of migrations. */
  public async rollback(): Promise<string[]> {
    await this.ensureMigrationTable();
    const lastBatch = await this.getLastBatchNumber();
    if (lastBatch === 0) return [];
    const rows = await this.conn().query<Row>(
      'select migration from migrations where batch = ? order by id desc',
      [lastBatch],
    );
    const names = rows.map((row) => String(row.migration));
    for (const name of names) {
      await this.runDown(name);
    }
    return names;
  }

  /** Drop every table (including the migrations table) and re-run all migrations. */
  public async fresh(): Promise<string[]> {
    await this.ensureMigrationTable();
    await this.dropAllTables();
    return this.run();
  }

  /** Drop every table without re-running migrations (like fresh() minus the run). */
  public async wipe(): Promise<void> {
    await this.dropAllTables();
  }

  /** Reset all migrations (run down for every migration, reverse order). */
  public async reset(): Promise<string[]> {
    await this.ensureMigrationTable();
    const rows = await this.conn().query<Row>(
      'select migration from migrations order by id desc',
    );
    const names = rows.map((row) => String(row.migration));
    for (const name of names) {
      await this.runDown(name);
    }
    return names;
  }

  /** List every migration with its batch (null = pending). */
  public async status(): Promise<Array<{ migration: string; batch: number | null }>> {
    await this.ensureMigrationTable();
    const ran = await this.conn().query<Row>('select migration, batch from migrations');
    const ranMap = new Map(ran.map((row) => [String(row.migration), Number(row.batch)]));
    return this.getMigrationFiles().map((file) => ({
      migration: file.name,
      batch: ranMap.get(file.name) ?? null,
    }));
  }

  // -------------------------------------------------------------- internals

  private async ensureMigrationTable(): Promise<void> {
    await this.conn().exec(this.schemaGrammar().createMigrationsTable());
  }

  private getMigrationFiles(): MigrationFile[] {
    const dir = this.migrationPath();
    const files = readdirSync(dir)
      .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();
    return files.map((file) => ({ name: file.replace(/\.(ts|js)$/, ''), path: join(dir, file) }));
  }

  private async getRan(): Promise<Set<string>> {
    const rows = await this.conn().query<Row>('select migration from migrations');
    return new Set(rows.map((row) => String(row.migration)));
  }

  private async pendingMigrations(): Promise<MigrationFile[]> {
    const ran = await this.getRan();
    return this.getMigrationFiles().filter((file) => !ran.has(file.name));
  }

  private async getLastBatchNumber(): Promise<number> {
    const row = await this.conn().first<Row>('select max(batch) as batch from migrations');
    return row?.batch ? Number(row.batch) : 0;
  }

  private async runUp(file: MigrationFile, batch: number): Promise<void> {
    const migration = await this.resolve(file);
    await this.conn().transaction(async () => {
      await migration.up();
      await this.conn().run('insert into migrations (migration, batch) values (?, ?)', [
        file.name,
        batch,
      ]);
    });
    console.log(`  > Migrated: ${file.name}`);
  }

  private async runDown(name: string): Promise<void> {
    const file = this.getMigrationFiles().find((candidate) => candidate.name === name);
    if (!file) return;
    const migration = await this.resolve(file);
    await this.conn().transaction(async () => {
      await migration.down();
      await this.conn().run('delete from migrations where migration = ?', [name]);
    });
    console.log(`  > Rolled back: ${name}`);
  }

  private async resolve(file: MigrationFile): Promise<MigrationModule> {
    const module = (await import(pathToFileURL(file.path).href)) as {
      up?: () => Promise<void> | void;
      down?: () => Promise<void> | void;
    };
    if (typeof module.up !== 'function' || typeof module.down !== 'function') {
      throw new Error(
        `Migration [${file.name}] must export up() and down() functions.`,
      );
    }
    return { up: module.up, down: module.down };
  }

  private async dropAllTables(): Promise<void> {
    const grammar = this.schemaGrammar();
    const { sql, bindings } = grammar.listTablesSql();
    const rows = await this.conn().query<Row>(sql, bindings);
    if (rows.length === 0) return;

    // The drop pass runs with FK checks disabled where the driver supports
    // it (Laravel does the same) so parent tables can be dropped in any order.
    for (const statement of grammar.beforeDropAll()) {
      await this.conn().exec(statement);
    }
    try {
      for (const row of rows) {
        const name = String(row.name ?? row.tablename ?? row.table_name);
        await this.conn().exec(grammar.dropTableSql(name));
      }
    } finally {
      for (const statement of grammar.afterDropAll()) {
        await this.conn().exec(statement);
      }
    }
  }
}
