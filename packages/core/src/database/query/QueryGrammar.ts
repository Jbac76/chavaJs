import type { Row } from '../types';

export interface CompiledInsertGetId {
  sql: string;
  bindings: unknown[];
  /** Postgres returns the new key via `RETURNING` (read the row); SQLite/MySQL read `lastInsertRowid`. */
  returnsRow: boolean;
}

export interface CompiledUpsert {
  sql: string;
  bindings: unknown[];
}

/**
 * Laravel's query Grammar, ported. The Builder compiles driver-agnostic SQL
 * (`?` placeholders, `"quoted"` identifiers); each driver's grammar supplies
 * the pieces that differ — identifier quoting, `RANDOM()` vs `RAND()`,
 * `RETURNING` for `insertGetId`, and the upsert dialect (`ON CONFLICT` vs
 * `ON DUPLICATE KEY UPDATE`). SQLite is the base behaviour.
 */
export abstract class QueryGrammar {
  protected quoteChar = '"';

  /** Quote a single identifier (table or column name). */
  public wrap(identifier: string): string {
    return `${this.quoteChar}${identifier.replaceAll(this.quoteChar, this.quoteChar + this.quoteChar)}${this.quoteChar}`;
  }

  /** Quote a column, supporting `table.column`, `column AS alias`, and `*`. */
  public wrapColumn(column: string): string {
    return column
      .split(/\s+as\s+/i)
      .map((part) =>
        part
          .split('.')
          .map((segment) => (segment.trim() === '*' ? '*' : this.wrap(segment.trim())))
          .join('.'),
      )
      .join(' as ');
  }

  /** The driver's random-ordering expression (Laravel: ->inRandomOrder()). */
  public random(): string {
    return 'RANDOM()';
  }

  /** Compile an INSERT that returns the new primary key. */
  public compileInsertGetId(
    table: string,
    columns: string[],
    rows: Row[],
    primaryKey: string,
  ): CompiledInsertGetId {
    const compiled = this.compileInsert(table, columns, rows);
    return { ...compiled, returnsRow: false };
  }

  /** Compile an upsert (Laravel: ->upsert($values, $uniqueBy, $update)). */
  public compileUpsert(
    table: string,
    columns: string[],
    rows: Row[],
    uniqueBy: string[],
    updateColumns: string[],
  ): CompiledUpsert {
    const insert = this.compileInsert(table, columns, rows);
    if (updateColumns.length === 0) {
      return {
        sql: `${insert.sql} on conflict (${uniqueBy.map((c) => this.wrap(c)).join(', ')}) do nothing`,
        bindings: insert.bindings,
      };
    }
    const sets = updateColumns.map((column) => `${this.wrap(column)} = excluded.${this.wrap(column)}`).join(', ');
    return {
      sql: `${insert.sql} on conflict (${uniqueBy.map((c) => this.wrap(c)).join(', ')}) do update set ${sets}`,
      bindings: insert.bindings,
    };
  }

  /** Shared INSERT compilation (Laravel's compileInsert). */
  public compileInsert(table: string, columns: string[], rows: Row[]): { sql: string; bindings: unknown[] } {
    const bindings: unknown[] = [];
    const values = rows
      .map((row) => {
        const placeholders = columns.map((column) => {
          bindings.push(row[column]);
          return '?';
        });
        return `(${placeholders.join(', ')})`;
      })
      .join(', ');
    return {
      sql: `insert into ${this.wrap(table)} (${columns.map((c) => this.wrap(c)).join(', ')}) values ${values}`,
      bindings,
    };
  }
}
