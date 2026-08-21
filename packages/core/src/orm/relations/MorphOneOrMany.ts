import { Builder } from '../../database/query/Builder';
import type { Model, ModelClass } from '../Model';
import { registerMorphClass } from '../Model';
import { groupByValue } from './HasOneOrMany';
import { Relation } from './Relation';

/**
 * Polymorphic one-to-many (Laravel: morphMany):
 *
 *   Post.images() => morphMany(Image, 'imageable')
 *   → Image rows where imageable_type = 'Post' and imageable_id = post.id
 */
export class MorphOneOrMany extends Relation {
  private readonly morphType: string;
  private readonly morphId: string;
  private readonly typeValue: string;

  public constructor(
    parent: Model,
    related: ModelClass,
    name: string,
    typeColumn: string,
    idColumn: string,
    typeValue?: string,
  ) {
    super(parent, related, idColumn, 'id');
    this.morphType = typeColumn;
    this.morphId = idColumn;
    this.typeValue = typeValue ?? (parent.constructor as ModelClass).getMorphClass();
    registerMorphClass(this.typeValue, parent.constructor as ModelClass);
  }

  protected newQuery(): Builder {
    return this.related
      .query()
      .where(this.morphType, this.typeValue)
      .where(this.morphId, this.parentKey());
  }

  public eagerQuery(keys: unknown[]): Builder {
    return this.related.query().where(this.morphType, this.typeValue).whereIn(this.morphId, keys);
  }

  public match(parents: Model[], related: Model[], name: string): void {
    const groups = groupByValue(related, (model) => String(model.getAttribute(this.morphId)));
    for (const parent of parents) {
      parent.setRelation(name, this.groupResult(groups.get(String(parent.getAttribute('id')))));
    }
  }

  protected groupResult(group: Model[] | undefined): Model[] {
    return group ?? [];
  }

  public async create(attributes: Record<string, unknown> = {}): Promise<Model> {
    return this.related.createRaw({
      ...attributes,
      [this.morphType]: this.typeValue,
      [this.morphId]: this.parentKey(),
    });
  }
}
