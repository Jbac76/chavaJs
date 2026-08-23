import { Registrar } from './Registrar';
import type { Authorizable, PermissionRecord, RoleRecord } from './types';
import {
  GuardDoesNotMatchError,
} from './errors';

/**
 * Spatie's `HasRoles` trait as a mixin factory. Attach to any subject:
 *
 *   const user = createHasRoles({ id: 1, modelType: 'users' }, registrar);
 *   await user.assignRole('writer');
 *   user.hasPermissionTo('posts.edit');  // true via role
 *
 * All async methods delegate mutations through the Registrar (which persists
 * via the StoreAdapter and updates its in-memory index atomically).
 */

export interface HasRolesApi extends Authorizable {
  assignRole(...roles: Array<string | RoleRecord>): Promise<void>;
  removeRole(...roles: Array<string | RoleRecord>): Promise<void>;
  syncRoles(...roles: Array<string | RoleRecord>): Promise<void>;
  hasRole(role: string): boolean;
  hasAnyRole(...roles: string[]): boolean;
  hasAllRoles(...roles: string[]): boolean;
  givePermissionTo(...permissions: Array<string | PermissionRecord>): Promise<void>;
  revokePermissionTo(permission: string): Promise<void>;
  syncPermissions(...permissions: Array<string | PermissionRecord>): Promise<void>;
  hasPermissionTo(permission: string): boolean;
  hasAnyPermission(...permissions: string[]): boolean;
  hasAllPermissions(...permissions: string[]): boolean;
  getAllPermissions(): PermissionRecord[];
  getRoleNames(): string[];
  getPermissionNames(): string[];
}

function names(values: Array<string | { name: string }>): string[] {
  return values.map((value) => (typeof value === 'string' ? value : value.name));
}

export function createHasRoles(
  model: Authorizable,
  registrar: Registrar,
): HasRolesApi {
  const modelType = model.modelType ?? 'models';
  const modelId = model.id;

  const guardOf = (name: string): string => {
    const permission = registrar.findPermission(name) ?? registrar.findRole(name);
    return permission?.guardName ?? registrar.guardName;
  };

  return {
    ...model,
    roles: [],
    directPermissions: [],

    async assignRole(...roleArgs) {
      await registrar.assignRolesToModel(modelType, modelId, names(roleArgs));
      // Guard mismatch surfaces here, matching Spatie's exception.
      for (const name of names(roleArgs)) {
        if (guardOf(name) !== registrar.guardName) {
          throw new GuardDoesNotMatchError(registrar.guardName, guardOf(name));
        }
      }
    },

    async removeRole(...roleArgs) {
      for (const name of names(roleArgs)) await registrar.removeRoleFromModel(modelType, modelId, name);
    },

    async syncRoles(...roleArgs) {
      await registrar.syncModelRoles(modelType, modelId, names(roleArgs));
    },

    hasRole(role: string): boolean {
      return registrar.hasRole(modelType, modelId, role);
    },

    hasAnyRole(...roles: string[]): boolean {
      return roles.some((role) => registrar.hasRole(modelType, modelId, role));
    },

    hasAllRoles(...roles: string[]): boolean {
      return roles.every((role) => registrar.hasRole(modelType, modelId, role));
    },

    async givePermissionTo(...permissionArgs) {
      await registrar.givePermissionToModel(modelType, modelId, names(permissionArgs));
    },

    async revokePermissionTo(permission: string) {
      await registrar.revokePermissionFromModel(modelType, modelId, permission);
    },

    async syncPermissions(...permissionArgs) {
      await registrar.syncModelPermissions(modelType, modelId, names(permissionArgs));
    },

    hasPermissionTo(permission: string): boolean {
      return registrar.hasPermissionTo(modelType, modelId, permission);
    },

    hasAnyPermission(...permissions: string[]): boolean {
      return permissions.some((permission) => registrar.hasPermissionTo(modelType, modelId, permission));
    },

    hasAllPermissions(...permissions: string[]): boolean {
      return permissions.every((permission) => registrar.hasPermissionTo(modelType, modelId, permission));
    },

    getAllPermissions(): PermissionRecord[] {
      return registrar.allPermissionsOf(modelType, modelId);
    },

    getRoleNames(): string[] {
      return registrar.rolesOf(modelType, modelId).map((role) => role.name);
    },

    getPermissionNames(): string[] {
      return this.getAllPermissions().map((permission) => permission.name);
    },
  };
}
