import { Builder } from '../../database/query/Builder';
import type { Model, ModelClass } from '../Model';

/**
 * Base class for all relations — Laravel's Illuminate\Database\Eloquent\Relations\Relation.
 * Subclasses provide:
 *   - newQuery(): a builder constrained to this parent
 *   - eagerQuery(keys): a builder constrained to a set of parent keys
 *   - match(parents, related, name): distribute loaded models onto parents
 */
export abstract class Relation {
  private cachedQuery: Builder | null = null;

  public constructor(
    protected readonly parent: Model,
    protected readonly related: ModelClass,
    protected readonly foreignKey: string,
    protected readonly localKey: string,
  ) {}

  /**
   * The relation's persistent query builder. Fluent constraints (where(),
   * orderBy(), limit(), …) accumulate on the cached instance so that
   * `user.posts().where('title', 'X').get()` honours them — like Eloquent.
   */
  public getQuery(): Builder {
    if (!this.cachedQuery) {
      this.cachedQuery = this.newQuery();
    }
    return this.cachedQuery;
  }

  /** Build the constrained query for this parent (called once). */
  protected abstract newQuery(): Builder;

  /** Builder pre-constrained to a set of parent keys (for eager loading). */
  public abstract eagerQuery(keys: unknown[]): Builder;

  /** Distribute eagerly loaded related models onto the parent models. */
  public abstract match(parents: Model[], related: Model[], name: string): void;

  // ------------------------------------------------------------ retrieval

  public async get(): Promise<Model[]> {
    return (await this.getQuery().get()) as Model[];
  }

  public async first(): Promise<Model | undefined> {
    // Clone so first()'s internal limit(1) doesn't leak into later calls.
    return (await this.getQuery().clone().first()) as Model | undefined;
  }

  public async count(): Promise<number> {
    return this.getQuery().count();
  }

  public async exists(): Promise<boolean> {
    return this.getQuery().exists();
  }

  /**
   * The parent attribute used to collect keys for eager loading.
   * Most relations key off the parent's local key, but the inverse
   * (belongsTo / morphTo) must key off the foreign key instead.
   */
  protected eagerLoadKey(): string {
    return this.localKey;
  }

  /** Eager load this relation for a set of parent models. */
  public async eagerLoad(parents: Model[], name: string): Promise<void> {
    const keys = parents
      .map((parent) => parent.getAttribute(this.eagerLoadKey()))
      .filter((value) => value !== null && value !== undefined);
    if (keys.length === 0) {
      for (const parent of parents) parent.setRelation(name, this.emptyResult());
      return;
    }
    const related = (await this.eagerQuery(keys).get()) as Model[];
    this.match(parents, related, name);
  }

  protected emptyResult(): unknown {
    return [];
  }

  // -------------------------------------------------------- fluent passthrough

  public where(...args: unknown[]): this {
    this.getQuery().where(
      ...(args as [string | Record<string, unknown> | ((query: Builder) => void), unknown, unknown]),
    );
    return this;
  }

  public whereNull(column: string): this {
    this.getQuery().whereNull(column);
    return this;
  }

  public whereNotNull(column: string): this {
    this.getQuery().whereNotNull(column);
    return this;
  }

  public orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.getQuery().orderBy(column, direction);
    return this;
  }

  public orderByDesc(column: string): this {
    this.getQuery().orderByDesc(column);
    return this;
  }

  public latest(column = 'created_at'): this {
    this.getQuery().latest(column);
    return this;
  }

  public limit(limit: number): this {
    this.getQuery().limit(limit);
    return this;
  }

  public offset(offset: number): this {
    this.getQuery().offset(offset);
    return this;
  }

  public take(limit: number): this {
    return this.limit(limit);
  }

  public select(...columns: string[]): this {
    this.getQuery().select(...columns);
    return this;
  }

  public with(...relations: string[]): this {
    this.getQuery().with(...relations);
    return this;
  }

  // -------------------------------------------------------------- helpers

  protected parentKey(): unknown {
    return this.parent.getAttribute(this.localKey);
  }
}
