import { Builder } from '../../database/query/Builder';
import type { Model, ModelClass } from '../Model';
import { resolveMorphClass } from '../Model';
import { RuntimeException } from '../../support/exceptions';
import { Relation } from './Relation';

/**
 * Polymorphic inverse (Laravel: morphTo):
 *
 *   Image.imageable() => morphTo()
 *   → resolves the owning model from imageable_type + imageable_id.
 */
export class MorphTo extends Relation {
  private readonly morphType: string;
  private readonly morphId: string;

  public constructor(
    parent: Model,
    related: ModelClass,
    name: string,
    typeColumn: string,
    idColumn: string,
  ) {
    super(parent, related, idColumn, 'id');
    this.morphType = typeColumn;
    this.morphId = idColumn;
  }

  protected newQuery(): Builder {
    const target = this.resolveTarget();
    if (!target) {
      throw new RuntimeException(
        `No morph map entry for [${String(this.parent.getAttribute(this.morphType))}] — ` +
          `call Model.registerMorphClass(type, Class) or use a morphMany() that auto-registers it.`,
      );
    }
    return target.query().where(target.primaryKey, this.parent.getAttribute(this.morphId));
  }

  public eagerQuery(_keys: unknown[]): Builder {
    // MorphTo spans multiple target classes; eager loading is handled in eagerLoad().
    return this.related.query();
  }

  public override async eagerLoad(parents: Model[], name: string): Promise<void> {
    const byType = new Map<string, Model[]>();
    for (const parent of parents) {
      const type = parent.getAttribute(this.morphType);
      if (!type) {
        parent.setRelation(name, null);
        continue;
      }
      const group = byType.get(String(type)) ?? [];
      group.push(parent);
      byType.set(String(type), group);
    }

    for (const [type, group] of byType) {
      const target = resolveMorphClass(type);
      if (!target) continue;
      const keys = group
        .map((parent) => parent.getAttribute(this.morphId))
        .filter((value) => value !== null && value !== undefined);
      const related = (await target.query().whereIn(target.primaryKey, keys).get()) as Model[];
      const byId = new Map(related.map((model) => [String(model.getAttribute(target.primaryKey)), model]));
      for (const parent of group) {
        parent.setRelation(name, byId.get(String(parent.getAttribute(this.morphId))) ?? null);
      }
    }
  }

  public match(_parents: Model[], _related: Model[], _name: string): void {
    // Handled by eagerLoad above.
  }

  protected emptyResult(): unknown {
    return null;
  }

  private resolveTarget(): ModelClass | undefined {
    const type = this.parent.getAttribute(this.morphType);
    if (!type) return undefined;
    return resolveMorphClass(String(type));
  }
}
