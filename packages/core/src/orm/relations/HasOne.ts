import type { Model } from '../Model';
import { HasOneOrMany } from './HasOneOrMany';

export class HasOne extends HasOneOrMany {
  protected groupResult(group: Model[] | undefined): Model | null {
    return group?.[0] ?? null;
  }
}
