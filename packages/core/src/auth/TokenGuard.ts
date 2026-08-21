import type { Model, ModelClass } from '../orm/Model';
import { currentRequest } from '../foundation/request-context';
import { sha256 } from './Hash';

/**
 * Laravel's Sanctum-style token guard — reads the `Bearer` token, hashes it
 * with sha256, looks up a PersonalAccessToken row, and returns its user.
 */
export class TokenGuard {
  private userCache: Model | null = null;

  public constructor(
    private readonly tokenModel: ModelClass,
    private readonly userRelation: string,
  ) {}

  public async user(): Promise<Model | null> {
    if (this.userCache) return this.userCache;

    const request = currentRequest();
    const token = request?.bearerToken();
    if (!token) return null;

    const record = await this.tokenModel.query().where('token', sha256(token)).first();
    if (!record) return null;

    // Token expiry — Laravel: expires_at in the past means the token is dead.
    const expiresAt = record.getAttribute('expires_at');
    if (expiresAt !== null && expiresAt !== undefined) {
      const expiry = new Date(String(expiresAt)).getTime();
      if (Number.isNaN(expiry) || expiry < Date.now()) return null;
    }

    await record.load(this.userRelation);
    const related = record.getRelation(this.userRelation);
    this.userCache = related instanceof Object ? (related as Model) : null;
    return this.userCache;
  }

  public async check(): Promise<boolean> {
    return (await this.user()) !== null;
  }

  public async id(): Promise<unknown> {
    const user = await this.user();
    return user?.getKey() ?? null;
  }

  public async attempt(_credentials: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  public login(_user: Model): void {
    // Token guards authenticate per-request; nothing to persist.
  }

  public logout(): void {
    this.userCache = null;
  }
}
