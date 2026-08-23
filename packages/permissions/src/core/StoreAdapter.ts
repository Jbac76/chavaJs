import type { PermissionRecord, RoleRecord } from './types';

/**
 * The single storage seam. Implement ~a dozen methods to back chava-permissions
 * with anything: memory, JSON file, SQL (via an injected query function),
 * Mongo, REST — the core never queries directly.
 */

export interface Snapshot {
  permissions: PermissionRecord[];
  roles: RoleRecord[];
  /** roleId -> permissionIds attached to the role. */
  rolePermissions: Map<number, Set<number>>;
  /** `${modelType}:${modelId}` -> role ids assigned. */
  modelRoles: Map<string, Set<number>>;
  /** `${modelType}:${modelId}` -> permission ids granted directly. */
  modelPermissions: Map<string, Set<number>>;
}

export interface NewPermission {
  name: string;
  guardName?: string;
}

export interface NewRole {
  name: string;
  guardName?: string;
}

/** Stable key for pivot maps. */
export function modelKey(modelType: string, modelId: number | string): string {
  return `${modelType}:${modelId}`;
}

export interface StoreAdapter {
  load(): Promise<Snapshot>;
  createPermission(input: NewPermission): Promise<PermissionRecord>;
  createRole(input: NewRole): Promise<RoleRecord>;
  /** All mutation hooks are optional — read-only adapters may omit them. */
  syncRolePermissions?(roleId: number, permissionIds: number[]): Promise<void>;
  givePermissionToModel?(modelType: string, modelId: number | string, permissionIds: number[]): Promise<void>;
  revokePermissionFromModel?(modelType: string, modelId: number | string, permissionId: number): Promise<void>;
  assignRolesToModel?(modelType: string, modelId: number | string, roleIds: number[]): Promise<void>;
  removeRoleFromModel?(modelType: string, modelId: number | string, roleId: number): Promise<void>;
  destroy(): Promise<void> | void;
}
