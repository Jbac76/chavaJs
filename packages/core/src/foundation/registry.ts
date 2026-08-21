import type { Application } from './Application';

let current: Application | null = null;

/** Register the bootstrapped application so facades can resolve it. */
export function setCurrentApp(app: Application): void {
  current = app;
}

/** Resolve the currently bootstrapped application. */
export function currentApp(): Application {
  if (!current) {
    throw new Error(
      'The chavaJs application has not been bootstrapped yet. ' +
        'Import bootstrap/app.ts (or call Application.configure(...)) before using facades.',
    );
  }
  return current;
}
