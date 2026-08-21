import { Builder } from '../../database/query/Builder';
import { Model } from '../Model';
import type { ModelClass } from '../Model';
import { groupByValue } from './HasOneOrMany';
import { Relation } from './Relation';

function singularizeTable(table: string): string {
  const value = table.endsWith('ies') ? `${table.slice(0, -3)}y` : table.endsWith('s') ? table.slice(0, -1) : table;
  return value;
}

/**
 * many-to-many relation backed by a pivot table (Laravel: belongsToMany).
 * Pivot columns are exposed on each related model as a `pivot` relation.
 */
export class BelongsToMany extends Relation {
  private readonly pivotTable: string;
  private readonly foreignPivotKey: string;
  private readonly relatedPivotKey: string;
  private readonly relatedKey: string;
  private readonly relatedTable: string;

  public constructor(
    parent: Model,
    related: ModelClass,
    pivotTable?: string,
    foreignPivotKey?: string,
    relatedPivotKey?: string,
    parentKey = 'id',
    relatedKey = 'id',
  ) {
    super(parent, related, foreignPivotKey ?? '', parentKey);
    const parentTable = parent.getTable();
    this.relatedTable = related.getTable();
    this.pivotTable = pivotTable ?? defaultPivotTable(parentTable, this.relatedTable);
    this.foreignPivotKey = foreignPivotKey ?? `${singularizeTable(parentTable)}_id`;
    this.relatedPivotKey = relatedPivotKey ?? `${singularizeTable(this.relatedTable)}_id`;
    this.relatedKey = relatedKey;
  }

  protected newQuery(): Builder {
    return this.baseQuery().where(`${this.pivotTable}.${this.foreignPivotKey}`, this.parentKey());
  }

  public eagerQuery(keys: unknown[]): Builder {
    return this.baseQuery().whereIn(`${this.pivotTable}.${this.foreignPivotKey}`, keys);
  }

  private baseQuery(): Builder {
    return this.related
      .query()
      .join(
        this.pivotTable,
        `${this.pivotTable}.${this.relatedPivotKey}`,
        '=',
        `${this.relatedTable}.${this.relatedKey}`,
      )
      .select(
        `${this.relatedTable}.*`,
        `${this.pivotTable}.${this.foreignPivotKey} as pivot_${this.foreignPivotKey}`,
        `${this.pivotTable}.${this.relatedPivotKey} as pivot_${this.relatedPivotKey}`,
      );
  }

  public match(parents: Model[], related: Model[], name: string): void {
    const groups = groupByValue(related, (model) => String(model.getAttribute(`pivot_${this.foreignPivotKey}`)));
    for (const parent of parents) {
      parent.setRelation(name, this.cleanPivot(groups.get(String(parent.getAttribute(this.localKey))) ?? []));
    }
  }

  /** Direct retrieval also cleans pivot columns into a `pivot` relation. */
  public override async get(): Promise<Model[]> {
    return this.cleanPivot(await super.get());
  }

  public override async first(): Promise<Model | undefined> {
    const model = await super.first();
    return model ? this.cleanPivot([model])[0] : undefined;
  }

  private cleanPivot(models: Model[]): Model[] {
    for (const model of models) {
      const pivot: Record<string, unknown> = {};
      const attributes = model.rawAttributes();
      for (const key of Object.keys(attributes)) {
        if (key.startsWith('pivot_')) {
          pivot[key.slice('pivot_'.length)] = attributes[key];
          delete attributes[key];
        }
      }
      model.setRelation('pivot', pivot);
    }
    return models;
  }

  /** Attach related models by id. */
  public async attach(ids: unknown | unknown[]): Promise<void> {
    const list = Array.isArray(ids) ? ids : [ids];
    for (const id of list) {
      await Model.getConnection().table(this.pivotTable).insert({
        [this.foreignPivotKey]: this.parentKey(),
        [this.relatedPivotKey]: id,
      });
    }
  }

  /** Detach related models by id (or all when no ids given). */
  public async detach(ids?: unknown | unknown[]): Promise<number> {
    const query = Model.getConnection().table(this.pivotTable).where(this.foreignPivotKey, this.parentKey());
    if (ids !== undefined) {
      query.whereIn(this.relatedPivotKey, Array.isArray(ids) ? ids : [ids]);
    }
    return query.delete();
  }

  /** Create a related model and attach it through the pivot. */
  public async create(attributes: Record<string, unknown> = {}): Promise<Model> {
    const related = await this.related.createRaw(attributes);
    await this.attach(related.getAttribute(this.relatedKey));
    return related;
  }
}

function defaultPivotTable(first: string, second: string): string {
  return [singularizeTable(first), singularizeTable(second)].sort().join('_');
}
