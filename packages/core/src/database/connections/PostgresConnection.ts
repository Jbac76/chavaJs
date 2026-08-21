import { createRequire } from 'node:module';
import type { Connection, ConnectionConfig, QueryResult, Row } from '../types';

/** Minimal `pg` surface used by this driver (types only — pg is optional). */
interface PgPoolLike {
  query(sql: string, bindings?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
}

interface PgClientLike {
  query(sql: string, bindings?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
  release(): void;
}

interface PgModuleLike {
  Pool: new (config: Record<string, unknown>) => PgPoolLike;
  types: { setTypeParser(oid: number, parser: (value: string) => unknown): void };
}

/**
 * Rewrite `?` placeholders to Postgres `$1..$n`, skipping string literals so
 * a `?` inside a quoted default can't be corrupted. The Builder stays
 * driver-agnostic (it always emits `?`); each driver owns its placeholder
 * dialect.
 */
export function rewritePostgresPlaceholders(sql: string): string {
  let out = '';
  let index = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      // Copy a single-quoted string literal ('' is an escaped quote).
      out += char;
      i++;
      while (i < sql.length) {
        out += sql[i];
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") {
            out += "'";
            i++;
          } else {
            break;
          }
        }
        i++;
      }
      continue;
    }
    if (char === '?') {
      index++;
      out += `$${index}`;
      continue;
    }
    out += char;
  }
  return out;
}

function normalizeValue(value: unknown): unknown {
  // node-postgres returns dates as Date objects; SQLite returns ISO strings.
  // Normalize so the ORM sees the same shapes on every driver.
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
 * Postgres connection backed by `pg` (an optional dependency — `npm i pg`).
 * Implements the same `Connection` seam as SQLiteConnection so the query
 * builder, schema builder and ORM need zero changes; Postgres-specific SQL
 * (RETURNING, `$1` placeholders) is handled here and in the grammars.
 */
export class PostgresConnection implements Connection {
  private readonly pool: PgPoolLike;
  private activeClient: PgClientLike | null = null;
  private savepointDepth = 0;

  public constructor(config: Partial<ConnectionConfig>, injectedPool?: PgPoolLike) {
    if (injectedPool) {
      this.pool = injectedPool;
      return;
    }

    const require = createRequire(import.meta.url);
    let pg: PgModuleLike;
    try {
      pg = require('pg') as PgModuleLike;
    } catch {
      throw new Error(
        'The postgres database driver requires the `pg` package - run `npm i pg` ' +
          'and configure config/database.ts with your Postgres connection settings.',
      );
    }

    // int8/bigint (OID 20) and numeric (OID 1700) come back as strings by
    // default; parse them so ids/aggregates are numbers like SQLite/MySQL.
    pg.types.setTypeParser(20, (value) => (value === null ? null : Number(value)));
    pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

    this.pool = new pg.Pool({
      host: config.host ?? '127.0.0.1',
      port: Number(config.port ?? 5432),
      database: config.database ?? 'chava',
      user: config.username ?? 'postgres',
      password: config.password ?? '',
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    });
  }

  private async execute<T>(sql: string, bindings: unknown[] = []): Promise<{ rows: T[]; rowCount: number | null }> {
    const rewritten = rewritePostgresPlaceholders(sql);
    const target = this.activeClient ?? this.pool;
    return target.query(rewritten, bindings) as Promise<{ rows: T[]; rowCount: number | null }>;
  }

  public async query<T extends Row = Row>(sql: string, bindings: unknown[] = []): Promise<T[]> {
    const result = await this.execute(sql, bindings);
    return normalizeRows(result.rows) as T[];
  }

  public async first<T extends Row = Row>(sql: string, bindings: unknown[] = []): Promise<T | undefined> {
    const result = await this.execute(sql, bindings);
    return (normalizeRows(result.rows)[0] as T | undefined) ?? undefined;
  }

  public async run(sql: string, bindings: unknown[] = []): Promise<QueryResult> {
    const result = await this.execute(sql, bindings);
    return {
      changes: result.rowCount ?? 0,
      // Postgres has no lastInsertRowid — insertGetId uses RETURNING.
      lastInsertRowid: 0,
    };
  }

  public async exec(sql: string): Promise<void> {
    const target = this.activeClient ?? this.pool;
    await target.query(sql);
  }

  public async transaction<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    if (this.activeClient) {
      // Nested transaction → savepoint on the same client.
      this.savepointDepth++;
      const savepoint = `chava_sp_${this.savepointDepth}`;
      await this.activeClient.query(`SAVEPOINT ${savepoint}`);
      try {
        const result = await fn(this);
        await this.activeClient.query(`RELEASE SAVEPOINT ${savepoint}`);
        this.savepointDepth--;
        return result;
      } catch (error) {
        await this.activeClient.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        this.savepointDepth--;
        throw error;
      }
    }

    const client = await this.pool.connect();
    this.activeClient = client;
    try {
      await client.query('BEGIN');
      const result = await fn(this);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      this.activeClient = null;
      this.savepointDepth = 0;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
