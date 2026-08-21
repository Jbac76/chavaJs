import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Application } from '../../foundation/Application';

/** Import and return the Application instance from ./bootstrap/app.ts. */
export async function bootApp(): Promise<Application> {
  const entry = pathToFileURL(join(process.cwd(), 'bootstrap', 'app.ts')).href;
  const module = (await import(entry)) as { default?: Application; app?: Application };
  const app = module.default ?? module.app;
  if (!app) {
    throw new Error(
      'bootstrap/app.ts must export the Application instance (export default or export const app).',
    );
  }
  return app;
}
