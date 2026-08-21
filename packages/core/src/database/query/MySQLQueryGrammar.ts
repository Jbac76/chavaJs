import type { Row } from '../types';
import { QueryGrammar, type CompiledUpsert } from './QueryGrammar';

/**
 * MySQL query grammar. Divergences from the base:
 * - Identifiers are quoted with backticks.
 * - `inRandomOrder()` uses `RAND()` (MySQL has no RANDOM()).
 * - Upserts use `ON DUPLICATE KEY UPDATE` with `VALUES(col)` (MySQL has no
 *   `ON CONFLICT` / `excluded`).
 * - `insertGetId` reads the driver's `lastInsertRowid` (the base path).
 */
export class MySQLQueryGrammar extends QueryGrammar {
  protected override quoteChar = '`';

  public override random(): string {
    return 'RAND()';
  }

  public override compileUpsert(
    table: string,
    columns: string[],
    rows: Row[],
    uniqueBy: string[],
    updateColumns: string[],
  ): CompiledUpsert {
    const insert = this.compileInsert(table, columns, rows);
    if (updateColumns.length === 0) {
      // MySQL has no DO NOTHING — a no-op update on the first unique column.
      const noop = uniqueBy[0] ?? columns[0];
      return {
        sql: `${insert.sql} on duplicate key update ${this.wrap(noop)} = ${this.wrap(noop)}`,
        bindings: insert.bindings,
      };
    }
    const sets = updateColumns.map((column) => `${this.wrap(column)} = values(${this.wrap(column)})`).join(', ');
    return {
      sql: `${insert.sql} on duplicate key update ${sets}`,
      bindings: insert.bindings,
    };
  }
}
