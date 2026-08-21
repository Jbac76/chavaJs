import { Builder } from '../../database/query/Builder';
import type { Model, ModelClass } from '../Model';
import { Relation } from './Relation';

export class BelongsTo extends Relation {
  private readonly ownerKey: string;

  public constructor(
    parent: Model,
    related: ModelClass,
    foreignKey: string,
    ownerKey: string,
  ) {
    super(parent, related, foreignKey, ownerKey);
    this.ownerKey = ownerKey;
  }

  protected newQuery(): Builder {
    return this.related.query().where(this.ownerKey, this.parent.getAttribute(this.foreignKey));
  }

  public eagerQuery(keys: unknown[]): Builder {
    return this.related.query().whereIn(this.ownerKey, keys);
  }

  /** Inverse relations collect eager-load keys from the parent's foreign key. */
  protected override eagerLoadKey(): string {
    return this.foreignKey;
  }

  public match(parents: Model[], related: Model[], name: string): void {
    const groups = new Map<string, Model>();
    for (const model of related) {
      const key = String(model.getAttribute(this.ownerKey));
      if (!groups.has(key)) groups.set(key, model);
    }
    for (const parent of parents) {
      parent.setRelation(name, groups.get(String(parent.getAttribute(this.foreignKey))) ?? null);
    }
  }

  protected emptyResult(): unknown {
    return null;
  }

  /** Create a related (owner) model with the matching owner key. */
  public async create(attributes: Record<string, unknown> = {}): Promise<Model> {
    return this.related.createRaw({ ...attributes, [this.ownerKey]: this.parent.getAttribute(this.foreignKey) });
  }
}
