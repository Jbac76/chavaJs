import { join } from 'node:path';
import { Command } from 'commander';
import { classWithSuffix, pascal, snake, timestamp, write } from '../helpers/generators';

const MODEL_STUB = (name: string): string => `import { Model } from '../../src/orm/Model';

export class ${name} extends Model {
  public static fillable: string[] = [];

  // Relationships:
  // public posts() {
  //   return this.hasMany(Post);
  // }
}
`;

const MIGRATION_STUB = (table: string): string => `import { Schema } from '../../src/facades';

export async function up(): Promise<void> {
  await Schema.create('${table}', (table) => {
    table.id();
    table.timestamps();
  });
}

export async function down(): Promise<void> {
  await Schema.dropIfExists('${table}');
}
`;

/**
 * Laravel's model factory, ported — with a faker-driven definition skeleton.
 *
 *   export class UserFactory extends Factory<User> {
 *     protected model = User;
 *     public definition() { return { name: faker.person.fullName() }; }
 *   }
 */
export function factoryStub(model: string, factoryClass = `${model}Factory`): string {
  return `import { faker } from '@faker-js/faker';
import { Factory } from '../../src/orm/Factory';
import { ${model} } from '../../app/Models/${model}';

/**
 * ${factoryClass} — Laravel's model factories, ported.
 *
 *   await ${factoryClass}.new().count(10).create();
 *   await ${factoryClass}.new().state({ is_admin: true }).createOne();
 */
export class ${factoryClass} extends Factory<${model}> {
  protected model = ${model};

  public definition() {
    return {
      // name: faker.person.fullName(),
      // email: faker.internet.email(),
      // password: 'secret',
    };
  }
}
`;
}

/** Laravel's seeder, ported — with commented examples for db:seed. */
export function seederStub(className: string): string {
  return `import { Seeder } from '../../src/database/Seeder';

/**
 * ${className} — Laravel's seeders, ported. Run with: chava db:seed
 */
export class ${className} extends Seeder {
  public async run(): Promise<void> {
    // const { User } = await import('../../app/Models/User');
    // const { UserFactory } = await import('../factories/UserFactory');
    // await UserFactory.new().count(10).create();
    // await User.create({ name: 'Example', email: 'example@chava.dev', password: 'secret' });
  }
}
`;
}

const REQUEST_STUB = (name: string): string => `import { FormRequest } from '../../../src/validation/FormRequest';

export class ${name} extends FormRequest {
  public rules(): Record<string, string> {
    return {
      // 'email': 'required|email|max:255',
    };
  }
}
`;

const POLICY_STUB = (name: string): string => `import { Policy } from '../../../src/auth/Policy';

export class ${name} extends Policy {
  // public view(user: User, target: User): boolean {
  //   return user.getKey() === target.getKey();
  // }
}
`;

export function makeModelCommand(): Command {
  return new Command('make:model')
    .description('Create a new model class')
    .argument('<name>', 'The model name (e.g. User)')
    .action(async (name: string) => {
      const className = pascal(name);
      write(join(process.cwd(), 'app', 'Models', `${className}.ts`), MODEL_STUB(className));
    });
}

export function makeMigrationCommand(): Command {
  return new Command('make:migration')
    .description('Create a new migration file')
    .argument('<name>', 'The migration name (e.g. create_users_table)')
    .action(async (name: string) => {
      const table = name.replace(/^create_/, '').replace(/_table$/, '');
      const fileName = `${timestamp()}_${snake(name)}.ts`;
      write(join(process.cwd(), 'database', 'migrations', fileName), MIGRATION_STUB(table));
    });
}

export function makeFactoryCommand(): Command {
  return new Command('make:factory')
    .description('Create a new model factory')
    .argument('[name]', 'The factory name (e.g. UserFactory)')
    .option('--model <model>', 'The model the factory is for (default: derived from the name)')
    .action(async (name: string | undefined, options: { model?: string }) => {
      const modelName = options.model ?? (name ? pascal(name.replace(/Factory$/, '')) : '');
      if (!modelName) {
        throw new Error('Specify a factory name or --model — e.g. `chava make:factory --model=User`.');
      }
      const factoryName = classWithSuffix(name ?? `${modelName}Factory`, 'Factory');
      write(join(process.cwd(), 'database', 'factories', `${factoryName}.ts`), factoryStub(modelName, factoryName));
    });
}

export function makeSeederCommand(): Command {
  return new Command('make:seeder')
    .description('Create a new seeder class')
    .argument('[name]', 'The seeder name (e.g. DatabaseSeeder)')
    .option('--class <class>', 'The seeder class name (mutually exclusive with the name argument)')
    .action(async (name: string | undefined, options: { class?: string }) => {
      if (name && options.class) {
        throw new Error('Pass a seeder name or --class, not both — e.g. `chava make:seeder UserSeeder`.');
      }
      const className = classWithSuffix(options.class ?? name ?? 'DatabaseSeeder', 'Seeder');
      write(join(process.cwd(), 'database', 'seeders', `${className}.ts`), seederStub(className));
    });
}

export function makeRequestCommand(): Command {
  return new Command('make:request')
    .description('Create a new form request class')
    .argument('<name>', 'The request name (e.g. StorePostRequest)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Request');
      write(join(process.cwd(), 'app', 'Http', 'Requests', `${className}.ts`), REQUEST_STUB(className));
    });
}

export function makePolicyCommand(): Command {
  return new Command('make:policy')
    .description('Create a new policy class')
    .argument('<name>', 'The policy name (e.g. PostPolicy)')
    .action(async (name: string) => {
      const className = classWithSuffix(name, 'Policy');
      write(join(process.cwd(), 'app', 'Policies', `${className}.ts`), POLICY_STUB(className));
    });
}
