/**
 * The database driver seam. Phase 8 ships SQLite (built on `node:sqlite`),
 * Postgres (`pg`, optional) and MySQL (`mysql2`, optional) adapters — all
 * implement the same interface and plug in via config/database.ts.
 */
export interface QueryResult {
  changes: number;
  lastInsertRowid: number;
}

export type Row = Record<string, unknown>;

export interface Connection {
  /** Run a SELECT and return all rows. */
  query<T extends Row = Row>(sql: string, bindings?: unknown[]): Promise<T[]>;

  /** Run a SELECT and return the first row (or undefined). */
  first<T extends Row = Row>(sql: string, bindings?: unknown[]): Promise<T | undefined>;

  /** Run an INSERT/UPDATE/DELETE and return change info. */
  run(sql: string, bindings?: unknown[]): Promise<QueryResult>;

  /** Run one or more statements without parameters (DDL). */
  exec(sql: string): Promise<void>;

  /** Run `fn` inside a transaction (nested transactions use savepoints). */
  transaction<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;

  close(): Promise<void>;
}

export interface ConnectionConfig {
  driver: string;
  database?: string;
  /** Postgres / MySQL. */
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  ssl?: boolean;
  [key: string]: unknown;
}
