import { PermissionRecord, RoleRecord } from './types';
import { StoreAdapter, Snapshot, modelKey } from './StoreAdapter';
import { compileWildcard, isWildcard, WildcardMatcher } from './Wildcard';
import {
  PermissionDoesNotExistError,
  RoleDoesNotExistError,
} from './errors';

/**
 * The Registrar — Spatie's PermissionRegistrar, rebuilt around typed Maps.
 *
 * Loads the entire permission universe ONCE into O(1) lookup structures.
 * After warm-up, hasRole/hasPermissionTo never touch storage and allocate
 * nothing. Renames are safe: pivots join on ids, names resolve through here.
 */

export interface RegistrarEvents {
  onPermissionCreated?(permission: PermissionRecord): void;
  onRoleCreated?(role: RoleRecord): void;
  onChanged?(): void;
}

export class Registrar {
  private permissionsById = new Map<number, PermissionRecord>();
  private permissionsByName = new Map<string, PermissionRecord>();
  private rolesById = new Map<number, RoleRecord>();
  private rolesByName = new Map<string, RoleRecord>();
  private modelRoles = new Map<string, Set<number>>();
  private modelPermissions = new Map<string, Set<number>>();
  /** Compiled wildcard matchers keyed by permission id. */
  private wildcards = new Map<number, WildcardMatcher>();

  public constructor(
    public readonly store: StoreAdapter,
    private readonly events: RegistrarEvents = {},
    public readonly guardName = 'web',
  ) {}

  /** Load (or reload) everything from the store. */
  public async warmUp(): Promise<void> {
    const snapshot: Snapshot = await this.store.load();
    this.permissionsById.clear();
    this.permissionsByName.clear();
    this.rolesById.clear();
    this.rolesByName.clear();
    this.wildcards.clear();
    this.modelRoles.clear();
    this.modelPermissions.clear();

    for (const permission of snapshot.permissions) {
      this.indexPermission(permission);
    }
    for (const role of snapshot.roles) {
      this.indexRole(role);
    }
    for (const [key, set] of snapshot.modelRoles) this.modelRoles.set(key, new Set(set));
    for (const [key, set] of snapshot.modelPermissions) this.modelPermissions.set(key, new Set(set));
  }

  // ------------------------------------------------------------ resolution

  public findPermission(name: string): PermissionRecord | undefined {
    return this.permissionsByName.get(name);
  }

  public findRole(name: string): RoleRecord | undefined {
    return this.rolesByName.get(name);
  }

  public getPermission(name: string): PermissionRecord {
    const found = this.findPermission(name);
    if (!found) throw new PermissionDoesNotExistError(name);
    return found;
  }

  public getRole(name: string): RoleRecord {
    const found = this.findRole(name);
    if (!found) throw new RoleDoesNotExistError(name);
    return found;
  }

  public roleById(id: number): RoleRecord | undefined {
    return this.rolesById.get(id);
  }

  public permissionById(id: number): PermissionRecord | undefined {
    return this.permissionsById.get(id);
  }

  public allRoles(): RoleRecord[] {
    return [...this.rolesByName.values()];
  }

  public allPermissions(): PermissionRecord[] {
    return [...this.permissionsByName.values()];
  }

  // ---------------------------------------------------------------- grants

  public rolesOf(modelType: string, modelId: number | string): RoleRecord[] {
    const ids = this.modelRoles.get(modelKey(modelType, modelId));
    if (!ids) return [];
    return [...ids]
      .map((id) => this.rolesById.get(id))
      .filter((role): role is RoleRecord => role !== undefined);
  }

  /** Permissions granted DIRECTLY to the model (not via roles). */
  public directPermissionsOf(modelType: string, modelId: number | string): PermissionRecord[] {
    const ids = this.modelPermissions.get(modelKey(modelType, modelId));
    if (!ids) return [];
    return [...ids]
      .map((id) => this.permissionsById.get(id))
      .filter((permission): permission is PermissionRecord => permission !== undefined);
  }

  /**
   * Every effective permission of the model — direct + inherited through
   * roles, deduplicated by id (Spatie: getAllPermissions()).
   */
  public allPermissionsOf(modelType: string, modelId: number | string): PermissionRecord[] {
    const merged = new Map<number, PermissionRecord>();
    for (const role of this.rolesOf(modelType, modelId)) {
      for (const id of role.permissionIds) {
        const permission = this.permissionsById.get(id);
        if (permission) merged.set(permission.id, permission);
      }
    }
    for (const permission of this.directPermissionsOf(modelType, modelId)) {
      merged.set(permission.id, permission);
    }
    return [...merged.values()];
  }

  public hasRole(modelType: string, modelId: number | string, roleName: string): boolean {
    return this.rolesOf(modelType, modelId).some((role) => role.name === roleName);
  }

  /**
   * Spatie semantics: a wildcard permission (`posts.*`) in the subject's
   * permission set satisfies any concrete name it matches.
   */
  public hasPermissionTo(modelType: string, modelId: number | string, permissionName: string): boolean {
    const exact = this.findPermission(permissionName);

    for (const permission of this.allPermissionsOf(modelType, modelId)) {
      if (exact && permission.id === exact.id) return true;
      let matcher = this.wildcards.get(permission.id);
      if (matcher === undefined && isWildcard(permission.name)) {
        matcher = compileWildcard(permission.name);
        this.wildcards.set(permission.id, matcher);
      }
      if (matcher && matcher(permissionName)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------- mutations

  /** Create (or return existing — Spatie findOrCreate semantics). */
  public async createPermission(input: { name: string; guardName?: string }): Promise<PermissionRecord> {
    const existing = this.findPermission(input.name);
    if (existing) return existing;
    const created = await this.store.createPermission({
      name: input.name,
      guardName: input.guardName ?? this.guardName,
    });
    this.indexPermission(created);
    this.events.onPermissionCreated?.(created);
    this.events.onChanged?.();
    return created;
  }

  public async createRole(input: { name: string; guardName?: string }): Promise<RoleRecord> {
    const existing = this.findRole(input.name);
    if (existing) return existing;
    const created = await this.store.createRole({
      name: input.name,
      guardName: input.guardName ?? this.guardName,
    });
    this.indexRole(created);
    this.events.onRoleCreated?.(created);
    this.events.onChanged?.();
    return created;
  }

  /** Replace the permission set of a role (Spatie: $role->syncPermissions). */
  public async syncRolePermissions(roleId: number, permissionNames: string[]): Promise<void> {
    const resolved = permissionNames.map((name) => this.getPermission(name));
    const role = this.rolesById.get(roleId);
    if (!role) throw new RoleDoesNotExistError(`#${roleId}`);
    await this.store.syncRolePermissions?.(roleId, resolved.map((permission) => permission.id));
    role.permissionIds = new Set(resolved.map((permission) => permission.id));
    this.events.onChanged?.();
  }

  /** Give one or more permissions directly to a model. */
  public async givePermissionToModel(
    modelType: string,
    modelId: number | string,
    permissionNames: string[],
  ): Promise<void> {
    const resolved = permissionNames.map((name) => this.getPermission(name));
    await this.store.givePermissionToModel?.(
      modelType,
      modelId,
      resolved.map((permission) => permission.id),
    );
    const key = modelKey(modelType, modelId);
    const set = this.modelPermissions.get(key) ?? new Set<number>();
    for (const permission of resolved) set.add(permission.id);
    this.modelPermissions.set(key, set);
    this.events.onChanged?.();
  }

  public async revokePermissionFromModel(
    modelType: string,
    modelId: number | string,
    permissionName: string,
  ): Promise<void> {
    const permission = this.getPermission(permissionName);
    await this.store.revokePermissionFromModel?.(modelType, modelId, permission.id);
    this.modelPermissions.get(modelKey(modelType, modelId))?.delete(permission.id);
    this.events.onChanged?.();
  }

  /** Replace a model's direct permission set entirely. */
  public async syncModelPermissions(
    modelType: string,
    modelId: number | string,
    permissionNames: string[],
  ): Promise<void> {
    const current = new Set(this.directPermissionsOf(modelType, modelId).map((p) => p.name));
    for (const name of current) {
      if (!permissionNames.includes(name)) await this.revokePermissionFromModel(modelType, modelId, name);
    }
    await this.givePermissionToModel(
      modelType,
      modelId,
      permissionNames.filter((name) => !current.has(name)),
    );
  }

  /** Assign roles to a model (Spatie: assignRole). */
  public async assignRolesToModel(
    modelType: string,
    modelId: number | string,
    roleNames: string[],
  ): Promise<void> {
    const resolved = roleNames.map((name) => this.getRole(name));
    await this.store.assignRolesToModel?.(
      modelType,
      modelId,
      resolved.map((role) => role.id),
    );
    const key = modelKey(modelType, modelId);
    const set = this.modelRoles.get(key) ?? new Set<number>();
    for (const role of resolved) set.add(role.id);
    this.modelRoles.set(key, set);
    this.events.onChanged?.();
  }

  public async removeRoleFromModel(
    modelType: string,
    modelId: number | string,
    roleName: string,
  ): Promise<void> {
    const role = this.getRole(roleName);
    await this.store.removeRoleFromModel?.(modelType, modelId, role.id);
    this.modelRoles.get(modelKey(modelType, modelId))?.delete(role.id);
    this.events.onChanged?.();
  }

  /** Replace a model's role set entirely (Spatie: syncRoles). */
  public async syncModelRoles(
    modelType: string,
    modelId: number | string,
    roleNames: string[],
  ): Promise<void> {
    const current = new Set(this.rolesOf(modelType, modelId).map((role) => role.name));
    for (const name of current) {
      if (!roleNames.includes(name)) await this.removeRoleFromModel(modelType, modelId, name);
    }
    await this.assignRolesToModel(
      modelType,
      modelId,
      roleNames.filter((name) => !current.has(name)),
    );
  }

  // ------------------------------------------------------------- internals

  private indexPermission(permission: PermissionRecord): void {
    this.permissionsById.set(permission.id, permission);
    this.permissionsByName.set(permission.name, permission);
  }

  private indexRole(role: RoleRecord): void {
    this.rolesById.set(role.id, role);
    this.rolesByName.set(role.name, role);
  }
}
