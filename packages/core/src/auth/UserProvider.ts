import type { Model, ModelClass } from '../orm/Model';
import { Hash } from './Hash';

/**
 * Laravel's UserProvider contract — retrieve users by id / credentials and
 * validate passwords. Implementations: EloquentUserProvider (default).
 */
export interface UserProvider {
  retrieveById(id: unknown): Promise<Model | null>;
  retrieveByCredentials(credentials: Record<string, unknown>): Promise<Model | null>;
  validateCredentials(user: Model, credentials: Record<string, unknown>): Promise<boolean>;
}

/** Eloquent-backed provider — Laravel's 'eloquent' provider driver. */
export class EloquentUserProvider implements UserProvider {
  public constructor(private readonly model: ModelClass) {}

  public async retrieveById(id: unknown): Promise<Model | null> {
    return (await this.model.find(id)) ?? null;
  }

  public async retrieveByCredentials(credentials: Record<string, unknown>): Promise<Model | null> {
    const query = this.model.query();
    for (const [key, value] of Object.entries(credentials)) {
      // Password never participates in the lookup; empty values are ignored
      // (exactly like Laravel's EloquentUserProvider).
      if (key === 'password' || value === null || value === undefined || value === '') continue;
      query.where(key, value);
    }
    return (await query.first()) ?? null;
  }

  public async validateCredentials(user: Model, credentials: Record<string, unknown>): Promise<boolean> {
    const password = credentials.password;
    if (typeof password !== 'string') return false;
    const stored = user.getAttribute('password');
    if (typeof stored !== 'string') return false;
    return Hash.check(password, stored);
  }
}
