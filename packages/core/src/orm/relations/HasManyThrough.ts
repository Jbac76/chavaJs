import { Builder } from '../../database/query/Builder';
import type { Model, ModelClass } from '../Model';
import { groupByValue } from './HasOneOrMany';
import { Relation } from './Relation';

/**
 * Laravel's hasManyThrough: fetch related rows through an intermediate table.
 *
 *   Country hasManyThrough Post, via User:
 *   posts JOIN users ON users.id = posts.user_id  WHERE users.country_id IN (...)
 */
export class HasManyThrough extends Relation {
  private readonly through: ModelClass;
  private readonly firstKey: string;
  private readonly secondKey: string;
  private readonly throughKey: string;
  private readonly relatedTable: string;
  private readonly throughTable: string;

  public constructor(
    parent: Model,
    related: ModelClass,
    through: ModelClass,
    firstKey: string,
    secondKey: string,
    localKey = 'id',
    throughKey = 'id',
  ) {
    super(parent, related, firstKey, localKey);
    this.through = through;
    this.firstKey = firstKey;
    this.secondKey = secondKey;
    this.throughKey = throughKey;
    this.relatedTable = related.getTable();
    this.throughTable = through.getTable();
  }

  protected newQuery(): Builder {
    return this.baseQuery().where(`${this.throughTable}.${this.firstKey}`, this.parentKey());
  }

  public eagerQuery(keys: unknown[]): Builder {
    return this.baseQuery().whereIn(`${this.throughTable}.${this.firstKey}`, keys);
  }

  private baseQuery(): Builder {
    return this.related
      .query()
      .join(
        this.throughTable,
        `${this.throughTable}.${this.throughKey}`,
        '=',
        `${this.relatedTable}.${this.secondKey}`,
      )
      .select(
        `${this.relatedTable}.*`,
        `${this.throughTable}.${this.firstKey} as __through_${this.firstKey}`,
      );
  }

  public match(parents: Model[], related: Model[], name: string): void {
    const groups = groupByValue(related, (model) => String(model.getAttribute(`__through_${this.firstKey}`)));
    for (const parent of parents) {
      parent.setRelation(name, this.stripThroughKey(groups.get(String(parent.getAttribute(this.localKey))) ?? []));
    }
  }

  private stripThroughKey(models: Model[]): Model[] {
    for (const model of models) {
      delete model.rawAttributes()[`__through_${this.firstKey}`];
    }
    return models;
  }

  protected emptyResult(): unknown {
    return [];
  }
}
