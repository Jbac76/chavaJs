import { RuntimeException } from '../../support/exceptions';
import type { ColumnDefinition } from './Blueprint';
import { SchemaGrammar } from './SchemaGrammar';

const TYPE_MAP: Record<string, (column: ColumnDefinition) => string> = {
  string: (column) => `varchar(${column.length ?? 255})`,
  text: () => 'text',
  integer: () => 'int',
  bigInteger: () => 'bigint',
  tinyInteger: () => 'tinyint',
  float: () => 'double',
  double: () => 'double',
  decimal: (column) => `decimal(${column.precision ?? 8}, ${column.scale ?? 2})`,
  boolean: () => 'tinyint(1)',
  date: () => 'date',
  dateTime: () => 'datetime',
  time: () => 'time',
  timestamp: () => 'timestamp',
  json: () => 'json',
  jsonb: () => 'json',
  uuid: () => 'char(36)',
  binary: () => 'blob',
  enum: (column) => `enum(${(column.check ?? []).map((value) => `'${value.replace(/'/g, "''")}'`).join(', ')})`,
};

/**
 * MySQL grammar. Auto-increment is `int unsigned NOT NULL AUTO_INCREMENT
 * PRIMARY KEY`, identifiers use backticks, enums are native `ENUM(...)`, and
 * introspection reads `information_schema`.
 */
export class MySQLGrammar extends SchemaGrammar {
  protected override quoteChar = '`';

  protected override autoincrementType(column: ColumnDefinition): string {
    const base = column.type === 'bigInteger' ? 'bigint' : 'int';
    return `${base} unsigned not null auto_increment primary key`;
  }

  protected override columnTypeSql(column: ColumnDefinition): string {
    const factory = TYPE_MAP[column.type];
    if (!factory) {
      throw new RuntimeException(`Unknown column type [${column.type}] for column [${column.name}].`);
    }
    const type = factory(column);
    // `unsigned` only applies to integer types (Laravel's MySQL grammar does
    // the same: ->unsigned() after integer/foreignId columns).
    const isIntegerType = ['int', 'bigint', 'tinyint', 'smallint', 'mediumint'].some((t) => type.startsWith(t));
    return column.isUnsigned && isIntegerType ? `${type} unsigned` : type;
  }

  protected override enumUsesCheckConstraint(): boolean {
    // Native ENUM(...) — no CHECK constraint needed.
    return false;
  }

  protected override migrationsIdColumn(): string {
    return 'bigint unsigned not null auto_increment primary key';
  }

  protected override migrationsNameColumn(): string {
    return 'varchar(255) not null';
  }

  protected override migrationsBatchColumn(): string {
    return 'int not null';
  }

  public override hasTableSql(table: string): { sql: string; bindings: unknown[] } {
    return {
      sql: `select table_name from information_schema.tables where table_schema = database() and table_name = ?`,
      bindings: [table],
    };
  }

  public override columnListingSql(table: string): { sql: string; bindings: unknown[] } {
    return {
      sql: `select column_name from information_schema.columns where table_schema = database() and table_name = ?`,
      bindings: [table],
    };
  }

  public override listTablesSql(): { sql: string; bindings: unknown[] } {
    return {
      sql: `select table_name as name from information_schema.tables where table_schema = database()`,
      bindings: [],
    };
  }

  public override beforeDropAll(): string[] {
    return ['SET FOREIGN_KEY_CHECKS = 0'];
  }

  public override afterDropAll(): string[] {
    return ['SET FOREIGN_KEY_CHECKS = 1'];
  }
}
