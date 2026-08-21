import type { Row } from '../types';
import { QueryGrammar, type CompiledInsertGetId } from './QueryGrammar';

/**
 * Postgres query grammar. Two divergences from the base:
 * - `insertGetId` appends `RETURNING "pk"` and returns the row (Postgres
 *   has no `lastInsertRowid`), which `Model.save()` reads for the new key.
 * - `RANDOM()` matches the base (Postgres uses RANDOM()).
 *
 * Placeholders are rewritten from `?` to `$1..$n` by PostgresConnection at
 * execution time (a per-statement scan that skips string literals), keeping
 * the Builder driver-agnostic.
 */
export class PostgresQueryGrammar extends QueryGrammar {
  public override compileInsertGetId(
    table: string,
    columns: string[],
    rows: Row[],
    primaryKey: string,
  ): CompiledInsertGetId {
    const insert = this.compileInsert(table, columns, rows);
    return {
      sql: `${insert.sql} returning ${this.wrap(primaryKey)}`,
      bindings: insert.bindings,
      returnsRow: true,
    };
  }
}
