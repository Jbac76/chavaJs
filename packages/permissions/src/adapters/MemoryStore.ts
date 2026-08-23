import { StoreAdapter, Snapshot, NewPermission, NewRole } from '../core/StoreAdapter';
import { PermissionRecord, RoleRecord } from '../core/types';

/**
 * In-memory StoreAdapter — the default. Perfect for tests, SPAs, edge
 * runtimes and small tools. Persists nothing; pass `initial` to preload.
 */
export class MemoryStore implements StoreAdapter {
  private permissions = new Map<number, PermissionRecord>();
  private roles = new Map<number, RoleRecord>();
  private rolePermissions = new Map<number, Set<number>>();
  private modelRoles = new Map<string, Set<number>>();
  private modelPermissions = new Map<string, Set<number>>();
  private nextId = 1;

  public constructor(initial?: Partial<Snapshot>) {
    if (initial?.permissions) for (const permission of initial.permissions) this.permissions.set(permission.id, permission);
    if (initial?.roles) {
      for (const role of initial.roles) this.roles.set(role.id, { ...role, permissionIds: new Set(role.permissionIds) });
      let maxId = 0;
      for (const id of this.roles.keys()) maxId = Math.max(maxId, id);
      this.nextId = Math.max(this.nextId, maxId + 1);
      for (const role of initial.roles) this.rolePermissions.set(role.id, new Set(role.permissionIds));
    }
    if (initial?.rolePermissions) for (const [id, set] of initial.rolePermissions) this.rolePermissions.set(id, new Set(set));
    if (initial?.modelRoles) for (const [key, set] of initial.modelRoles) this.modelRoles.set(key, new Set(set));
    if (initial?.modelPermissions) for (const [key, set] of initial.modelPermissions) this.modelPermissions.set(key, new Set(set));
  }

  public async load(): Promise<Snapshot> {
    const roles: RoleRecord[] = [...this.roles.values()].map((role) => ({
      ...role,
      permissionIds: new Set(this.rolePermissions.get(role.id) ?? []),
    }));
    return {
      permissions: [...this.permissions.values()],
      roles,
      rolePermissions: new Map(this.rolePermissions),
      modelRoles: new Map(this.modelRoles),
      modelPermissions: new Map(this.modelPermissions),
    };
  }

  public async createPermission(input: NewPermission): Promise<PermissionRecord> {
    const record: PermissionRecord = { id: this.nextId++, name: input.name, guardName: input.guardName ?? 'web' };
    this.permissions.set(record.id, record);
    return record;
  }

  public async createRole(input: NewRole): Promise<RoleRecord> {
    const record: RoleRecord = { id: this.nextId++, name: input.name, guardName: input.guardName ?? 'web', permissionIds: new Set() };
    this.roles.set(record.id, record);
    this.rolePermissions.set(record.id, new Set());
    return record;
  }

  public async syncRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    this.rolePermissions.set(roleId, new Set(permissionIds));
  }

  public async givePermissionToModel(modelType: string, modelId: number | string, permissionIds: number[]): Promise<void> {
    const key = `${modelType}:${modelId}`;
    const set = this.modelPermissions.get(key) ?? new Set<number>();
    for (const id of permissionIds) set.add(id);
    this.modelPermissions.set(key, set);
  }

  public async revokePermissionFromModel(modelType: string, modelId: number | string, permissionId: number): Promise<void> {
    this.modelPermissions.get(`${modelType}:${modelId}`)?.delete(permissionId);
  }

  public async assignRolesToModel(modelType: string, modelId: number | string, roleIds: number[]): Promise<void> {
    const key = `${modelType}:${modelId}`;
    const set = this.modelRoles.get(key) ?? new Set<number>();
    for (const id of roleIds) set.add(id);
    this.modelRoles.set(key, set);
  }

  public async removeRoleFromModel(modelType: string, modelId: number | string, roleId: number): Promise<void> {
    this.modelRoles.get(`${modelType}:${modelId}`)?.delete(roleId);
  }

  public async destroy(): Promise<void> {
    this.permissions.clear();
    this.roles.clear();
    this.rolePermissions.clear();
    this.modelRoles.clear();
    this.modelPermissions.clear();
  }
}
