import type { Application } from '../foundation/Application';
import type { Model, ModelClass } from '../orm/Model';
import { AuthorizationException } from '../support/exceptions';
import type { AuthManager } from './AuthManager';

export type AbilityCallback = (
  user: Model | null,
  ...args: unknown[]
) => boolean | Promise<boolean>;

/** before() callbacks may return null/undefined to skip (Laravel: Gate::before). */
export type GateBeforeCallback = (
  user: Model | null,
  ability: string,
  ...args: unknown[]
) => boolean | null | undefined | Promise<boolean | null | undefined>;

export type GateAfterCallback = (
  user: Model | null,
  ability: string,
  result: boolean,
  ...args: unknown[]
) => boolean | Promise<boolean>;

/**
 * Laravel's Gate — define abilities, register policies, authorize actions:
 *
 *   Gate.define('manage-users', (user) => user?.getAttribute('is_admin') === true);
 *   Gate.policy(User, UserPolicy);
 *   await Gate.authorize('delete', $user);       // throws 403
 *   await $user.can('delete', $user);            // via Model::can()
 */
export class Gate {
  private readonly abilities = new Map<string, AbilityCallback>();
  private readonly policies = new Map<string, { new (...args: never[]): object }>();
  private readonly beforeCallbacks: GateBeforeCallback[] = [];
  private readonly afterCallbacks: GateAfterCallback[] = [];
  private userOverride: Model | null | undefined = undefined;

  public constructor(private readonly app: Application) {}

  // ------------------------------------------------------------- abilities

  public define(ability: string, callback: AbilityCallback): this {
    this.abilities.set(ability, callback);
    return this;
  }

  public before(callback: GateBeforeCallback): this {
    this.beforeCallbacks.push(callback);
    return this;
  }

  public after(callback: GateAfterCallback): this {
    this.afterCallbacks.push(callback);
    return this;
  }

  /** Register a policy for a model class (Laravel: Gate::policy(User::class, ...)). */
  public policy(modelClass: ModelClass, policyClass: { new (...args: never[]): object }): this {
    this.policies.set(modelClass.name, policyClass);
    return this;
  }

  // --------------------------------------------------------------- checks

  /** A new Gate bound to a specific user (Laravel: Gate::forUser($user)). */
  public forUser(user: Model | null): Gate {
    const gate = new Gate(this.app);
    for (const [ability, callback] of this.abilities) gate.abilities.set(ability, callback);
    for (const [model, policy] of this.policies) gate.policies.set(model, policy);
    gate.beforeCallbacks.push(...this.beforeCallbacks);
    gate.afterCallbacks.push(...this.afterCallbacks);
    gate.userOverride = user;
    return gate;
  }

  public async allows(ability: string, ...args: unknown[]): Promise<boolean> {
    return this.raw(ability, args);
  }

  public async denies(ability: string, ...args: unknown[]): Promise<boolean> {
    return !(await this.allows(ability, args));
  }

  public async check(abilities: string[]): Promise<boolean> {
    for (const ability of abilities) {
      if (!(await this.allows(ability))) return false;
    }
    return true;
  }

  public async any(abilities: string[]): Promise<boolean> {
    for (const ability of abilities) {
      if (await this.allows(ability)) return true;
    }
    return false;
  }

  public async none(abilities: string[]): Promise<boolean> {
    return !(await this.any(abilities));
  }

  /** Throw AuthorizationException (403) when the ability is denied. */
  public async authorize(ability: string, ...args: unknown[]): Promise<boolean> {
    if (await this.allows(ability, ...args)) return true;
    throw new AuthorizationException(`This action is unauthorized.`);
  }

  public async can(ability: string, ...args: unknown[]): Promise<boolean> {
    return this.allows(ability, ...args);
  }

  // ------------------------------------------------------------- internals

  private async user(): Promise<Model | null> {
    if (this.userOverride !== undefined) return this.userOverride;
    return this.app.make<AuthManager>('auth').user();
  }

  private async raw(ability: string, args: unknown[]): Promise<boolean> {
    const user = await this.user();

    // before() callbacks run first and may short-circuit (Laravel: Gate::before).
    for (const callback of this.beforeCallbacks) {
      const result = await callback(user, ability, ...args);
      if (typeof result === 'boolean') return result;
    }

    let result: boolean;

    const explicit = this.abilities.get(ability);
    if (explicit) {
      result = await explicit(user, ...args);
    } else {
      result = await this.callPolicy(ability, user, args);
    }

    // after() callbacks may override the result (Laravel: Gate::after).
    for (const callback of this.afterCallbacks) {
      const override = await callback(user, ability, result, ...args);
      if (typeof override === 'boolean') result = override;
    }

    return result;
  }

  private async callPolicy(ability: string, user: Model | null, args: unknown[]): Promise<boolean> {
    // Laravel: policies map to the model class of the first model argument.
    const target = args.find((arg): arg is Model => isModel(arg));
    if (!target) return false;
    const policyClass = this.policies.get(target.constructor.name);
    if (!policyClass) return false;
    const policy = this.app.make(policyClass) as Record<string, unknown>;
    const method = policy[ability];
    if (typeof method !== 'function') return false;
    return Boolean(await (method as AbilityCallback).call(policy, user, ...args));
  }
}

function isModel(value: unknown): value is Model {
  return value !== null && typeof value === 'object' && typeof (value as { getKey?: unknown }).getKey === 'function';
}
