import type { Model } from '../Model';
import { HasOneOrMany } from './HasOneOrMany';

export class HasMany extends HasOneOrMany {
  protected groupResult(group: Model[] | undefined): Model[] {
    return group ?? [];
  }
}
