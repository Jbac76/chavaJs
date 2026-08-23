/**
 * Core identity types for chava-permissions.
 *
 * Everything internal joins on numeric/string `id` — names are resolved
 * through the Registrar and are display-only. This mirrors Spatie's model
 * shape so existing databases import unchanged.
 */

export type GuardName = string;

export interface PermissionRecord {
  id: number;
  name: string;
  guardName: GuardName;
}

export interface RoleRecord {
  id: number;
  name: string;
  guardName: GuardName;
  /** Permission ids directly attached to this role. */
  permissionIds: Set<number>;
}

/** Minimal contract a model must satisfy to be authorizable (Spatie's HasRoles). */
export interface AuthorizableModel {
  id: number | string;
  modelType?: string;
}

/** A user/subject enriched with the HasRoles API by createHasRoles(). */
export interface Authorizable extends AuthorizableModel {
  roles: RoleRecord[];
  directPermissions: PermissionRecord[];
}
