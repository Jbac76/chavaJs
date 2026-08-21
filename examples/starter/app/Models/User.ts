import { randomBytes } from 'node:crypto';
import { currentApp } from '../../src/foundation/registry';
import type { CastType } from '../../src/orm/Model';
import { Notifiable } from '../../src/notifications/Notifiable';
import type { Gate } from '../../src/auth/Gate';
import { sha256 } from '../../src/auth/Hash';
import { Post } from './Post';
import { PersonalAccessToken } from './PersonalAccessToken';

export class User extends Notifiable {
  public static fillable: string[] = ['name', 'email', 'password', 'is_admin', 'email_verified_at'];
  public static hidden: string[] = ['password'];
  public static softDeletes = true;
  public static casts: Record<string, CastType> = {
    is_admin: 'boolean',
    email_verified_at: 'datetime',
  };

  /** One-to-many: a user owns many posts. */
  public posts() {
    return this.hasMany(Post);
  }

  /** One-to-many: personal access tokens (Sanctum-style API auth). */
  public tokens() {
    return this.hasMany(PersonalAccessToken);
  }

  /** Whether the email address has been verified (Laravel: hasVerifiedEmail()). */
  public hasVerifiedEmail(): boolean {
    const value = this.getAttribute('email_verified_at');
    return value !== null && value !== undefined;
  }

  /** Gate abilities against this user (Laravel: $user->can('delete', $post)). */
  public async can(ability: string, ...args: unknown[]): Promise<boolean> {
    return currentApp().make<Gate>('gate').forUser(this).allows(ability, ...args);
  }

  public async cannot(ability: string, ...args: unknown[]): Promise<boolean> {
    return !(await this.can(ability, ...args));
  }

  /**
   * Issue a personal access token (Laravel Sanctum: createToken()).
   * The plain text token is returned once; only its sha256 hash is stored.
   */
  public async createToken(name: string, abilities: string[] = ['*']): Promise<{ plainTextToken: string; accessToken: PersonalAccessToken }> {
    const plainText = randomBytes(40).toString('hex');
    const accessToken = (await PersonalAccessToken.createRaw({
      user_id: this.getKey(),
      name,
      token: sha256(plainText),
      abilities,
    })) as PersonalAccessToken;
    return { plainTextToken: plainText, accessToken };
  }
}
