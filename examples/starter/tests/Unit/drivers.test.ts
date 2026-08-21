import { describe, expect, it } from 'vitest';
import { Application } from '../../src/foundation/Application';
import { Config } from '../../src/config/Config';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { PostgresConnection, rewritePostgresPlaceholders } from '../../src/database/connections/PostgresConnection';
import { MySQLConnection } from '../../src/database/connections/MySQLConnection';
import { PostgresQueryGrammar } from '../../src/database/query/PostgresQueryGrammar';
import { MySQLQueryGrammar } from '../../src/database/query/MySQLQueryGrammar';
import { SQLiteQueryGrammar } from '../../src/database/query/SQLiteQueryGrammar';

/** A DatabaseManager whose config points at a named driver (no boot needed). */
function managerFor(driver: 'sqlite' | 'pg' | 'mysql'): DatabaseManager {
  const app = new Application({ basePath: process.cwd() });
  const config = new Config();
  config.set('database', {
    default: driver,
    connections: { [driver]: { driver } },
  });
  app.instance('config', config);
  return new DatabaseManager(app);
}

describe('Postgres query grammar', () => {
  it('uses $1-style placeholders via connection rewriting, not in the builder', () => {
    // The Builder stays `?`-based; PostgresConnection rewrites at execution.
    expect(rewritePostgresPlaceholders('where "id" = ? and "name" = ?')).toBe('where "id" = $1 and "name" = $2');
  });

  it('skips ? inside string literals when rewriting placeholders', () => {
    expect(rewritePostgresPlaceholders("where \"body\" = 'what?' and \"id\" = ?")).toBe(
      "where \"body\" = 'what?' and \"id\" = $1",
    );
  });

  it('compiles insertGetId with RETURNING', () => {
    const grammar = new PostgresQueryGrammar();
    const compiled = grammar.compileInsertGetId('users', ['name'], [{ name: 'Ada' }], 'id');
    expect(compiled.sql).toBe('insert into "users" ("name") values (?) returning "id"');
    expect(compiled.returnsRow).toBe(true);
  });

  it('compiles upsert with ON CONFLICT ... excluded', () => {
    const grammar = new PostgresQueryGrammar();
    const compiled = grammar.compileUpsert('users', ['email', 'name'], [{ email: 'a@b.c', name: 'A' }], ['email'], ['name']);
    expect(compiled.sql).toContain('on conflict ("email") do update set "name" = excluded."name"');
  });

  it('compiles upsert with DO NOTHING when no update columns are given', () => {
    const grammar = new PostgresQueryGrammar();
    const compiled = grammar.compileUpsert('users', ['email'], [{ email: 'a@b.c' }], ['email'], []);
    expect(compiled.sql).toContain('on conflict ("email") do nothing');
  });
});

describe('MySQL query grammar', () => {
  it('quotes with backticks and uses RAND()', () => {
    const grammar = new MySQLQueryGrammar();
    expect(grammar.wrap('users')).toBe('`users`');
    expect(grammar.wrapColumn('users.name')).toBe('`users`.`name`');
    expect(grammar.random()).toBe('RAND()');
  });

  it('compiles upsert with ON DUPLICATE KEY UPDATE + VALUES()', () => {
    const grammar = new MySQLQueryGrammar();
    const compiled = grammar.compileUpsert('users', ['email', 'name'], [{ email: 'a@b.c', name: 'A' }], ['email'], ['name']);
    expect(compiled.sql).toBe('insert into `users` (`email`, `name`) values (?, ?) on duplicate key update `name` = values(`name`)');
  });

  it('compiles a no-op upsert when no update columns are given', () => {
    const grammar = new MySQLQueryGrammar();
    const compiled = grammar.compileUpsert('users', ['email'], [{ email: 'a@b.c' }], ['email'], []);
    expect(compiled.sql).toContain('on duplicate key update `email` = `email`');
  });
});

describe('DatabaseManager driver resolution', () => {
  it('resolves the postgres grammar pair from config', () => {
    const manager = managerFor('pg');
    expect(manager.queryGrammar()).toBeInstanceOf(PostgresQueryGrammar);
  });

  it('resolves the mysql grammar pair from config', () => {
    const manager = managerFor('mysql');
    expect(manager.queryGrammar()).toBeInstanceOf(MySQLQueryGrammar);
  });

  it('defaults to sqlite grammar when config is missing (unit-test compile path)', () => {
    const app = new Application({ basePath: process.cwd() });
    const manager = new DatabaseManager(app);
    expect(manager.queryGrammar()).toBeInstanceOf(SQLiteQueryGrammar);
  });
});

describe('PostgresConnection (mocked pg client)', () => {
  it('rewrites ? to $n and forwards bindings through the pool', async () => {
    const calls: Array<{ sql: string; bindings: unknown[] }> = [];
    const pool = {
      query: async (sql: string, bindings: unknown[] = []) => {
        calls.push({ sql, bindings });
        return { rows: [{ id: 1 }], rowCount: 1 };
      },
      connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
      end: async () => {},
    };

    const connection = new PostgresConnection({}, pool);
    const rows = await connection.query('select * from "users" where "id" = ? and "email" = ?', [7, 'a@b.c']);
    expect(rows).toEqual([{ id: 1 }]);
    expect(calls[0].sql).toBe('select * from "users" where "id" = $1 and "email" = $2');
    expect(calls[0].bindings).toEqual([7, 'a@b.c']);
  });

  it('maps rowCount to changes and normalizes Date values to ISO strings', async () => {
    const pool = {
      query: async () => ({ rows: [{ created_at: new Date('2026-08-09T00:00:00Z') }], rowCount: 2 }),
      connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
      end: async () => {},
    };
    const connection = new PostgresConnection({}, pool);
    const result = await connection.run('update "users" set "name" = ?', ['x']);
    expect(result.changes).toBe(2);
    const row = await connection.first('select * from "users"');
    expect(row?.created_at).toBe('2026-08-09T00:00:00.000Z');
  });

  it('runs transactions with BEGIN/COMMIT on a dedicated client', async () => {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql);
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => client,
      end: async () => {},
    };
    const connection = new PostgresConnection({}, pool);
    await connection.transaction(async (tx) => {
      await tx.run('insert into "users" ("name") values (?)', ['Ada']);
    });
    expect(statements).toEqual(['BEGIN', 'insert into "users" ("name") values ($1)', 'COMMIT']);
  });

  it('rolls back and releases the client on error', async () => {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql);
        return { rows: [], rowCount: 0 };
      },
      release: () => {},
    };
    const pool = {
      query: async () => ({ rows: [], rowCount: 0 }),
      connect: async () => client,
      end: async () => {},
    };
    const connection = new PostgresConnection({}, pool);
    await expect(
      connection.transaction(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(statements).toContain('BEGIN');
    expect(statements).toContain('ROLLBACK');
  });
});

describe('MySQLConnection (mocked mysql2 pool)', () => {
  it('forwards ? bindings unchanged and reads insertId', async () => {
    const calls: Array<{ sql: string; bindings: unknown[] }> = [];
    const pool = {
      query: async (sql: string, bindings: unknown[] = []): Promise<[{ id: number }[], unknown]> => {
        calls.push({ sql, bindings });
        return [[{ id: 1 }], undefined];
      },
      end: async () => {},
    };
    const connection = new MySQLConnection({}, pool);
    const rows = await connection.query('select * from `users` where `id` = ?', [1]);
    expect(rows).toEqual([{ id: 1 }]);
    expect(calls[0].sql).toContain('`id` = ?');

    // run() maps affectedRows/insertId. mysql2 returns the ResultSetHeader
    // object directly for writes (not wrapped in an array).
    const header = { affectedRows: 1, insertId: 42 };
    const runPool = {
      query: async (): Promise<[{ affectedRows: number; insertId: number }, unknown]> => [header, undefined],
      end: async () => {},
    };
    const runConnection = new MySQLConnection({}, runPool);
    const result = await runConnection.run('insert into `users` (`name`) values (?)', ['Ada']);
    expect(result.changes).toBe(1);
    expect(result.lastInsertRowid).toBe(42);
  });

  it('runs transactions with START TRANSACTION/COMMIT', async () => {
    const statements: string[] = [];
    const pool = {
      query: async (sql: string): Promise<[unknown[], unknown]> => {
        statements.push(sql);
        return [[], undefined];
      },
      end: async () => {},
    };
    const connection = new MySQLConnection({}, pool);
    await connection.transaction(async (tx) => {
      await tx.exec('insert into `users` (`name`) values (\'Ada\')');
    });
    expect(statements).toEqual(['START TRANSACTION', 'insert into `users` (`name`) values (\'Ada\')', 'COMMIT']);
  });
});
