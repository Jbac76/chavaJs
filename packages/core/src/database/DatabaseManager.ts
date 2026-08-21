import type { Application } from '../foundation/Application';
import { Config } from '../config/Config';
import { RuntimeException } from '../support/exceptions';
import { SQLiteConnection } from './connections/SQLiteConnection';
import { MySQLConnection } from './connections/MySQLConnection';
import { PostgresConnection } from './connections/PostgresConnection';
import { Builder } from './query/Builder';
import { QueryGrammar } from './query/QueryGrammar';
import { SQLiteQueryGrammar } from './query/SQLiteQueryGrammar';
import { PostgresQueryGrammar } from './query/PostgresQueryGrammar';
import { MySQLQueryGrammar } from './query/MySQLQueryGrammar';
import { SchemaGrammar } from './schema/SchemaGrammar';
import { SQLiteGrammar } from './schema/SQLiteGrammar';
import { PostgresGrammar } from './schema/PostgresGrammar';
import { MySQLGrammar } from './schema/MySQLGrammar';
import type { Connection, ConnectionConfig } from './types';

/**
 * Laravel's database manager: resolves a connection from config/database.ts
 * by name (cached), and is the root of the `DB` facade.
 *
 *   DB.table('users').where('id', 1).first()
 *
 * Drivers: `sqlite` (built-in), `pg` / `postgres` (requires `npm i pg`),
 * `mysql` (requires `npm i mysql2`).
 */
export class DatabaseManager {
  private readonly connections = new Map<string, Connection>();
  private readonly grammars = new Map<string, { query: QueryGrammar; schema: SchemaGrammar }>();

  public constructor(private readonly app: Application) {}

  public connection(name?: string): Connection {
    const config = this.app.make<Config>('config');
    const connectionName = name ?? config.get<string>('database.default', 'sqlite');
    const cached = this.connections.get(connectionName);
    if (cached) return cached;

    const connectionConfig = config.get<Partial<ConnectionConfig>>(
      `database.connections.${connectionName}`,
      {},
    );
    const driver = connectionConfig.driver ?? 'sqlite';
    const connection = this.createConnection(driver, connectionConfig);
    this.connections.set(connectionName, connection);
    return connection;
  }

  private createConnection(driver: string, config: Partial<ConnectionConfig>): Connection {
    switch (driver) {
      case 'sqlite': {
        const database = config.database ?? ':memory:';
        const path = database === ':memory:' ? database : this.app.path(database);
        return new SQLiteConnection(path);
      }
      case 'pg':
      case 'postgres':
        return new PostgresConnection(config);
      case 'mysql':
        return new MySQLConnection(config);
      default:
        throw new RuntimeException(
          `Database driver [${driver}] is not supported. Available drivers: sqlite, pg (postgres), mysql. ` +
            `Postgres requires \`npm i pg\`; MySQL requires \`npm i mysql2\`.`,
        );
    }
  }

  /**
   * The query grammar for the default connection (used by the Builder for
   * quoting, RANDOM()/RAND(), insertGetId RETURNING and upsert dialect).
   */
  public queryGrammar(): QueryGrammar {
    return this.grammarPair().query;
  }

  /** The schema grammar for the default connection (types, introspection). */
  public schemaGrammar(): SchemaGrammar {
    return this.grammarPair().schema;
  }

  private grammarPair(): { query: QueryGrammar; schema: SchemaGrammar } {
    // Un-booted apps (unit tests that only compile SQL via toSql()) have no
    // config binding — fall back to the sqlite grammar rather than throwing.
    let connectionName = 'sqlite';
    let driver = 'sqlite';
    try {
      const config = this.app.make<Config>('config');
      connectionName = config.get<string>('database.default', 'sqlite');
      driver = config.get<string>(`database.connections.${connectionName}.driver`, 'sqlite');
    } catch {
      // no config → default grammar
    }

    const cacheKey = `${connectionName}:${driver}`;
    const cached = this.grammars.get(cacheKey);
    if (cached) return cached;

    const pair = this.createGrammarPair(driver);
    this.grammars.set(cacheKey, pair);
    return pair;
  }

  private createGrammarPair(driver: string): { query: QueryGrammar; schema: SchemaGrammar } {
    switch (driver) {
      case 'pg':
      case 'postgres':
        return { query: new PostgresQueryGrammar(), schema: new PostgresGrammar() };
      case 'mysql':
        return { query: new MySQLQueryGrammar(), schema: new MySQLGrammar() };
      case 'sqlite':
      default:
        return { query: new SQLiteQueryGrammar(), schema: new SQLiteGrammar() };
    }
  }

  /** Start a query builder against a table (Laravel: DB::table('users')). */
  public table(table: string): Builder {
    return new Builder(this).from(table);
  }

  public getConnectionNames(): string[] {
    return [...this.connections.keys()];
  }
}
