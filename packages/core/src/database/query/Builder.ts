import { NotFoundException, RuntimeException } from '../../support/exceptions';
import type { Model, ModelClass } from '../../orm/Model';
import type { DatabaseManager } from '../DatabaseManager';
import type { Connection, Row } from '../types';

export type WhereBoolean = 'and' | 'or';

interface BasicWhere {
  type: 'basic';
  column: string;
  operator: string;
  value: unknown;
  boolean: WhereBoolean;
  not?: boolean;
}
interface InWhere {
  type: 'in';
  column: string;
  values: unknown[];
  boolean: WhereBoolean;
  not: boolean;
}
interface NullWhere {
  type: 'null';
  column: string;
  boolean: WhereBoolean;
  not: boolean;
}
interface BetweenWhere {
  type: 'between';
  column: string;
  values: [unknown, unknown];
  boolean: WhereBoolean;
  not: boolean;
}
interface ColumnWhere {
  type: 'column';
  first: string;
  operator: string;
  second: string;
  boolean: WhereBoolean;
}
interface NestedWhere {
  type: 'nested';
  query: Builder;
  boolean: WhereBoolean;
}
type WhereClause = BasicWhere | InWhere | NullWhere | BetweenWhere | ColumnWhere | NestedWhere;

interface JoinClause {
  table: string;
  first: string;
  operator: string;
  second: string;
  type: 'inner' | 'left' | 'right' | 'cross';
}

interface OrderClause {
  column: string;
  direction: 'asc' | 'desc';
  /** Skip identifier quoting (raw SQL expressions like RANDOM()). */
  raw?: boolean;
}

interface HavingClause {
  column: string;
  operator: string;
  value: unknown;
  boolean: WhereBoolean;
}

const OPERATORS = new Set(['=', '<', '>', '<=', '>=', '<>', '!=', 'like', 'not like', 'ilike', 'not ilike']);

function isOperator(value: string): boolean {
  return OPERATORS.has(value.toLowerCase());
}

/**
 * Laravel's query builder, ported. Fluent API (`where`, `orWhere`, `whereIn`,
 * `orderBy`, `joins`, `paginate`, `chunk`, …) compiled to parameterized SQL.
 * When created through `Model.query()` it hydrates model instances, applies
 * global scopes (soft deletes) and supports eager loading via `with()`.
 */
export class Builder<T = unknown> {
  public table: string;
  public model: ModelClass | null = null;

  private readonly manager: DatabaseManager;
  private selectColumns: string[] = [];
  private distinctFlag = false;
  private readonly joins: JoinClause[] = [];
  private readonly wheres: WhereClause[] = [];
  private readonly groups: string[] = [];
  private readonly havings: HavingClause[] = [];
  private readonly orders: OrderClause[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private readonly eagerLoads: string[] = [];
  private withTrashedFlag = false;
  private softDeleteScopeIndex: number | null = null;

  public constructor(manager: DatabaseManager) {
    this.manager = manager;
    this.table = '';
  }

  protected conn(): Connection {
    return this.manager.connection();
  }

  /** The default connection's query grammar (quoting, RANDOM/RAND, upsert). */
  protected grammar(): import('./QueryGrammar').QueryGrammar {
    return this.manager.queryGrammar();
  }

  // --------------------------------------------------------------- from/select

  public from(table: string): this {
    this.table = table;
    return this;
  }

  public select(...columns: string[]): this {
    this.selectColumns = columns;
    return this;
  }

  public addSelect(...columns: string[]): this {
    this.selectColumns.push(...columns);
    return this;
  }

  public distinct(): this {
    this.distinctFlag = true;
    return this;
  }

  // ---------------------------------------------------------------- joins

  public join(table: string, first: string, operator: string, second: string): this {
    this.joins.push({ table, first, operator, second, type: 'inner' });
    return this;
  }

  public leftJoin(table: string, first: string, operator: string, second: string): this {
    this.joins.push({ table, first, operator, second, type: 'left' });
    return this;
  }

  public rightJoin(table: string, first: string, operator: string, second: string): this {
    this.joins.push({ table, first, operator, second, type: 'right' });
    return this;
  }

  public crossJoin(table: string): this {
    this.joins.push({ table, first: '', operator: '', second: '', type: 'cross' });
    return this;
  }

  // ---------------------------------------------------------------- wheres

  public where(column: string | Record<string, unknown> | ((query: Builder) => void), operator?: unknown, value?: unknown): this {
    if (typeof column === 'function') {
      const nested = this.newNestedBuilder();
      column(nested);
      this.wheres.push({ type: 'nested', query: nested, boolean: 'and' });
      return this;
    }
    if (typeof column === 'object' && column !== null) {
      for (const [key, val] of Object.entries(column)) {
        if (Array.isArray(val)) {
          this.whereIn(key, val);
        } else {
          this.addBasicWhere(key, '=', val, 'and');
        }
      }
      return this;
    }
    // where('active'), where('age', '>', 18), where('name', 'John')
    if (arguments.length === 1) {
      return this.addBasicWhere(column, '=', true, 'and');
    }
    if (arguments.length === 2) {
      return this.addBasicWhere(column, '=', operator, 'and');
    }
    const op = isOperator(String(operator)) ? String(operator) : '=';
    return this.addBasicWhere(column, op, value, 'and');
  }

  public orWhere(column: string | ((query: Builder) => void), operator?: unknown, value?: unknown): this {
    if (typeof column === 'function') {
      const nested = this.newNestedBuilder();
      column(nested);
      this.wheres.push({ type: 'nested', query: nested, boolean: 'or' });
      return this;
    }
    if (arguments.length === 2) {
      return this.addBasicWhere(column, '=', operator, 'or');
    }
    return this.addBasicWhere(column, isOperator(String(operator)) ? String(operator) : '=', value, 'or');
  }

  /** Laravel's whereNot: `not (column op value)`. */
  public whereNot(column: string, operator: unknown, value: unknown): this {
    this.wheres.push({
      type: 'basic',
      column,
      operator: isOperator(String(operator)) ? String(operator) : '=',
      value,
      boolean: 'and',
      not: true,
    });
    return this;
  }

  public whereIn(column: string, values: unknown[]): this {
    this.wheres.push({ type: 'in', column, values, boolean: 'and', not: false });
    return this;
  }

  public orWhereIn(column: string, values: unknown[]): this {
    this.wheres.push({ type: 'in', column, values, boolean: 'or', not: false });
    return this;
  }

  public whereNotIn(column: string, values: unknown[]): this {
    this.wheres.push({ type: 'in', column, values, boolean: 'and', not: true });
    return this;
  }

  public whereNull(column: string): this {
    this.wheres.push({ type: 'null', column, boolean: 'and', not: false });
    return this;
  }

  public orWhereNull(column: string): this {
    this.wheres.push({ type: 'null', column, boolean: 'or', not: false });
    return this;
  }

  public whereNotNull(column: string): this {
    this.wheres.push({ type: 'null', column, boolean: 'and', not: true });
    return this;
  }

  public whereBetween(column: string, values: [unknown, unknown]): this {
    this.wheres.push({ type: 'between', column, values, boolean: 'and', not: false });
    return this;
  }

  public whereNotBetween(column: string, values: [unknown, unknown]): this {
    this.wheres.push({ type: 'between', column, values, boolean: 'and', not: true });
    return this;
  }

  public whereColumn(first: string, operator: string, second: string): this {
    this.wheres.push({ type: 'column', first, operator, second, boolean: 'and' });
    return this;
  }

  private addBasicWhere(column: string, operator: string, value: unknown, boolean: WhereBoolean): this {
    this.wheres.push({ type: 'basic', column, operator, value, boolean });
    return this;
  }

  private newNestedBuilder(): Builder {
    const nested = new Builder(this.manager);
    nested.table = this.table;
    return nested;
  }

  // ------------------------------------------------------------ group/order

  public groupBy(...columns: string[]): this {
    this.groups.push(...columns);
    return this;
  }

  public having(column: string, operator: string, value: unknown): this {
    this.havings.push({ column, operator, value, boolean: 'and' });
    return this;
  }

  public orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orders.push({ column, direction: direction.toLowerCase() === 'desc' ? 'desc' : 'asc' });
    return this;
  }

  public orderByDesc(column: string): this {
    return this.orderBy(column, 'desc');
  }

  public latest(column = 'created_at'): this {
    return this.orderBy(column, 'desc');
  }

  public oldest(column = 'created_at'): this {
    return this.orderBy(column, 'asc');
  }

  public inRandomOrder(): this {
    this.orders.push({ column: this.grammar().random(), direction: 'asc', raw: true });
    return this;
  }

  public limit(limit: number): this {
    this.limitValue = limit;
    return this;
  }

  public take(limit: number): this {
    return this.limit(limit);
  }

  public offset(offset: number): this {
    this.offsetValue = offset;
    return this;
  }

  public skip(offset: number): this {
    return this.offset(offset);
  }

  // ------------------------------------------------------------- retrieval

  public async first(): Promise<T | undefined> {
    const rows = await this.limit(1).get();
    return rows[0];
  }

  public async firstOrFail(): Promise<T> {
    const result = await this.first();
    if (result === undefined) {
      throw new NotFoundException('No query results for model.');
    }
    return result;
  }

  public async get(): Promise<T[]> {
    const compiled = this.compileSelect();
    const rows = await this.conn().query<Row>(compiled.sql, compiled.bindings);

    if (!this.model) return rows as T[];

    // Capture in a local so the narrowing survives the await above.
    const model = this.model;
    let models = rows.map((row) => model.newFromBuilder(row));
    if (this.eagerLoads.length > 0 && models.length > 0) {
      models = await this.eagerLoadRelations(models, this.eagerLoads);
    }
    return models as T[];
  }

  public async find(id: unknown): Promise<T | undefined> {
    return this.where(this.model ? this.model.primaryKey : 'id', id).first();
  }

  public async value(column: string): Promise<unknown> {
    const row = (await this.first()) as Row | undefined;
    return row?.[column];
  }

  public async pluck(column: string): Promise<unknown[]> {
    const rows = await this.get();
    return rows.map((row) => (row as Row)[column]);
  }

  public async exists(): Promise<boolean> {
    const compiled = this.compileAggregate('COUNT', '*');
    const row = await this.conn().first<Row>(compiled.sql, compiled.bindings);
    return Number(row?.aggregate ?? 0) > 0;
  }

  public async doesntExist(): Promise<boolean> {
    return !(await this.exists());
  }

  // ----------------------------------------------------------- aggregates

  public async count(column = '*'): Promise<number> {
    return (await this.runAggregate('COUNT', column)) ?? 0;
  }

  public async min(column: string): Promise<number | null> {
    return this.runAggregate('MIN', column);
  }

  public async max(column: string): Promise<number | null> {
    return this.runAggregate('MAX', column);
  }

  public async avg(column: string): Promise<number | null> {
    return this.runAggregate('AVG', column);
  }

  public async sum(column: string): Promise<number> {
    return (await this.runAggregate('SUM', column)) ?? 0;
  }

  private async runAggregate(fn: string, column: string): Promise<number | null> {
    const compiled = this.compileAggregate(fn, column);
    const row = await this.conn().first<Row>(compiled.sql, compiled.bindings);
    const value = row?.aggregate;
    return value === null || value === undefined ? null : Number(value);
  }

  // -------------------------------------------------------------- paginate

  public async paginate(perPage = 15, page = 1): Promise<Paginator<T>> {
    const total = (await this.cloneWithoutOrdersLimits().runAggregate('COUNT', '*')) ?? 0;
    const from = total === 0 ? null : (page - 1) * perPage + 1;
    const to = total === 0 ? null : Math.min(page * perPage, total);
    const data = await this.clone().limit(perPage).offset((page - 1) * perPage).get();

    return {
      data,
      current_page: page,
      last_page: Math.max(1, Math.ceil(total / perPage)),
      per_page: perPage,
      total,
      from,
      to,
    };
  }

  public async chunk(size: number, callback: (items: T[], page: number) => boolean | void): Promise<void> {
    let page = 1;
    for (;;) {
      const items = await this.clone().limit(size).offset((page - 1) * size).get();
      if (items.length === 0) break;
      const shouldContinue = await callback(items, page);
      if (shouldContinue === false) break;
      if (items.length < size) break;
      page++;
    }
  }

  // ------------------------------------------------------------ conditionals

  /** Laravel's ->when($condition, $callback) conditional query builder. */
  public when(condition: unknown, callback: (query: this, value: unknown) => this | void, fallback?: (query: this) => this | void): this {
    if (condition) {
      callback(this, condition);
    } else if (fallback) {
      fallback(this);
    }
    return this;
  }

  // ---------------------------------------------------------------- inserts

  public async insert(values: Record<string, unknown> | Record<string, unknown>[]): Promise<boolean> {
    const rows = Array.isArray(values) ? values : [values];
    if (rows.length === 0) return false;
    const { sql, bindings } = this.compileInsert(rows);
    await this.conn().run(sql, bindings);
    return true;
  }

  /**
   * Insert and return the new primary key (Laravel: insertGetId). Postgres
   * compiles `RETURNING "id"` (no lastInsertRowid there); SQLite/MySQL read
   * the driver's lastInsertRowid.
   */
  public async insertGetId(values: Record<string, unknown>): Promise<number> {
    const primaryKey = this.model ? this.model.primaryKey : 'id';
    const compiled = this.grammar().compileInsertGetId(this.table, Object.keys(values), [values], primaryKey);
    if (compiled.returnsRow) {
      const row = await this.conn().first<Row>(compiled.sql, compiled.bindings);
      const value = row?.[primaryKey];
      return value === undefined || value === null ? 0 : Number(value);
    }
    const result = await this.conn().run(compiled.sql, compiled.bindings);
    return result.lastInsertRowid;
  }

  /**
   * Insert rows, updating on unique-key conflict (Laravel: ->upsert()).
   * `uniqueBy` names the columns that define a conflict; `update` optionally
   * overrides which columns are updated (default: all non-unique columns).
   */
  public async upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    uniqueBy: string[],
    update?: string[],
  ): Promise<number> {
    const rows = Array.isArray(values) ? values : [values];
    if (rows.length === 0) return 0;
    const columns = Object.keys(rows[0]);
    const updateColumns = update ?? columns.filter((column) => !uniqueBy.includes(column));
    const compiled = this.grammar().compileUpsert(this.table, columns, rows, uniqueBy, updateColumns);
    const result = await this.conn().run(compiled.sql, compiled.bindings);
    return result.changes;
  }

  // ---------------------------------------------------------------- updates

  public async update(values: Record<string, unknown>): Promise<number> {
    const compiled = this.compileUpdate(values);
    const result = await this.conn().run(compiled.sql, compiled.bindings);
    return result.changes;
  }

  public async increment(column: string, amount = 1): Promise<number> {
    const compiled = this.compileUpdateWithExpression(column, `${column} + ?`, [amount]);
    const result = await this.conn().run(compiled.sql, compiled.bindings);
    return result.changes;
  }

  public async decrement(column: string, amount = 1): Promise<number> {
    const compiled = this.compileUpdateWithExpression(column, `${column} - ?`, [amount]);
    const result = await this.conn().run(compiled.sql, compiled.bindings);
    return result.changes;
  }

  // ---------------------------------------------------------------- delete

  public async delete(): Promise<number> {
    if (this.model && this.model.softDeletes && !this.withTrashedFlag) {
      // Soft delete: Laravel's Model::where(...)->delete() behaviour.
      return this.update({ [this.model.softDeleteColumn]: new Date() });
    }
    const compiled = this.compileDelete();
    const result = await this.conn().run(compiled.sql, compiled.bindings);
    return result.changes;
  }

  /** Delete rows regardless of the soft-delete scope. */
  public async forceDelete(): Promise<number> {
    const compiled = this.compileDelete();
    const result = await this.conn().run(compiled.sql, compiled.bindings);
    return result.changes;
  }

  public async truncate(): Promise<void> {
    await this.conn().exec(`DELETE FROM ${this.grammar().wrap(this.table)}`);
  }

  // ------------------------------------------------------------- eager load

  /** Register relations to eager load (Laravel: ->with('posts.author')). */
  public with(...relations: string[]): this {
    this.eagerLoads.push(...relations);
    return this;
  }

  /** Set the model class; switches hydration + global scopes on. */
  public setModel(model: ModelClass): this {
    this.model = model;
    if (model.softDeletes && !this.withTrashedFlag) {
      const qualifiedColumn = `${this.table}.${model.softDeleteColumn}`;
      this.wheres.push({ type: 'null', column: qualifiedColumn, boolean: 'and', not: false });
      this.softDeleteScopeIndex = this.wheres.length - 1;
    }
    return this;
  }

  /** Skip the soft-delete scope (Laravel: ->withTrashed()). */
  public withTrashed(): this {
    this.withTrashedFlag = true;
    this.removeSoftDeleteScope();
    return this;
  }

  /** Only trashed rows (Laravel: ->onlyTrashed()). */
  public onlyTrashed(): this {
    this.withTrashedFlag = true;
    this.removeSoftDeleteScope();
    if (this.model) {
      const qualifiedColumn = `${this.table}.${this.model.softDeleteColumn}`;
      this.whereNotNull(qualifiedColumn);
    }
    return this;
  }

  /** Remove just the soft-delete scope clause, keeping user wheres intact. */
  private removeSoftDeleteScope(): void {
    if (this.softDeleteScopeIndex !== null && this.wheres[this.softDeleteScopeIndex]) {
      this.wheres.splice(this.softDeleteScopeIndex, 1);
    }
    this.softDeleteScopeIndex = null;
  }

  private async eagerLoadRelations(models: Model[], relations: string[]): Promise<Model[]> {
    for (const relation of relations) {
      const [name, ...rest] = relation.split('.');
      const firstModel = models[0];
      const relationInstance = firstModel?.relationInstance(name);
      if (!relationInstance) {
        throw new RuntimeException(
          `Relation [${name}] not found on model [${firstModel?.constructor.name}]. ` +
            `Define a method ${name}() that returns a relation.`,
        );
      }
      await relationInstance.eagerLoad(models, name);
      if (rest.length > 0) {
        const nested = models.flatMap((model) => (model.getRelation(name) as Model[] | undefined) ?? []);
        if (nested.length > 0) {
          await this.eagerLoadRelations(nested, [rest.join('.')]);
        }
      }
    }
    return models;
  }

  // ------------------------------------------------------------------ SQL

  public toSql(): { sql: string; bindings: unknown[] } {
    return this.compileSelect();
  }

  protected compileSelect(): { sql: string; bindings: unknown[] } {
    const bindings: unknown[] = [];
    const parts: string[] = [];
    const distinct = this.distinctFlag ? 'distinct ' : '';
    const columns = this.selectColumns.length > 0 ? this.selectColumns.map((c) => this.grammar().wrapColumn(c)).join(', ') : '*';
    parts.push(`select ${distinct}${columns} from ${this.grammar().wrap(this.table)}`);

    for (const join of this.joins) {
      if (join.type === 'cross') {
        parts.push(`cross join ${this.grammar().wrap(join.table)}`);
      } else {
        const operator = isOperator(join.operator) ? join.operator : '=';
        parts.push(
          `${join.type} join ${this.grammar().wrap(join.table)} on ${this.grammar().wrapColumn(join.first)} ${operator} ${this.grammar().wrapColumn(join.second)}`,
        );
      }
    }

    const whereSql = this.compileWheres(bindings);
    if (whereSql) parts.push(whereSql);
    if (this.groups.length > 0) parts.push(`group by ${this.groups.map((c) => this.grammar().wrapColumn(c)).join(', ')}`);
    if (this.havings.length > 0) {
      parts.push(
        `having ${this.havings
          .map((having, index) => {
            bindings.push(having.value);
            return `${index > 0 ? having.boolean + ' ' : ''}${this.grammar().wrapColumn(having.column)} ${having.operator} ?`;
          })
          .join(' ')}`,
      );
    }
    if (this.orders.length > 0) {
      parts.push(
        `order by ${this.orders.map((order) => `${order.raw ? order.column : this.grammar().wrapColumn(order.column)} ${order.direction}`).join(', ')}`,
      );
    }
    if (this.limitValue !== null) {
      bindings.push(this.limitValue);
      parts.push('limit ?');
    }
    if (this.offsetValue !== null) {
      bindings.push(this.offsetValue);
      parts.push('offset ?');
    }
    return { sql: parts.join(' '), bindings };
  }

  private compileAggregate(fn: string, column: string): { sql: string; bindings: unknown[] } {
    if (this.groups.length > 0 || this.havings.length > 0) {
      // Grouped aggregates must count the groups themselves — Laravel wraps
      // the grouped select in a subquery so totals stay correct.
      const inner = this.compileSelect();
      return {
        sql: `select count(*) as aggregate from (${inner.sql}) as aggregate_table`,
        bindings: inner.bindings,
      };
    }
    const bindings: unknown[] = [];
    const parts: string[] = [
      `select ${fn}(${column === '*' ? '*' : this.grammar().wrapColumn(column)}) as aggregate from ${this.grammar().wrap(this.table)}`,
    ];
    for (const join of this.joins) {
      parts.push(`${join.type} join ${this.grammar().wrap(join.table)} on ${this.grammar().wrapColumn(join.first)} = ${this.grammar().wrapColumn(join.second)}`);
    }
    const whereSql = this.compileWheres(bindings);
    if (whereSql) parts.push(whereSql);
    return { sql: parts.join(' '), bindings };
  }

  private compileWheres(bindings: unknown[]): string {
    if (this.wheres.length === 0) return '';
    const parts: string[] = [];
    for (const clause of this.wheres) {
      const body = this.compileWhere(clause, bindings);
      if (!body) continue;
      if (parts.length > 0) parts.push(clause.boolean);
      parts.push(body);
    }
    if (parts.length === 0) return '';
    return `where ${parts.join(' ')}`;
  }

  private compileWhere(clause: WhereClause, bindings: unknown[]): string {
    switch (clause.type) {
      case 'basic': {
        bindings.push(clause.value);
        const body = `${this.grammar().wrapColumn(clause.column)} ${clause.operator} ?`;
        return clause.not ? `not (${body})` : body;
      }
      case 'in': {
        if (clause.values.length === 0) {
          return clause.not ? '1 = 1' : '0 = 1';
        }
        bindings.push(...clause.values);
        return `${this.grammar().wrapColumn(clause.column)} ${clause.not ? 'not ' : ''}in (${clause.values.map(() => '?').join(', ')})`;
      }
      case 'null':
        return `${this.grammar().wrapColumn(clause.column)} is ${clause.not ? 'not ' : ''}null`;
      case 'between': {
        bindings.push(clause.values[0], clause.values[1]);
        return `${this.grammar().wrapColumn(clause.column)} ${clause.not ? 'not ' : ''}between ? and ?`;
      }
      case 'column':
        return `${this.grammar().wrapColumn(clause.first)} ${clause.operator} ${this.grammar().wrapColumn(clause.second)}`;
      case 'nested': {
        const nestedBindings: unknown[] = [];
        const nestedSql = clause.query.compileWheres(nestedBindings);
        if (!nestedSql) return '';
        bindings.push(...nestedBindings);
        return `(${nestedSql.replace(/^where\s+/, '')})`;
      }
    }
  }

  private compileInsert(rows: Record<string, unknown>[]): { sql: string; bindings: unknown[] } {
    const columns = Object.keys(rows[0]);
    const { sql, bindings } = this.grammar().compileInsert(this.table, columns, rows);
    return { sql, bindings };
  }

  private compileUpdate(values: Record<string, unknown>): { sql: string; bindings: unknown[] } {
    const bindings: unknown[] = [];
    const sets = Object.entries(values)
      .map(([column, value]) => {
        bindings.push(value);
        return `${this.grammar().wrap(column)} = ?`;
      })
      .join(', ');
    const whereSql = this.compileWheres(bindings);
    const where = whereSql ? ` ${whereSql}` : '';
    return { sql: `update ${this.grammar().wrap(this.table)} set ${sets}${where}`, bindings };
  }

  private compileUpdateWithExpression(column: string, expression: string, expressionBindings: unknown[]): { sql: string; bindings: unknown[] } {
    const bindings: unknown[] = [...expressionBindings];
    const whereSql = this.compileWheres(bindings);
    const where = whereSql ? ` ${whereSql}` : '';
    return {
      sql: `update ${this.grammar().wrap(this.table)} set ${this.grammar().wrap(column)} = ${expression}${where}`,
      bindings,
    };
  }

  private compileDelete(): { sql: string; bindings: unknown[] } {
    const bindings: unknown[] = [];
    const whereSql = this.compileWheres(bindings);
    const where = whereSql ? ` ${whereSql}` : '';
    return { sql: `delete from ${this.grammar().wrap(this.table)}${where}`, bindings };
  }

  // --------------------------------------------------------------- cloning

  public clone(): Builder<T> {
    const copy = new Builder<T>(this.manager);
    copy.table = this.table;
    copy.model = this.model;
    copy.selectColumns = [...this.selectColumns];
    copy.distinctFlag = this.distinctFlag;
    copy.joins.push(...this.joins);
    copy.wheres.push(...this.wheres);
    copy.groups.push(...this.groups);
    copy.havings.push(...this.havings);
    copy.orders.push(...this.orders);
    copy.limitValue = this.limitValue;
    copy.offsetValue = this.offsetValue;
    copy.eagerLoads.push(...this.eagerLoads);
    copy.withTrashedFlag = this.withTrashedFlag;
    copy.softDeleteScopeIndex = this.softDeleteScopeIndex;
    return copy;
  }

  private cloneWithoutOrdersLimits(): Builder<T> {
    const copy = this.clone();
    copy.orders.length = 0;
    copy.limitValue = null;
    copy.offsetValue = null;
    return copy;
  }
}

export interface Paginator<T = unknown> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}
