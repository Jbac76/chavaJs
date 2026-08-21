import { RuntimeException } from '../../support/exceptions';
import type { ColumnDefinition } from './Blueprint';
import { SchemaGrammar } from './SchemaGrammar';

const TYPE_MAP: Record<string, (column: ColumnDefinition) => string> = {
  string: (column) => `varchar(${column.length ?? 255})`,
  text: () => 'text',
  integer: () => 'integer',
  bigInteger: () => 'bigint',
  tinyInteger: () => 'smallint',
  float: () => 'double precision',
  double: () => 'double precision',
  decimal: (column) => `numeric(${column.precision ?? 8}, ${column.scale ?? 2})`,
  boolean: () => 'boolean',
  date: () => 'date',
  dateTime: () => 'timestamp(0) without time zone',
  time: () => 'time(0) without time zone',
  timestamp: () => 'timestamp(0) without time zone',
  json: () => 'json',
  jsonb: () => 'jsonb',
  uuid: () => 'uuid',
  binary: () => 'bytea',
  enum: () => 'text',
};

/**
 * Postgres grammar. Auto-increment uses `serial`/`bigserial` (the simplest
 * universally-supported identity form), enums become CHECK constraints, and
 * introspection reads `information_schema`/`pg_tables`.
 */
export class PostgresGrammar extends SchemaGrammar {
  protected override autoincrementType(column: ColumnDefinition): string {
    return `${column.type === 'bigInteger' ? 'bigserial' : 'serial'} primary key`;
  }

  protected override columnTypeSql(column: ColumnDefinition): string {
    const factory = TYPE_MAP[column.type];
    if (!factory) {
      throw new RuntimeException(`Unknown column type [${column.type}] for column [${column.name}].`);
    }
    return factory(column);
  }

  protected override compileDefault(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    return super.compileDefault(value);
  }

  protected override migrationsIdColumn(): string {
    return 'bigserial primary key';
  }

  protected override migrationsNameColumn(): string {
    return 'text not null';
  }

  protected override migrationsBatchColumn(): string {
    return 'integer not null';
  }

  public override hasTableSql(table: string): { sql: string; bindings: unknown[] } {
    return {
      sql: `select table_name from information_schema.tables where table_schema = current_schema() and table_name = ?`,
      bindings: [table],
    };
  }

  public override columnListingSql(table: string): { sql: string; bindings: unknown[] } {
    return {
      sql: `select column_name from information_schema.columns where table_schema = current_schema() and table_name = ?`,
      bindings: [table],
    };
  }

  public override listTablesSql(): { sql: string; bindings: unknown[] } {
    return {
      sql: `select tablename as name from pg_tables where schemaname = current_schema()`,
      bindings: [],
    };
  }

  public override dropTableSql(table: string): string {
    return `drop table if exists ${this.quote(table)} cascade`;
  }

  public override beforeDropAll(): string[] {
    // CASCADE on the drops handles foreign keys — no pragma needed.
    return [];
  }

  public override afterDropAll(): string[] {
    return [];
  }
}
