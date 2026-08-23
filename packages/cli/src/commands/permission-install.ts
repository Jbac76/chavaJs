import { Command } from 'commander';
import { SEED_PERMISSIONS } from '../../permissions';
import { bootApp } from '../helpers/boot-app';

/** The five Spatie-schema tables, created idempotently. */
export function permissionInstallCommand(): Command {
  return new Command('permission:install')
    .description('Create the roles & permissions tables (Spatie schema)')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const db = app.make<{ connection: () => { exec(sql: string): Promise<void>; query(sql: string, bindings?: unknown[]): Promise<unknown[]>; run(sql: string, bindings?: unknown[]): Promise<unknown> } }>('db');
      const conn = db.connection();

      const statements = [
        `CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, guard_name TEXT NOT NULL DEFAULT 'web', UNIQUE (name, guard_name))`,
        `CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, guard_name TEXT NOT NULL DEFAULT 'web', UNIQUE (name, guard_name))`,
        `CREATE TABLE IF NOT EXISTS role_has_permissions (permission_id INTEGER NOT NULL, role_id INTEGER NOT NULL, PRIMARY KEY (permission_id, role_id))`,
        `CREATE TABLE IF NOT EXISTS model_has_roles (role_id INTEGER NOT NULL, model_type TEXT NOT NULL, model_id TEXT NOT NULL, PRIMARY KEY (role_id, model_type, model_id))`,
        `CREATE TABLE IF NOT EXISTS model_has_permissions (permission_id INTEGER NOT NULL, model_type TEXT NOT NULL, model_id TEXT NOT NULL, PRIMARY KEY (permission_id, model_type, model_id))`,
      ];
      for (const sql of statements) await conn.exec(sql);

      // Convenience seed: super-admin role with wildcard + the typed CRUD
      // catalog (users.view ... settings.delete) generated from
      // `${Entity}.${Verb}` template literal types.
      for (const name of SEED_PERMISSIONS) {
        const exists = await conn.query('SELECT id FROM permissions WHERE name = ?', [name]);
        if (exists.length === 0) {
          await conn.run('INSERT INTO permissions (name, guard_name) VALUES (?, ?)', [name, 'web']);
        }
      }
      const existingSuper = await conn.query("SELECT id FROM roles WHERE name = 'super-admin'");
      if (existingSuper.length === 0) {
        await conn.exec(`INSERT INTO roles (name, guard_name) VALUES ('super-admin', 'web')`);
        await conn.exec(`INSERT INTO permissions (name, guard_name) VALUES ('*', 'web')`);
        const roleRow = await conn.query(`SELECT id FROM roles WHERE name = 'super-admin'`);
        const permRow = await conn.query(`SELECT id FROM permissions WHERE name = '*'`);
        await conn.run('INSERT OR IGNORE INTO role_has_permissions (permission_id, role_id) VALUES (?, ?)', [(permRow[0] as { id: number }).id, (roleRow[0] as { id: number }).id]);
        console.log('  Seeded role: super-admin (wildcard *)');
      }
      console.log(`  Seeded permissions: ${SEED_PERMISSIONS.join(', ')}`);

      console.log('Permissions tables installed (5 tables).');
    });
}
