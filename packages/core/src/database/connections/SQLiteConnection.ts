import { DatabaseSync } from 'node:sqlite';
import type { Connection, QueryResult, Row } from '../types';

/** node:sqlite's accepted binding values. */
type SQLInputValue = string | number | bigint | null | Uint8Array;

function toBindings(bindings: unknown[]): SQLInputValue[] {
  return bindings.map((binding) => {
    if (
      binding === null ||
      typeof binding === 'number' ||
      typeof binding === 'string' ||
      typeof binding === 'bigint' ||
      binding instanceof Uint8Array
    ) {
      return binding;
    }
    if (typeof binding === 'boolean') return binding ? 1 : 0;
    if (binding === undefined) return null;
    return JSON.stringify(binding);
  });
}

/**
 * SQLite connection backed by Node's built-in `node:sqlite` module, so the
 * framework has zero native dependencies. Synchronous under the hood, but the
 * public surface is async so future drivers (pg/mysql) can be swapped in.
 */
export class SQLiteConnection implements Connection {
  private readonly db: DatabaseSync;
  private transactionDepth = 0;

  public constructor(database: string) {
    this.db = new DatabaseSync(database);
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  public async query<T extends Row = Row>(sql: string, bindings: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...toBindings(bindings)) as T[];
  }

  public async first<T extends Row = Row>(sql: string, bindings: unknown[] = []): Promise<T | undefined> {
    return this.db.prepare(sql).get(...toBindings(bindings)) as T | undefined;
  }

  public async run(sql: string, bindings: unknown[] = []): Promise<QueryResult> {
    const result = this.db.prepare(sql).run(...toBindings(bindings));
    return {
      changes: Number(result.changes),
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  public async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  public async transaction<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) {
      this.db.exec(`SAVEPOINT chava_sp_${this.transactionDepth}`);
      this.transactionDepth++;
      try {
        const result = await fn(this);
        this.db.exec(`RELEASE SAVEPOINT chava_sp_${this.transactionDepth - 1}`);
        this.transactionDepth--;
        return result;
      } catch (error) {
        this.db.exec(`ROLLBACK TO SAVEPOINT chava_sp_${this.transactionDepth - 1}`);
        this.transactionDepth--;
        throw error;
      }
    }

    this.db.exec('BEGIN');
    this.transactionDepth++;
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      this.transactionDepth--;
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      this.transactionDepth--;
      throw error;
    }
  }

  public async close(): Promise<void> {
    this.db.close();
  }
}
