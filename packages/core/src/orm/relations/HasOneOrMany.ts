import { Builder } from '../../database/query/Builder';
import type { Model, ModelClass } from '../Model';
import { Relation } from './Relation';

export abstract class HasOneOrMany extends Relation {
  public constructor(
    parent: Model,
    related: ModelClass,
    foreignKey: string,
    localKey: string,
  ) {
    super(parent, related, foreignKey, localKey);
  }

  protected newQuery(): Builder {
    return this.related.query().where(this.foreignKey, this.parentKey());
  }

  public eagerQuery(keys: unknown[]): Builder {
    return this.related.query().whereIn(this.foreignKey, keys);
  }

  public match(parents: Model[], related: Model[], name: string): void {
    const groups = groupByValue(related, (model) => String(model.getAttribute(this.foreignKey)));
    for (const parent of parents) {
      parent.setRelation(name, this.groupResult(groups.get(String(parent.getAttribute(this.localKey)))));
    }
  }

  protected abstract groupResult(group: Model[] | undefined): unknown;

  /** Create a related model attached to this parent. */
  public async create(attributes: Record<string, unknown> = {}): Promise<Model> {
    return this.related.createRaw({ ...attributes, [this.foreignKey]: this.parentKey() });
  }

  /** Save an existing model as a child of this parent. */
  public async save(model: Model): Promise<Model> {
    model.setAttribute(this.foreignKey, this.parentKey());
    await model.save();
    return model;
  }
}

export function groupByValue(
  models: Model[],
  keyOf: (model: Model) => string,
): Map<string, Model[]> {
  const groups = new Map<string, Model[]>();
  for (const model of models) {
    const key = keyOf(model);
    const group = groups.get(key) ?? [];
    group.push(model);
    groups.set(key, group);
  }
  return groups;
}
