import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as vm from 'node:vm';
import repl from 'node:repl';
import { inspect } from 'node:util';
import ts from 'typescript';
import { Command } from 'commander';
import type { Application } from '../../foundation/Application';
import { bootApp } from '../helpers/boot-app';
import { Model } from '../../orm/Model';

/**
 * Laravel's `tinker` — a REPL with the application loaded. Every line is
 * evaluated with TypeScript support (types are stripped, expressions are
 * awaited), and the app's facades + models are available as bare globals:
 *
 *   chava> User.find(1)
 *   chava> await DB.table('users').count()
 *   chava> user = await User.find(1); user.name
 *
 * SECURITY: like Laravel's tinker this is a developer tool, not a sandbox —
 * the vm context exposes `require`/`process`, so input can run arbitrary
 * host code. Never point it at untrusted input.
 */
export function tinkerCommand(): Command {
  return new Command('tinker')
    .description('Interact with your application (REPL with the app loaded)')
    .action(async () => {
      const app = await bootApp();
      await app.bootstrap();
      const context = await buildContext(app);
      // Added before the eval's sandbox snapshot so `exit` is available.
      context.exit = (): never => {
        console.log('  Bye.');
        process.exit(0);
      };
      const evalLine = createTinkerEval(context);

      repl.start({
        prompt: 'chava> ',
        eval: evalLine as repl.REPLEval,
        writer: formatValue,
        useGlobal: false,
        terminal: process.stdin.isTTY,
      });

      console.log(
        '  chavaJs tinker — the app is loaded.\n' +
          '  Try: User.find(1), await DB.table(\'users\').count(), app.make(\'config\') — or .exit\n' +
          '  Note: bare assignments (user = ...) persist across lines; const/let are per-line.',
      );
    });
}

// ------------------------------------------------------------------ context

/**
 * Build the globals exposed to tinker: the app, every facade, Hash + Model,
 * and every model class in app/Models (imported by file name).
 */
async function buildContext(app: Application): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = { app };

  const facades = (await import('../../facades')) as Record<string, unknown>;
  for (const name of ['App', 'Config', 'DB', 'Schema', 'Auth', 'Gate', 'Session', 'Event', 'Queue', 'Mail', 'Notification', 'Schedule', 'Route', 'Inertia']) {
    const value = facades[name];
    if (value !== undefined) context[name] = value;
  }
  context.Hash = (await import('../../auth/Hash')).Hash;
  context.Model = (await import('../../orm/Model')).Model;

  // Every model class from app/Models/*.ts, exposed under its class name.
  const modelsDir = join(app.path('app', 'Models'));
  let files: string[];
  try {
    files = readdirSync(modelsDir).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
  } catch {
    files = [];
  }
  for (const file of files) {
    const name = file.replace(/\.(ts|js)$/, '');
    try {
      const module = (await import(pathToFileURL(join(modelsDir, file)).href)) as Record<string, unknown>;
      const value = module.default ?? module[name];
      if (value !== undefined) context[name] = value;
    } catch {
      // A model may depend on the HTTP layer; skip gracefully.
    }
  }

  return context;
}

// ------------------------------------------------------------------ eval

/** Signature of a tinker line evaluator (decoupled from node:repl). */
export type TinkerEval = (
  input: string,
  context: object,
  filename: string,
  callback: (error: Error | null, result?: unknown) => void,
) => void;

/**
 * Create a REPL eval function. Input is transpiled TS → JS, then run against
 * a persistent vm sandbox (so state like `user = ...` survives across lines).
 * Expressions are wrapped so their value is printed; statements fall back to
 * a plain block. Results are awaited before returning to the REPL.
 */
export function createTinkerEval(context: Record<string, unknown>): TinkerEval {
  const sandbox: Record<string, unknown> = {
    ...context,
    console,
    process,
    Buffer,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    require: createRequire(pathToFileURL(join(process.cwd(), 'bootstrap', 'app.ts')).href),
    __filename: 'tinker',
    __dirname: process.cwd(),
  };
  const vmContext = vm.createContext(sandbox);

  // node:repl fires the next (piped) line immediately, so slow evaluations
  // would race. Chain the work so every line runs to completion in order and
  // its callback fires before the next line is evaluated.
  let chain: Promise<unknown> = Promise.resolve();

  return function tinkerEval(input: string, _ctx: object, _file: string, callback: (error: Error | null, result?: unknown) => void): void {
    const code = input.replace(/^\s+/, '').replace(/\s+$/, '');
    if (code === '') {
      callback(null);
      return;
    }
    chain = chain
      .then(() => evaluateLine(code, vmContext))
      .then((value) => callback(null, value))
      .catch((error) => callback(error instanceof Error ? error : new Error(String(error))));
  };
}

/** Transpile + evaluate one line against the vm context, awaiting results. */
async function evaluateLine(code: string, vmContext: vm.Context): Promise<unknown> {
  const js = transpile(code);
  const asExpression = runExpression(js, vmContext);
  if (asExpression !== UNPARSEABLE) {
    return await asExpression;
  }
  return await runBlock(js, vmContext);
}

const UNPARSEABLE = Symbol('unparseable-as-expression');

/** Strip TS type annotations so the line runs as plain JS (no checking). */
function transpile(code: string): string {
  const output = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true,
    },
    reportDiagnostics: false,
  });
  return output.outputText.replace(/;\s*$/, '').trim();
}

/** Run `(async () => (code))()` — returns the expression's value. */
function runExpression(js: string, ctx: vm.Context): unknown {
  try {
    return new vm.Script(`(async () => (\n${js}\n))()`).runInContext(ctx);
  } catch (error) {
    // Only genuinely unparseable input falls back to the block form — never
    // swallow runtime errors (that would re-execute user code a second time).
    if (error instanceof SyntaxError) return UNPARSEABLE;
    throw error;
  }
}

/** Run statements as a block (assignments via the sandbox persist). */
function runBlock(js: string, ctx: vm.Context): unknown {
  return new vm.Script(`(async () => {\n${js}\n})()`).runInContext(ctx);
}

// ------------------------------------------------------------------ writer

/** Format REPL output — models print like Laravel's tinker, not as objects. */
export function formatValue(value: unknown): string {
  const colors = process.stdout.isTTY === true;
  if (value instanceof Model) {
    return `${value.constructor.name} ${inspect(value.toArray(), { depth: 4, colors, sorted: true })}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const body = value
      .map((item) =>
        item instanceof Model
          ? `${item.constructor.name} ${inspect(item.toArray(), { depth: 2, sorted: true })}`
          : inspect(item, { depth: 3, colors }),
      )
      .join(',\n  ');
    return `[\n  ${body}\n]`;
  }
  if (value instanceof Promise) {
    // Safety: synchronous writers can't await — values are pre-awaited.
    return '<Promise> (unexpected — results are awaited before printing)';
  }
  return inspect(value, { depth: 4, colors: process.stdout.isTTY === true, sorted: true });
}
