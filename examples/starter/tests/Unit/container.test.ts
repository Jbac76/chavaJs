import { describe, expect, it } from 'vitest';
import { Container } from '../../src/container/Container';
import { BindingResolutionException } from '../../src/support/exceptions';

class Database {
  public connect(): string {
    return 'connected';
  }
}

class UserRepository {
  public constructor(private readonly db: Database) {}
  public status(): string {
    return this.db.connect();
  }
}

class PostService {
  public constructor(
    private readonly users: UserRepository,
    private readonly db: Database,
  ) {}
  public status(): string {
    return `${this.users.status()}|${this.db.connect()}`;
  }
}

describe('Container', () => {
  it('auto-wires constructor dependencies by parameter name', () => {
    const container = new Container();
    container.singleton('db', () => new Database());

    const repo = container.make<UserRepository>(UserRepository);
    expect(repo).toBeInstanceOf(UserRepository);
    expect(repo.status()).toBe('connected');
  });

  it('resolves nested dependency graphs', () => {
    const container = new Container();
    container.singleton('db', () => new Database());
    container.singleton('users', () => new UserRepository(container.make<Database>('db')));

    const service = container.make<PostService>(PostService);
    expect(service.status()).toBe('connected|connected');
  });

  it('returns the same instance for singleton bindings', () => {
    const container = new Container();
    container.singleton('db', () => new Database());
    expect(container.make('db')).toBe(container.make('db'));
  });

  it('creates a fresh instance for non-singleton bindings', () => {
    const container = new Container();
    container.bind('db', () => new Database());
    expect(container.make('db')).not.toBe(container.make('db'));
  });

  it('resolves instances bound with instance()', () => {
    const container = new Container();
    const database = new Database();
    container.instance('db', database);
    expect(container.make('db')).toBe(database);
  });

  it('resolves aliases', () => {
    const container = new Container();
    container.singleton('db', () => new Database());
    container.alias('Database', 'db');
    expect(container.make('Database')).toBe(container.make('db'));
  });

  it('passes explicit overrides to make()', () => {
    const container = new Container();
    const db = new Database();
    const repo = container.make<UserRepository>(UserRepository, { db });
    expect(repo.status()).toBe('connected');
  });

  it('injects method parameters via call()', () => {
    const container = new Container();
    container.singleton('db', () => new Database());
    const instance = new UserRepository(new Database());
    const result = container.call(instance, 'status');
    expect(result).toBe('connected');
  });

  it('supports constructor parameters with default values', () => {
    const container = new Container();
    container.singleton('config', () => ({ name: 'chavaJs' }));

    class Service {
      public constructor(
        private readonly config: { name: string },
        private readonly port = 8080,
      ) {}
      public info(): string {
        return `${this.config.name}:${this.port}`;
      }
    }

    expect(container.make<Service>(Service).info()).toBe('chavaJs:8080');
  });

  it('throws a helpful error for unresolvable dependencies', () => {
    const container = new Container();
    expect(() => container.make('nope')).toThrow(BindingResolutionException);
  });

  it('resolves contextual bindings with when().needs().give()', () => {
    const container = new Container();
    container.singleton('db', () => new Database());
    container.singleton('users', () => new UserRepository(container.make('db')));
    const fake = new Database();
    container.when(PostService).needs('db').give(fake);

    const service = container.make<PostService>(PostService);
    expect(service.status()).toBe('connected|connected');

    // Only PostService gets the contextual binding — UserRepository still
    // resolves `db` from the container's normal binding.
    const repo = container.make<UserRepository>(UserRepository);
    expect(repo.status()).toBe('connected');
  });

  it('resolves contextual give() with a class or closure', () => {
    const container = new Container();
    container.singleton('db', () => new Database());
    container.singleton('users', () => new UserRepository(container.make('db')));
    container.when(UserRepository).needs('db').give(Database);
    const viaClass = container.make<UserRepository>(UserRepository);
    expect(viaClass.status()).toBe('connected');

    container.when(PostService).needs('users').give(() => new UserRepository(container.make('db')));
    const viaClosure = container.make<PostService>(PostService);
    expect(viaClosure.status()).toBe('connected|connected');
  });

  it('resolves contextual give() with a binding name string', () => {
    const container = new Container();
    container.singleton('db', () => new Database());
    container.singleton('users', () => new UserRepository(container.make('db')));
    container.when(PostService).needs('db').give('db');
    const service = container.make<PostService>(PostService);
    expect(service.status()).toBe('connected|connected');
  });
});
