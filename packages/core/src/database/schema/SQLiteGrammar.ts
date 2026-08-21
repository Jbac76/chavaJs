import { RuntimeException } from '../../support/exceptions';
import type { ColumnDefinition } from './Blueprint';
import { SchemaGrammar } from './SchemaGrammar';

const TYPE_MAP: Record<string, string> = {
  string: 'TEXT',
  text: 'TEXT',
  integer: 'INTEGER',
  bigInteger: 'INTEGER',
  tinyInteger: 'INTEGER',
  float: 'REAL',
  double: 'REAL',
  decimal: 'NUMERIC',
  boolean: 'INTEGER',
  date: 'TEXT',
  dateTime: 'TEXT',
  time: 'TEXT',
  timestamp: 'TEXT',
  json: 'TEXT',
  jsonb: 'TEXT',
  uuid: 'TEXT',
  binary: 'BLOB',
  enum: 'TEXT',
};

/**
 * SQLite grammar — Laravel's SQLiteGrammar equivalent. SQLite stores every
 * dynamic type as TEXT/INTEGER/REAL/BLOB and emulates enums with CHECK
 * constraints; `id()` becomes `INTEGER PRIMARY KEY AUTOINCREMENT`.
 */
export class SQLiteGrammar extends SchemaGrammar {
  protected override autoincrementType(column: ColumnDefinition): string {
    return `${TYPE_MAP[column.type] ?? this.columnTypeSql(column)} primary key autoincrement`;
  }

  protected override columnTypeSql(column: ColumnDefinition): string {
    const type = TYPE_MAP[column.type];
    if (!type) {
      throw new RuntimeException(`Unknown column type [${column.type}] for column [${column.name}].`);
    }
    return type;
  }
}
