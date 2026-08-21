import { describe, expect, it } from 'vitest';
import {
  featureTestStub,
  invokableControllerStub,
  middlewareStub,
  resourceControllerStub,
  unitTestStub,
} from '../../src/cli/commands/make-more2';
import { factoryStub, seederStub } from '../../src/cli/commands/make';
import { classWithSuffix, pascal, pluralize, snake } from '../../src/cli/helpers/generators';
import { createTinkerEval, formatValue } from '../../src/cli/commands/tinker';
import { workerPassArgv } from '../../src/cli/commands/queue-listen';
import { freshApp } from '../helpers/db';
import { User } from '../../app/Models/User';

/** Run one line through the tinker eval and resolve (error, value). */
function runLine(
  evalLine: ReturnType<typeof createTinkerEval>,
  code: string,
): Promise<{ error: Error | null; value: unknown }> {
  return new Promise((resolve) => {
    evalLine(code, {}, 'tinker-test', (error, value) => resolve({ error, value }));
  });
}

describe('make:* generator stubs (Phase 6)', () => {
  it('builds a resource controller with all seven methods and the singular param', () => {
    const stub = resourceControllerStub('PostController');
    for (const method of ['index', 'create', 'store', 'show', 'edit', 'update', 'destroy']) {
      expect(stub).toContain(`public async ${method}(`);
    }
    expect(stub).toContain('post: string'); // singular route param
    expect(stub).toContain("Inertia.render('Post/Index'");
  });

  it('builds an API resource controller without create/edit', () => {
    const stub = resourceControllerStub('PostController', true);
    expect(stub).toContain('public async store(');
    expect(stub).not.toContain('public async create(');
    expect(stub).not.toContain('public async edit(');
  });

  it('builds an invokable controller with __invoke', () => {
    const stub = invokableControllerStub('ShowDashboardController');
    expect(stub).toContain('public async __invoke()');
  });

  it('builds a middleware with the handle(request, next) contract', () => {
    const stub = middlewareStub('EnsureAdminMiddleware');
    expect(stub).toContain('export class EnsureAdminMiddleware');
    expect(stub).toContain('handle(request: Request, next: NextFunction)');
    expect(stub).toContain('return next();');
  });

  it('builds feature and unit test stubs', () => {
    expect(featureTestStub('StorePostTest')).toContain("import { freshApp } from '../helpers/db'");
    expect(unitTestStub('StorePostTest')).toContain('describe(\'StorePostTest\'');
    expect(unitTestStub('StorePostTest')).not.toContain('freshApp');
  });

  it('builds a factory stub with a faker-driven definition skeleton', () => {
    const stub = factoryStub('User', 'UserFactory');
    expect(stub).toContain('export class UserFactory extends Factory<User>');
    expect(stub).toContain('protected model = User;');
    expect(stub).toContain("import { User } from '../../app/Models/User';");
    expect(stub).toContain('faker.person.fullName()');
  });

  it('builds a seeder stub with the Seeder base and run()', () => {
    const stub = seederStub('UserSeeder');
    expect(stub).toContain('export class UserSeeder extends Seeder');
    expect(stub).toContain('public async run(): Promise<void>');
    expect(stub).toContain("import { Seeder } from '../../src/database/Seeder';");
  });
});

describe('generator naming helpers (shared module)', () => {
  it('pascal-cases, snake-cases and pluralizes', () => {
    expect(pascal('post_tag')).toBe('PostTag');
    expect(pascal('user factory')).toBe('UserFactory');
    expect(snake('PostTag')).toBe('post_tag');
    expect(pluralize('category')).toBe('categories');
    expect(pluralize('box')).toBe('boxes');
    expect(pluralize('user')).toBe('users');
  });

  it('classWithSuffix appends the suffix only when missing', () => {
    expect(classWithSuffix('SendEmail', 'Job')).toBe('SendEmailJob');
    expect(classWithSuffix('SendEmailJob', 'Job')).toBe('SendEmailJob');
    expect(classWithSuffix('store post', 'Test')).toBe('StorePostTest');
  });

  it('classWithSuffix strips the suffix case-insensitively (snake input)', () => {
    expect(classWithSuffix('post_controller', 'Controller')).toBe('PostController');
    expect(classWithSuffix('userfactory', 'Factory')).toBe('UserFactory');
  });
});

describe('tinker REPL eval (Phase 6)', () => {
  it('evaluates plain expressions and returns their value', async () => {
    const evalLine = createTinkerEval({ answer: 41 });
    const { error, value } = await runLine(evalLine, 'answer + 1');
    expect(error).toBeNull();
    expect(value).toBe(42);
  });

  it('strips TypeScript annotations', async () => {
    const evalLine = createTinkerEval({ answer: 41 });
    const { error, value } = await runLine(evalLine, '(answer as number) + 1');
    expect(error).toBeNull();
    expect(value).toBe(42);
  });

  it('awaits async expressions', async () => {
    const evalLine = createTinkerEval({});
    const { error, value } = await runLine(evalLine, 'await Promise.resolve(7)');
    expect(error).toBeNull();
    expect(value).toBe(7);
  });

  it('keeps state between lines (assignments persist on the sandbox)', async () => {
    const evalLine = createTinkerEval({});
    const first = await runLine(evalLine, "user = { name: 'Ada' }");
    expect(first.error).toBeNull();
    expect(first.value).toEqual({ name: 'Ada' });

    const second = await runLine(evalLine, 'user.name');
    expect(second.error).toBeNull();
    expect(second.value).toBe('Ada');
  });

  it('runs multi-statement blocks', async () => {
    const evalLine = createTinkerEval({});
    const { error, value } = await runLine(evalLine, 'const a = 2; const b = 3;');
    expect(error).toBeNull();
    expect(value).toBeUndefined();
  });

  it('propagates thrown errors to the REPL', async () => {
    const evalLine = createTinkerEval({});
    const { error } = await runLine(evalLine, "throw new Error('boom')");
    expect(error).not.toBeNull();
    expect(String(error?.message)).toContain('boom');
  });

  it('does not re-run code when an expression throws at runtime (no block fallback)', async () => {
    // The expression wrapper only falls back to the block form for a
    // SyntaxError. A *runtime* error must propagate as-is — if it fell
    // through to runBlock the line would execute a second time.
    const evalLine = createTinkerEval({ counter: 0 });
    const { error } = await runLine(evalLine, '(counter++, missingThing())');
    expect(error).not.toBeNull();
    expect(String(error?.message)).toMatch(/missingThing/);

    // The side effect ran exactly once — a broken guard would double it.
    const { value } = await runLine(evalLine, 'counter');
    expect(value).toBe(1);
  });

  it('evaluates expressions that continue across lines', async () => {
    const evalLine = createTinkerEval({});
    const { error, value } = await runLine(evalLine, '1 +\n2');
    expect(error).toBeNull();
    expect(value).toBe(3);
  });

  it('strips TypeScript annotations across multi-line expressions', async () => {
    const evalLine = createTinkerEval({});
    const { error, value } = await runLine(evalLine, '(\n  a: number,\n  b: number,\n) => a * b');
    expect(error).toBeNull();
    expect(typeof value).toBe('function');
    expect((value as (a: number, b: number) => number)(6, 7)).toBe(42);
  });

  it('evaluates template literals spanning multiple lines', async () => {
    const evalLine = createTinkerEval({});
    const { error, value } = await runLine(evalLine, '`hello\nworld`');
    expect(error).toBeNull();
    expect(value).toBe('hello\nworld');
  });

  it('falls back to the block form for statement lines and returns undefined', async () => {
    // `const x = 5` cannot parse as an expression — the eval must fall back
    // to the block form, run it, and report undefined (no expression value).
    const evalLine = createTinkerEval({});
    const { error, value } = await runLine(evalLine, 'const x = 5');
    expect(error).toBeNull();
    expect(value).toBeUndefined();

    // Prove the fallback actually executed: a statement whose bare
    // assignment persists on the sandbox (an `if` is not an expression
    // either, so this also takes the block path).
    const statement = await runLine(evalLine, 'if (true) { note = "ran" }');
    expect(statement.error).toBeNull();
    expect(statement.value).toBeUndefined();
    const { value: note } = await runLine(evalLine, 'note');
    expect(note).toBe('ran');
  });

  it('evaluates piped multi-line input in order (the serialization queue)', async () => {
    // node:repl fires the next piped line immediately, so lines are handed to
    // the eval back-to-back without waiting. Without the internal chain, the
    // fast lines (0ms/5ms) would report BEFORE the slow first line (30ms).
    const evalLine = createTinkerEval({});
    const order: string[] = [];

    const send = (label: string, code: string, delay: number) => {
      evalLine(
        `await new Promise((r) => setTimeout(r, ${delay})).then(() => ${code})`,
        {},
        'tinker-piped',
        (error, value) => order.push(error ? `${label}:error:${error.message}` : `${label}:${String(value)}`),
      );
    };

    send('first', '1', 30);
    send('second', '2 + 2', 0);
    evalLine('throw new Error("boom")', {}, 'tinker-piped', (error) =>
      order.push(error ? 'third:error:boom' : 'third:ok'),
    );
    send('fourth', '4', 5);

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(order).toEqual(['first:1', 'second:4', 'third:error:boom', 'fourth:4']);
  });
});

describe('tinker writer — formatValue', () => {
  it('prints a model like Laravel tinker (ClassName { sorted attributes })', async () => {
    await freshApp();
    const user = (await User.create({
      name: 'Ada',
      email: 'ada@chava.dev',
      password: 'secret',
    })) as User;

    const output = formatValue(user);
    expect(output.startsWith('User {')).toBe(true);
    expect(output).toContain("name: 'Ada'");
    expect(output).toContain("email: 'ada@chava.dev'");
    // The writer goes through toArray(), so hidden attributes (password)
    // never leak into the REPL output.
    expect(output).not.toContain('secret');
  });

  it('prints arrays of models with one entry per line', async () => {
    await freshApp();
    const ada = (await User.create({ name: 'Ada', email: 'ada@chava.dev', password: 'secret' })) as User;
    const lin = (await User.create({ name: 'Lin', email: 'lin@chava.dev', password: 'secret' })) as User;

    const output = formatValue([ada, lin]);
    expect(output).toMatch(/^\[\n  User \{/);
    expect(output.match(/User \{/g)).toHaveLength(2);
    expect(output).toContain("name: 'Lin'");
    expect(output.endsWith('\n]')).toBe(true);

    expect(formatValue([])).toBe('[]');
  });

  it('prints plain values with inspect', () => {
    expect(formatValue(42)).toBe('42');
    expect(formatValue('hello')).toBe("'hello'");
    expect(formatValue(null)).toBe('null');
    expect(formatValue(undefined)).toBe('undefined');
    // Keys are sorted, exactly like Laravel tinker's array output.
    expect(formatValue({ b: 2, a: 1 })).toBe('{ a: 1, b: 2 }');
  });
});

describe('queue:listen (Phase 6)', () => {
  it('builds a queue:work --once argv from the options', () => {
    expect(workerPassArgv({})).toEqual(['bin/chava.js', 'queue:work', '--once']);
    expect(workerPassArgv({ connection: 'database', queue: 'emails', tries: '5' })).toEqual([
      'bin/chava.js',
      'queue:work',
      '--once',
      '--connection',
      'database',
      '--queue',
      'emails',
      '--tries',
      '5',
    ]);
  });

  it('omits a default (0) tries override', () => {
    expect(workerPassArgv({ tries: '0' })).toEqual(['bin/chava.js', 'queue:work', '--once']);
  });
});
