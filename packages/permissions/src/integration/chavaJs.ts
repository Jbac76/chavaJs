/**
 * First-class chavaJs integration for chava-permissions.
 *
 * - SqlStore: Spatie-identical five-table schema over the chavaJs DB layer
 * - RoleMiddleware / PermissionMiddleware: `role:writer|editor`, `permission:posts.edit`
 * - PermissionsServiceProvider: registrar singleton, Gate bridge, aliases,
 *   Inertia shared `can`/`roles` props
 */

import type { Application } from '../../foundation/Application';
import { ServiceProvider } from '../../container/ServiceProvider';
import type { Router } from '../../http/Router';
import type { Request } from '../../http/Request';
import type { Response } from '../../http/Response';
import type { NextFunction } from '../../http/types';
import { Registrar } from '../core/Registrar';
import { UnauthorizedError } from '../core/errors';
import { modelKey } from '../core/StoreAdapter';
import type { StoreAdapter, Snapshot } from '../core/StoreAdapter';
import type { PermissionRecord, RoleRecord } from '../core/types';

// ------------------------------------------------------------------ SqlStore

/** Minimal surface of the chavaJs DatabaseManager we rely on. */
interface DbLike {
  connection(name?: string): {
    query<T = Record<string, unknown>>(sql: string, bindings?: unknown[]): Promise<T[]>;
    run(sql: string, bindings?: unknown[]): Promise<unknown>;
    exec(sql: string): Promise<void>;
  };
}

/**
 * Persists the permission universe in the same schema spatie/laravel-permission
 * uses, so existing PHP databases import with zero transformation.
 */
export class SqlStore implements StoreAdapter {
  private readonly db: DbLike;

  public constructor(db: DbLike, private readonly guardName = 'web') {
    this.db = db;
  }

  private get conn() {
    return this.db.connection();
  }

  public async load(): Promise<Snapshot> {
    const permissions = await this.conn.query<{ id: number; name: string; guard_name: string }>(
      'SELECT id, name, guard_name FROM permissions',
    );
    const roles = await this.conn.query<{ id: number; name: string; guard_name: string }>(
      'SELECT id, name, guard_name FROM roles',
    );
    const rolePermissions = await this.conn.query<{ role_id: number; permission_id: number }>(
      'SELECT role_id, permission_id FROM role_has_permissions',
    );
    const modelRoles = await this.conn.query<{ role_id: number; model_type: string; model_id: number | string }>(
      'SELECT role_id, model_type, model_id FROM model_has_roles',
    );
    const modelPermissions = await this.conn.query<{ permission_id: number; model_type: string; model_id: number | string }>(
      'SELECT permission_id, model_type, model_id FROM model_has_permissions',
    );

    const rpByRole = new Map<number, Set<number>>();
    for (const row of rolePermissions) {
      const set = rpByRole.get(Number(row.role_id)) ?? new Set<number>();
      set.add(Number(row.permission_id));
      rpByRole.set(Number(row.role_id), set);
    }
    const mrByKey = new Map<string, Set<number>>();
    for (const row of modelRoles) {
      const key = `${row.model_type}:${row.model_id}`;
      const set = mrByKey.get(key) ?? new Set<number>();
      set.add(Number(row.role_id));
      mrByKey.set(key, set);
    }
    const mpByKey = new Map<string, Set<number>>();
    for (const row of modelPermissions) {
      const key = `${row.model_type}:${row.model_id}`;
      const set = mpByKey.get(key) ?? new Set<number>();
      set.add(Number(row.permission_id));
      mpByKey.set(key, set);
    }

    return {
      permissions: permissions.map((row) => ({ id: Number(row.id), name: row.name, guardName: row.guard_name })),
      roles: roles.map((row) => ({
        id: Number(row.id),
        name: row.name,
        guardName: row.guard_name,
        permissionIds: rpByRole.get(Number(row.id)) ?? new Set<number>(),
      })) as RoleRecord[],
      rolePermissions: rpByRole,
      modelRoles: mrByKey,
      modelPermissions: mpByKey,
    };
  }

  public async createPermission(input: { name: string; guardName?: string }): Promise<PermissionRecord> {
    await this.conn.run(
      'INSERT INTO permissions (name, guard_name) VALUES (?, ?)',
      [input.name, input.guardName ?? this.guardName],
    );
    const rows = await this.conn.query<{ id: number }>('SELECT id FROM permissions WHERE name = ? AND guard_name = ?', [input.name, input.guardName ?? this.guardName]);
    return { id: Number(rows[0]!.id), name: input.name, guardName: input.guardName ?? this.guardName };
  }

  public async createRole(input: { name: string; guardName?: string }): Promise<RoleRecord> {
    await this.conn.run('INSERT INTO roles (name, guard_name) VALUES (?, ?)', [input.name, input.guardName ?? this.guardName]);
    const rows = await this.conn.query<{ id: number }>('SELECT id FROM roles WHERE name = ? AND guard_name = ?', [input.name, input.guardName ?? this.guardName]);
    return { id: Number(rows[0]!.id), name: input.name, guardName: input.guardName ?? this.guardName, permissionIds: new Set() };
  }

  /** Transactional full replacement of a role's permissions. */
  public async syncRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    const conn = this.conn;
    await conn.exec('BEGIN');
    try {
      await conn.run('DELETE FROM role_has_permissions WHERE role_id = ?', [roleId]);
      for (const pid of permissionIds) {
        await conn.run('INSERT INTO role_has_permissions (permission_id, role_id) VALUES (?, ?)', [pid, roleId]);
      }
      await conn.exec('COMMIT');
    } catch (error) {
      await conn.exec('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  public async givePermissionToModel(modelType: string, modelId: number | string, permissionIds: number[]): Promise<void> {
    for (const pid of permissionIds) {
      await this.conn.run(
        'INSERT OR IGNORE INTO model_has_permissions (permission_id, model_type, model_id) VALUES (?, ?, ?)',
        [pid, modelType, String(modelId)],
      );
    }
  }

  public async revokePermissionFromModel(modelType: string, modelId: number | string, permissionId: number): Promise<void> {
    await this.conn.run(
      'DELETE FROM model_has_permissions WHERE permission_id = ? AND model_type = ? AND model_id = ?',
      [permissionId, modelType, String(modelId)],
    );
  }

  public async assignRolesToModel(modelType: string, modelId: number | string, roleIds: number[]): Promise<void> {
    for (const rid of roleIds) {
      await this.conn.run(
        'INSERT OR IGNORE INTO model_has_roles (role_id, model_type, model_id) VALUES (?, ?, ?)',
        [rid, modelType, String(modelId)],
      );
    }
  }

  public async removeRoleFromModel(modelType: string, modelId: number | string, roleId: number): Promise<void> {
    await this.conn.run('DELETE FROM model_has_roles WHERE role_id = ? AND model_type = ? AND model_id = ?', [roleId, modelType, String(modelId)]);
  }

  public async destroy(): Promise<void> {
    // Nothing to close - connections are owned by the chavaJs DB manager.
  }

  public static readonly SCHEMA = [
    `CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, guard_name TEXT NOT NULL DEFAULT 'web', UNIQUE (name, guard_name))`,
    `CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, guard_name TEXT NOT NULL DEFAULT 'web', UNIQUE (name, guard_name))`,
    `CREATE TABLE IF NOT EXISTS role_has_permissions (permission_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (permission_id, role_id))`,
    `CREATE TABLE IF NOT EXISTS model_has_roles (role_id INTEGER NOT NULL, model_type TEXT NOT NULL, model_id TEXT NOT NULL, PRIMARY KEY (role_id, model_type, model_id))`,
    `CREATE TABLE IF NOT EXISTS model_has_permissions (permission_id INTEGER NOT NULL, model_type TEXT NOT NULL, model_id TEXT NOT NULL, PRIMARY KEY (permission_id, model_type, model_id))`,
  ];
}

// ------------------------------------------------------------------ middleware

export class RoleMiddleware {
  public constructor(protected readonly app: Application) {}

  public async handle(request: Request, next: NextFunction, ...roles: string[]): Promise<Response> {
    void request;
    const registrar = this.app.make<Registrar>('permissions');
    const userId = await this.currentUserId();
    if (!userId || !roles.some((role) => registrar.hasRole('users', userId, role))) {
      throw new UnauthorizedError(`None of the required roles [${roles.join(', ')}] are present.`);
    }
    return next();
  }

  protected async currentUserId(): Promise<number | string | null> {
    return resolveAuthUserId(this.app);
  }
}

export class PermissionMiddleware extends RoleMiddleware {
  // Explicit constructor: the container resolves dependencies by parameter
  // name from the declared constructor — an inherited one yields no params.
  public constructor(app: Application) {
    super(app);
  }

  public async handle(request: Request, next: NextFunction, ...permissions: string[]): Promise<Response> {
    const registrar = this.app.make<Registrar>('permissions');
    const userId = await resolveAuthUserId(this.app);
    if (!userId || !permissions.some((name) => registrar.hasPermissionTo('users', userId, name))) {
      throw new UnauthorizedError(`None of the required permissions [${permissions.join(', ')}] are present.`);
    }
    void registrar;
    return next();
  }
}

/** Resolve the authenticated user's id through the container auth manager. */
async function resolveAuthUserId(app: Application): Promise<number | string | null> {
  try {
    const auth = app.make<{ id: (guard?: string) => Promise<unknown> }>('auth');
    const id: unknown = await auth.id();
    if (id === null || id === undefined) return null;
    return typeof id === 'number' ? id : String(id);
  } catch {
    return null;
  }
}

void modelKey; // re-exported for adapter consumers

// ------------------------------------------------------------------ provider

export class PermissionsServiceProvider extends ServiceProvider {
  public register(): void {
    this.app.singleton('permissions', () => {
      const db = this.app.make<DbLike>('db');
      const store = new SqlStore(db);
      return new Registrar(store);
    });
    this.app.alias('Permissions', 'permissions');
  }

  public async boot(): Promise<void> {
    const router = this.app.make<Router>('router');
    router.middlewareAlias('role', RoleMiddleware as never);
    router.middlewareAlias('permission', PermissionMiddleware);

    // Warm the registrar once tables exist; a missing table should not kill boot.
    try {
      const registrar = this.app.make<Registrar>('permissions');
      await registrar.warmUp();

      // Gate bridge: wildcard superusers pass every ability check.
      const gate = this.app.make<{ before: (cb: unknown) => unknown }>('gate');
      gate.before(async (subject: unknown, ability: string) => {
        void subject;
        const userId = await resolveAuthUserId(this.app);
        if (userId && registrar.hasRole('users', userId, 'super-admin')) return true;
        if (userId && registrar.hasPermissionTo('users', userId, ability)) return true;
        return undefined; // fall through to policies/abilities
      });
    } catch {
      // Tables not installed yet (`js permission:install`) — stay inert.
    }
  }
}
