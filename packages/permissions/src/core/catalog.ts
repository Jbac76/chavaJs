/**
 * Typed permission catalog — template literal types give every built-in
 * permission name without manual typing. Add an entity or verb and the whole
 * surface (seeds, middleware strings, IDE autocomplete) extends instantly.
 *
 *   type CrudPermission = `${Entity}.${Verb}`
 *   // 'users.view' | 'users.create' | ... | 'settings.delete'
 */

export const ENTITIES = ['users', 'roles', 'permissions', 'settings'] as const;
export type Entity = (typeof ENTITIES)[number];

export const VERBS = ['view', 'create', 'update', 'delete'] as const;
export type Verb = (typeof VERBS)[number];

export const GUARDS = ['web'] as const;
export type Guard = (typeof GUARDS)[number];

/** Every CRUD permission, generated: `${Entity}.${Verb}` */
export type CrudPermission = `${Entity}.${Verb}`;

/** Wildcards: per-entity (`users.*`) or global (`*`). */
export type WildcardPermission = `${Entity}.*` | '*';

/** Anything a role may hold. */
export type PermissionName = CrudPermission | WildcardPermission;

/** All CRUD permissions, materialized — used by seeding and UI matrices. */
export const CRUD_PERMISSIONS: readonly CrudPermission[] = ENTITIES.flatMap((entity) =>
  VERBS.map((verb) => `${entity}.${verb}` as CrudPermission),
);

/** Runtime guard for arbitrary strings coming from storage/HTTP. */
export function isCrudPermission(name: string): name is CrudPermission {
  return (CRUD_PERMISSIONS as readonly string[]).includes(name);
}

/** Parse `'users.edit'` into its segments when it matches Entity.Verb. */
export function parseCrudPermission(name: string): { entity: Entity; verb: Verb } | null {
  if (!isCrudPermission(name)) return null;
  const [entity, verb] = name.split('.') as [Entity, Verb];
  return { entity, verb };
}

/** Non-CRUD permissions that ship enabled out of the box. */
export const STATIC_PERMISSIONS = ['admin.access'] as const;
export type StaticPermission = (typeof STATIC_PERMISSIONS)[number];

/** Everything permission:install seeds. */
export const SEED_PERMISSIONS: readonly string[] = [...CRUD_PERMISSIONS, ...STATIC_PERMISSIONS];
