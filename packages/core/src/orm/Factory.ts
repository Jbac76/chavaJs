import { faker } from '@faker-js/faker';
import type { Model, ModelClass } from './Model';

export type FactoryState<T extends Model = Model> =
  | Record<string, unknown>
  | ((data: Record<string, unknown>) => Record<string, unknown>);

/**
 * Laravel's model factories:
 *
 *   export class UserFactory extends Factory<User> {
 *     protected model = User;
 *     public definition() {
 *       return { name: faker.person.fullName(), email: faker.internet.email() };
 *     }
 *   }
 *
 *   await UserFactory.new().count(10).create();
 */
export class Factory<T extends Model = Model> {
  protected model!: ModelClass<T>;
  protected faker = faker;

  private countValue = 1;
  private states: Array<(data: Record<string, unknown>) => Record<string, unknown>> = [];

  /** Create a new factory instance (Laravel: UserFactory::new()). */
  public static new<M extends Model, F extends Factory<M>>(this: new () => F): F {
    return new this();
  }

  public definition(): Record<string, unknown> {
    return {};
  }

  /** Set how many models to create (Laravel: ->count(10)). */
  public count(count: number): this {
    this.countValue = count;
    return this;
  }

  /** Apply a state override (Laravel: ->state([...])). */
  public state(state: FactoryState<T>): this {
    this.states.push(typeof state === 'function' ? state : () => state);
    return this;
  }

  /** Associate a model through a relation (Laravel: ->for($user, 'user')). */
  public for(parent: Model, relationName?: string): this {
    const key = `${relationName ?? snakeCase(parent.constructor.name)}_id`;
    return this.state({ [key]: parent.getAttribute(parent.getKeyName()) });
  }

  /** Build the attributes for one model without persisting. */
  public makeOne(): Record<string, unknown> {
    let data = this.definition();
    for (const state of this.states) {
      data = { ...data, ...state(data) };
    }
    return data;
  }

  /** Build a single model instance without persisting. */
  public make(): T {
    return this.model.newInstance(this.makeOne()) as T;
  }

  /** Build models without persisting. */
  public makeMany(count = this.countValue): T[] {
    return Array.from({ length: count }, () => this.make());
  }

  /** Persist one model. */
  public async createOne(): Promise<T> {
    return (await this.model.createRaw(this.makeOne())) as T;
  }

  /** Persist models (Laravel: ->create()). */
  public async create(): Promise<T | T[]> {
    if (this.countValue === 1) return this.createOne();
    const results: T[] = [];
    for (let i = 0; i < this.countValue; i++) {
      results.push(await this.createOne());
    }
    return results;
  }

  /** Persist many models explicitly. */
  public async createMany(count = this.countValue): Promise<T[]> {
    const results: T[] = [];
    for (let i = 0; i < count; i++) {
      results.push(await this.createOne());
    }
    return results;
  }
}

function snakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
