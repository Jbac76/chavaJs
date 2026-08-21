import { Model } from '../../src/orm/Model';
import type { CastType } from '../../src/orm/Model';
import { User } from './User';

/**
 * Laravel Sanctum's personal_access_tokens model. The raw token is stored
 * sha256-hashed; the plain text is only shown once when created.
 */
export class PersonalAccessToken extends Model {
  public static tableName = 'personal_access_tokens';
  public static fillable: string[] = ['name', 'token', 'abilities', 'last_used_at', 'expires_at'];
  public static casts: Record<string, CastType> = {
    abilities: 'json',
  };

  /** The user that owns this token. */
  public user() {
    return this.belongsTo(User);
  }
}
