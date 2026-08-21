import { RuntimeException } from '../../support/exceptions';
import type { Blueprint, ColumnDefinition } from './Blueprint';

/**
 * Laravel's schema Grammar, ported. Compiles Blueprints into DDL for the
 * configured driver. The base class holds the shared CREATE TABLE / ALTER
 * TABLE / CREATE INDEX shape; each driver overrides the type map, identifier
 * quoting, auto-increment syntax, defaults and introspection queries.
 *
 * Note on placeholders: grammars always emit `?`; PostgresConnection rewrites
 * them to `$1..$n` at execution time, so introspection SQL stays uniform.
 */
export abstract class SchemaGrammar {
  protected quoteChar = '"';

  public compileCreate(blueprint: Blueprint): string[] {
    const columnSql = blueprint.columns.map((column) => this.compileColumn(column));
    const primaryKey = blueprint.indexes.find((index) => index.type === 'primary');
    if (primaryKey && primaryKey.columns.length > 1) {
      columnSql.push(`primary key (${primaryKey.columns.map((c) => this.quote(c)).join(', ')})`);
    }
    for (const index of blueprint.indexes) {
      if (index.type === 'unique' && index.columns.length > 1) {
        columnSql.push(`unique (${index.columns.map((c) => this.quote(c)).join(', ')})`);
      }
    }
    for (const foreign of blueprint.foreignKeys) {
      columnSql.push(
        `foreign key (${foreign.columns.map((c) => this.quote(c)).join(', ')}) references ${this.quote(foreign.on)} (${this.quote(foreign.references)})`,
      );
    }
    const create = `create table ${this.quote(blueprint.table)} (${columnSql.join(', ')})`;
    return [create, ...this.compileIndexes(blueprint)];
  }

  /** Compile a `Schema.table(...)` blueprint (per-driver alter support). */
  public compileAlter(blueprint: Blueprint): string[] {
    const statements: string[] = [];
    for (const column of blueprint.columns) {
      statements.push(`alter table ${this.quote(blueprint.table)} add column ${this.compileColumn(column)}`);
    }
    statements.push(...this.compileIndexes(blueprint));
    return statements;
  }

  public compileDrop(table: string): string {
    return `drop table if exists ${this.quote(table)}`;
  }

  /** The CREATE TABLE DDL for the framework's `migrations` batch table. */
  public createMigrationsTable(): string {
    return (
      `create table if not exists ${this.quote('migrations')} ` +
      `(${this.quote('id')} ${this.migrationsIdColumn()}, ${this.quote('migration')} ${this.migrationsNameColumn()}, ${this.quote('batch')} ${this.migrationsBatchColumn()})`
    );
  }

  protected migrationsIdColumn(): string {
    return 'integer primary key autoincrement';
  }

  protected migrationsNameColumn(): string {
    return 'text not null';
  }

  protected migrationsBatchColumn(): string {
    return 'integer not null';
  }

  /** Introspection: does `table` exist? Returns parameterized SQL. */
  public hasTableSql(table: string): { sql: string; bindings: unknown[] } {
    return {
      sql: `select name from sqlite_master where type = 'table' and name = ?`,
      bindings: [table],
    };
  }

  /** Introspection: list the column names of `table`. Returns parameterized SQL. */
  public columnListingSql(table: string): { sql: string; bindings: unknown[] } {
    return { sql: `pragma table_info(${table})`, bindings: [] };
  }

  /** List every user table (for migrate:fresh). Column aliased to `name`. */
  public listTablesSql(): { sql: string; bindings: unknown[] } {
    return { sql: `select name from sqlite_master where type = 'table' and name not like 'sqlite_%'`, bindings: [] };
  }

  public dropTableSql(table: string): string {
    return `drop table if exists ${this.quote(table)}`;
  }

  /** Statements run before the migrate:fresh drop pass (e.g. disabling FK checks). */
  public beforeDropAll(): string[] {
    return ['PRAGMA foreign_keys = OFF'];
  }

  /** Statements run after the migrate:fresh drop pass. */
  public afterDropAll(): string[] {
    return ['PRAGMA foreign_keys = ON'];
  }

  // ------------------------------------------------------------- columns

  public compileColumn(column: ColumnDefinition): string {
    const parts = [this.quote(column.name)];

    if (column.isAutoincrement) {
      parts.push(this.autoincrementType(column));
      return parts.join(' ');
    }

    parts.push(this.columnTypeSql(column));

    if (column.isPrimary) {
      parts.push('primary key');
    }

    if (column.type === 'enum' && column.check && this.enumUsesCheckConstraint()) {
      parts.push(`check (${this.quote(column.name)} in (${column.check.map((value) => `'${value.replace(/'/g, "''")}'`).join(', ')}))`);
    }

    if (!column.isNullable) {
      parts.push('not null');
    }

    if (column.hasDefault) {
      parts.push(`default ${this.compileDefault(column.defaultValue)}`);
    }

    if (column.isUnique) {
      parts.push('unique');
    }

    if (column.referencesColumn && column.referencesTable) {
      parts.push(`references ${this.quote(column.referencesTable)} (${this.quote(column.referencesColumn)})`);
    }

    return parts.join(' ');
  }

  protected abstract autoincrementType(column: ColumnDefinition): string;

  protected abstract columnTypeSql(column: ColumnDefinition): string;

  /** Native enums (MySQL) skip the SQLite/Postgres CHECK constraint. */
  protected enumUsesCheckConstraint(): boolean {
    return true;
  }

  protected compileDefault(value: unknown): string {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
    return `'${String(value)}'`;
  }

  // ------------------------------------------------------------ indexes

  protected compileIndexes(blueprint: Blueprint): string[] {
    const statements: string[] = [];
    for (const index of blueprint.indexes) {
      if (index.type === 'primary') continue;
      const columns = index.columns.map((c) => this.quote(c)).join(', ');
      if (index.type === 'unique') {
        statements.push(`create unique index ${this.quote(index.name ?? `${blueprint.table}_${index.columns.join('_')}_unique`)} on ${this.quote(blueprint.table)} (${columns})`);
      } else {
        statements.push(`create index ${this.quote(index.name ?? `${blueprint.table}_${index.columns.join('_')}_index`)} on ${this.quote(blueprint.table)} (${columns})`);
      }
    }
    return statements;
  }

  // ----------------------------------------------------------- helpers

  protected quote(identifier: string): string {
    return `${this.quoteChar}${identifier.replaceAll(this.quoteChar, this.quoteChar + this.quoteChar)}${this.quoteChar}`;
  }
}
