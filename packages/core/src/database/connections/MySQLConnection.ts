import { createRequire } from 'node:module';
import type { Connection, ConnectionConfig, QueryResult, Row } from '../types';

/** Minimal `mysql2/promise` surface used by this driver (types only). */
interface MysqlPoolLike {
  query(sql: string, bindings?: unknown[]): Promise<[unknown, unknown]>;
  end(): Promise<void>;
}

interface MysqlModuleLike {
  createPool(config: Record<string, unknown>): MysqlPoolLike;
}

function normalizeValue(value: unknown): unknown {
  // With `dateStrings` mysql2 already returns DATETIME as 'YYYY-MM-DD
  // HH:MM:SS' strings (SQLite parity); a Date here is a non-DATETIME edge.
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeRows(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    if (row === null || typeof row !== 'object') return row;
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      normalized[key] = normalizeValue(value);
    }
    return normalized;
  });
}

/**
 * MySQL connection backed by `mysql2` (an optional dependency — `npm i
 * mysql2`). Implements the same `Connection` seam as SQLiteConnection, so the
 * query builder, schema builder and ORM need zero changes. Uses `?`
 * placeholders natively (MySQL's dialect) and reads `insertId` for
 * insertGetId. `createPool` is synchronous, which keeps the constructor
 * signature identical to the SQLite/Postgres adapters.
 */
export class MySQLConnection implements Connection {
  private readonly pool: MysqlPoolLike;
  private transactionDepth = 0;

  public constructor(config: Partial<ConnectionConfig>, injectedPool?: MysqlPoolLike) {
    if (injectedPool) {
      this.pool = injectedPool;
      return;
    }

    const require = createRequire(import.meta.url);
    let mysql: MysqlModuleLike;
    try {
      mysql = require('mysql2/promise') as MysqlModuleLike;
    } catch {
      throw new Error(
        'The mysql database driver requires the `mysql2` package - run `npm i mysql2` ' +
          'and configure config/database.ts with your MySQL connection settings.',
      );
    }

    this.pool = mysql.createPool({
      host: config.host ?? '127.0.0.1',
      port: Number(config.port ?? 3306),
      database: config.database ?? 'chava',
      user: config.username ?? 'root',
      password: config.password ?? '',
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
      // Return DATETIME as 'YYYY-MM-DD HH:MM:SS' strings and DECIMAL as
      // numbers (SQLite parity for the ORM).
      dateStrings: true,
      decimalNumbers: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
    });
  }

  private async raw<T>(sql: string, bindings: unknown[] = []): Promise<T> {
    const [result] = await this.pool.query(sql, bindings) as [T, unknown];
    return result;
  }

  public async query<T extends Row = Row>(sql: string, bindings: unknown[] = []): Promise<T[]> {
    const rows = await this.raw<T[]>(sql, bindings);
    return normalizeRows(rows) as T[];
  }

  public async first<T extends Row = Row>(sql: string, bindings: unknown[] = []): Promise<T | undefined> {
    const rows = await this.raw<T[]>(sql, bindings);
    return (normalizeRows(rows)[0] as T | undefined) ?? undefined;
  }

  public async run(sql: string, bindings: unknown[] = []): Promise<QueryResult> {
    const header = await this.raw<{ affectedRows: number; insertId: number }>(sql, bindings);
    return {
      changes: header.affectedRows ?? 0,
      lastInsertRowid: header.insertId ?? 0,
    };
  }

  public async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  public async transaction<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) {
      await this.pool.query(`SAVEPOINT chava_sp_${this.transactionDepth}`);
      this.transactionDepth++;
      try {
        const result = await fn(this);
        await this.pool.query(`RELEASE SAVEPOINT chava_sp_${this.transactionDepth - 1}`);
        this.transactionDepth--;
        return result;
      } catch (error) {
        await this.pool.query(`ROLLBACK TO SAVEPOINT chava_sp_${this.transactionDepth - 1}`);
        this.transactionDepth--;
        throw error;
      }
    }

    this.transactionDepth++;
    await this.pool.query('START TRANSACTION');
    try {
      const result = await fn(this);
      await this.pool.query('COMMIT');
      this.transactionDepth--;
      return result;
    } catch (error) {
      await this.pool.query('ROLLBACK');
      this.transactionDepth--;
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
