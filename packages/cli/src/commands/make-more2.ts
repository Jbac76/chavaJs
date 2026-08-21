import { join } from 'node:path';
import { Command } from 'commander';
import { classWithSuffix, pluralize, snake, write } from '../helpers/generators';

/** PostController → post (the singular route-model param Laravel binds). */
function resourceParam(className: string): string {
  return snake(className.replace(/Controller$/, ''));
}

// ------------------------------------------------------------------ stubs

const CONTROLLER_HEADER = (className: string): string => `import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';
import { Request } from '../../../src/http/Request';
import { Response } from '../../../src/http/Response';

export class ${className} extends Controller {
`;

const CONTROLLER_FOOTER = `}
`;

const PLAIN_CONTROLLER_STUB = (className: string): string =>
  `${CONTROLLER_HEADER(className)}  /** GET /${pluralize(snake(className.replace(/Controller$/, '')))} */\n` +
  `  public async index(request: Request) {\n` +
  `    return Inertia.render('${className.replace(/Controller$/, '')}/Index');\n` +
  `  }\n` +
  `${CONTROLLER_FOOTER}`;

/** Laravel's resource controller (index/create/store/show/edit/update/destroy). */
export function resourceControllerStub(className: string, api = false): string {
  const param = resourceParam(className);
  // Collection paths are plural (/products), the route-model param singular
  // ({product}) — exactly Laravel's conventions.
  const base = pluralize(snake(className.replace(/Controller$/, '')));
  const page = (name: string): string =>
    `${className.replace(/Controller$/, '')}/${name}`;
  const methods: string[] = [];

  methods.push(
    `  /** GET /${base} */`,
    `  public async index(request: Request) {`,
    `    return Inertia.render('${page('Index')}');`,
    `  }`,
  );

  if (!api) {
    methods.push(
      ``,
      `  /** GET /${base}/create */`,
      `  public async create(request: Request) {`,
      `    return Inertia.render('${page('Create')}');`,
      `  }`,
    );
  }

  methods.push(
    ``,
    `  /** POST /${base} */`,
    `  public async store(request: Request) {`,
    `    const data = request.only(['title']);`,
    `    void data;`,
    `    return Response.redirect('/${base}');`,
    `  }`,
  );

  methods.push(
    ``,
    `  /** GET /${base}/{${param}} */`,
    `  public async show(request: Request, ${param}: string) {`,
    `    return Inertia.render('${page('Show')}', { ${param} });`,
    `  }`,
  );

  if (!api) {
    methods.push(
      ``,
      `  /** GET /${base}/{${param}}/edit */`,
      `  public async edit(request: Request, ${param}: string) {`,
      `    return Inertia.render('${page('Edit')}', { ${param} });`,
      `  }`,
    );
  }

  methods.push(
    ``,
    `  /** PUT/PATCH /${base}/{${param}} */`,
    `  public async update(request: Request, ${param}: string) {`,
    `    return Response.redirect(\`/${base}/\${${param}}\`);`,
    `  }`,
    ``,
    `  /** DELETE /${base}/{${param}} */`,
    `  public async destroy(request: Request, ${param}: string) {`,
    `    return Response.redirect('/${base}');`,
    `  }`,
  );

  return CONTROLLER_HEADER(className) + methods.join('\n') + '\n' + CONTROLLER_FOOTER;
}

/** Laravel's invokable controller: make:controller --invokable. */
export const invokableControllerStub = (className: string): string =>
  `import { Inertia } from '../../../src/facades';
import { Controller } from '../../../src/http/Controller';

export class ${className} extends Controller {
  /** Single-action controller (Laravel: make:controller --invokable). */
  public async __invoke() {
    return Inertia.render('${className.replace(/Controller$/, '')}');
  }
}
`;

export const middlewareStub = (className: string): string => `import type { Request } from '../../../src/http/Request';
import type { Response } from '../../../src/http/Response';
import type { NextFunction } from '../../../src/http/types';

export class ${className} {
  public async handle(request: Request, next: NextFunction): Promise<Response> {
    // Example guard — replace with your own logic:
    // const user = await request.user();
    // if (!user || user.getAttribute('is_admin') !== true) {
    //   return Response.redirect('/');
    // }
    void request;
    return next();
  }
}
`;

export const featureTestStub = (className: string): string => `import { describe, expect, it } from 'vitest';
import { freshApp } from '../helpers/db';

describe('${className}', () => {
  it('works', async () => {
    await freshApp();
    expect(true).toBe(true);
  });
});
`;

export const unitTestStub = (className: string): string => `import { describe, expect, it } from 'vitest';

describe('${className}', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});
`;

// ------------------------------------------------------------------ commands

export function makeControllerCommand(): Command {
  return new Command('make:controller')
    .description('Create a new controller class')
    .argument('<name>', 'The controller name (e.g. PostController)')
    .option('-r, --resource', 'Generate a resource controller')
    .option('-a, --api', 'Generate an API resource controller (no create/edit views)')
    .option('-i, --invokable', 'Generate a single-action, invokable controller')
    .action(async (name: string, options: { resource?: boolean; api?: boolean; invokable?: boolean }) => {
      const className = classWithSuffix(name, 'Controller');
      let content: string;
      if (options.invokable) content = invokableControllerStub(className);
      else if (options.resource || options.api) content = resourceControllerStub(className, options.api);
      else content = PLAIN_CONTROLLER_STUB(className);
      write(join(process.cwd(), 'app', 'Http', 'Controllers', `${className}.ts`), content);
    });
}

export function makeMiddlewareCommand(): Command {
  return new Command('make:middleware')
    .description('Create a new middleware class')
    .argument('<name>', 'The middleware name (e.g. EnsureAdmin)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Middleware');
      write(join(process.cwd(), 'app', 'Http', 'Middleware', `${className}.ts`), middlewareStub(className));
    });
}

export function makeTestCommand(): Command {
  return new Command('make:test')
    .description('Create a new test file')
    .argument('<name>', 'The test name (e.g. StorePostTest)')
    .option('-u, --unit', 'Create a unit test instead of a feature test')
    .action(async (name: string, options: { unit?: boolean }) => {
      const className = classWithSuffix(name, 'Test');
      const dir = options.unit ? 'Unit' : 'Feature';
      const content = options.unit ? unitTestStub(className) : featureTestStub(className);
      write(join(process.cwd(), 'tests', dir, `${className}.ts`), content);
    });
}
